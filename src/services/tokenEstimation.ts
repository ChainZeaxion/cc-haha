import type { Anthropic } from '@anthropic-ai/sdk'
import type { BetaMessageParam as MessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
// @aws-sdk/client-bedrock-runtime is imported dynamically in countTokensWithBedrock()
// to defer ~279KB of AWS SDK code until a Bedrock call is actually made
import type { CountTokensCommandInput } from '@aws-sdk/client-bedrock-runtime'
import { getAPIProvider, isFirstPartyAnthropicBaseUrl } from 'src/utils/model/providers.js'
import { VERTEX_COUNT_TOKENS_ALLOWED_BETAS } from '../constants/betas.js'
import type { Attachment } from '../utils/attachments.js'
import { getModelBetas } from '../utils/betas.js'
import { getVertexRegionForModel, isEnvTruthy } from '../utils/envUtils.js'
import { logError } from '../utils/log.js'
import { normalizeAttachmentForAPI } from '../utils/messages.js'
import { parseOpenAIReasoningEnvelope } from '../utils/openAIReasoningEnvelope.js'
import {
  createBedrockRuntimeClient,
  getInferenceProfileBackingModel,
  isFoundationModel,
} from '../utils/model/bedrock.js'
import {
  getDefaultSonnetModel,
  getMainLoopModel,
  getSmallFastModel,
  normalizeModelStringForAPI,
} from '../utils/model/model.js'
import { jsonStringify } from '../utils/slowOperations.js'
import { isToolReferenceBlock } from '../utils/toolSearch.js'
import { getAPIMetadata, getExtraBodyParams } from './api/claude.js'
import { getAnthropicClient } from './api/client.js'
import { withTokenCountVCR } from './vcr.js'

// Minimal values for token counting with thinking enabled
// API constraint: max_tokens must be greater than thinking.budget_tokens
const TOKEN_COUNT_THINKING_BUDGET = 1024
const TOKEN_COUNT_MAX_TOKENS = 2048

/**
 * Check if messages contain thinking blocks
 */
function hasThinkingBlocks(
  messages: Anthropic.Beta.Messages.BetaMessageParam[],
): boolean {
  for (const message of messages) {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (
          typeof block === 'object' &&
          block !== null &&
          'type' in block &&
          (block.type === 'thinking' || block.type === 'redacted_thinking')
        ) {
          return true
        }
      }
    }
  }
  return false
}

/**
 * Strip tool search-specific fields from messages before sending for token counting.
 * This removes 'caller' from tool_use blocks and 'tool_reference' from tool_result content.
 * These fields are only valid with the tool search beta and will cause errors otherwise.
 *
 * Note: We use 'as unknown as' casts because the SDK types don't include tool search beta fields,
 * but at runtime these fields may exist from API responses when tool search was enabled.
 */
function stripToolSearchFieldsFromMessages(
  messages: Anthropic.Beta.Messages.BetaMessageParam[],
): Anthropic.Beta.Messages.BetaMessageParam[] {
  return messages.map(message => {
    if (!Array.isArray(message.content)) {
      return message
    }

    const normalizedContent = message.content.map(block => {
      // Strip 'caller' from tool_use blocks (assistant messages)
      if (block.type === 'tool_use') {
        // Destructure to exclude any extra fields like 'caller'
        const toolUse =
          block as Anthropic.Beta.Messages.BetaToolUseBlockParam & {
            caller?: unknown
          }
        return {
          type: 'tool_use' as const,
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input,
        }
      }

      // Strip tool_reference blocks from tool_result content (user messages)
      if (block.type === 'tool_result') {
        const toolResult =
          block as Anthropic.Beta.Messages.BetaToolResultBlockParam
        if (Array.isArray(toolResult.content)) {
          const filteredContent = (toolResult.content as unknown[]).filter(
            c => !isToolReferenceBlock(c),
          ) as typeof toolResult.content

          if (filteredContent.length === 0) {
            return {
              ...toolResult,
              content: [{ type: 'text' as const, text: '[tool references]' }],
            }
          }
          if (filteredContent.length !== toolResult.content.length) {
            return {
              ...toolResult,
              content: filteredContent,
            }
          }
        }
      }

      return block
    })

    return {
      ...message,
      content: normalizedContent,
    }
  })
}

export async function countTokensWithAPI(
  content: string,
): Promise<number | null> {
  // Special case for empty content - API doesn't accept empty messages
  if (!content) {
    return 0
  }

  const message: Anthropic.Beta.Messages.BetaMessageParam = {
    role: 'user',
    content: content,
  }

  return countMessagesTokensWithAPI([message], [])
}

export async function countMessagesTokensWithAPI(
  messages: Anthropic.Beta.Messages.BetaMessageParam[],
  tools: Anthropic.Beta.Messages.BetaToolUnion[],
): Promise<number | null> {
  return withTokenCountVCR(messages, tools, async () => {
    try {
      const model = getMainLoopModel()
      const betas = getModelBetas(model)
      const containsThinking = hasThinkingBlocks(messages)

      if (getAPIProvider() === 'bedrock') {
        // @anthropic-sdk/bedrock-sdk doesn't support countTokens currently
        return countTokensWithBedrock({
          model: normalizeModelStringForAPI(model),
          messages,
          tools,
          betas,
          containsThinking,
        })
      }

      const anthropic = await getAnthropicClient({
        maxRetries: 1,
        model,
        source: 'count_tokens',
      })

      const filteredBetas =
        getAPIProvider() === 'vertex'
          ? betas.filter(b => VERTEX_COUNT_TOKENS_ALLOWED_BETAS.has(b))
          : betas

      const response = await anthropic.beta.messages.countTokens({
        model: normalizeModelStringForAPI(model),
        messages:
          // When we pass tools and no messages, we need to pass a dummy message
          // to get an accurate tool token count.
          messages.length > 0 ? messages : [{ role: 'user', content: 'foo' }],
        tools,
        ...(filteredBetas.length > 0 && { betas: filteredBetas }),
        // Enable thinking if messages contain thinking blocks
        ...(containsThinking && {
          thinking: {
            type: 'enabled',
            budget_tokens: TOKEN_COUNT_THINKING_BUDGET,
          },
        }),
      })

      if (typeof response.input_tokens !== 'number') {
        // Vertex client throws
        // Bedrock client succeeds with { Output: { __type: 'com.amazon.coral.service#UnknownOperationException' }, Version: '1.0' }
        return null
      }

      return response.input_tokens
    } catch (error) {
      logError(error)
      return null
    }
  })
}

// ── Char-class token estimation ──────────────────────────────────────────────
//
// A flat `length / 4` assumes English prose, and this engine tokenizes CJK,
// digits and punctuation far less efficiently than that. Measured against the
// engine's own `count_tokens` endpoint:
//
//   English prose     4.50 chars/token   (flat 4 is right here)
//   Chinese           1.50               (flat 4 underestimates 2.7x)
//   JSON              1.83               (flat 4 underestimates 2.2x)
//   digits            1.00               (every numeral is its own token)
//   punctuation       ~1.20 in flowing text
//   spaces/newlines   free (never tokenized)
//
// JSON and code carry most of a transcript's bulk and are digit/punctuation
// dense, so the flat ratio underestimated them badly — a 9,000-char code block
// read as 2,250 tokens when the engine charged 3,198. Weighting by class brings
// the mean error to ~8% across nine content samples (was 30-60% off), which is
// what keeps the local estimate usable as the second opinion in the auto-compact
// trigger.
const CJK_TOKENS_PER_CHAR = 1 / 1.5
const LETTER_CHARS_PER_TOKEN = 4.5
const DIGIT_TOKENS_PER_CHAR = 1
const PUNCT_TOKENS_PER_CHAR = 1 / 1.2

const isCjk = (code: number): boolean =>
  (code >= 0x3400 && code <= 0x4dbf) || // CJK ext A
  (code >= 0x4e00 && code <= 0x9fff) || // CJK unified
  (code >= 0xf900 && code <= 0xfaff) || // CJK compat
  (code >= 0x3040 && code <= 0x30ff) || // kana
  (code >= 0xac00 && code <= 0xd7af) // hangul syllables

const isLetterOrUnderscore = (code: number): boolean =>
  (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95

const isDigit = (code: number): boolean => code >= 48 && code <= 57

const isSpace = (code: number): boolean =>
  code === 32 || code === 9 || code === 10 || code === 13

/**
 * Single pass, no regex and no allocation: this runs over every message of a
 * transcript on each trigger check, so the hot path stays a charCode loop.
 */
export function estimateTokensByCharClass(content: string): number {
  let tokens = 0
  let i = 0
  const n = content.length
  while (i < n) {
    const code = content.charCodeAt(i)
    if (isSpace(code)) {
      i++
      continue
    }
    if (isCjk(code)) {
      tokens += CJK_TOKENS_PER_CHAR
      i++
      continue
    }
    if (isDigit(code)) {
      let j = i
      while (j < n && isDigit(content.charCodeAt(j))) j++
      tokens += (j - i) * DIGIT_TOKENS_PER_CHAR
      i = j
      continue
    }
    if (isLetterOrUnderscore(code)) {
      let j = i
      while (j < n && isLetterOrUnderscore(content.charCodeAt(j))) j++
      // A word is at least one token however short it is — `a` and `b` cost a
      // token each, which the flat ratio divided down to a quarter.
      tokens += Math.max(1, (j - i) / LETTER_CHARS_PER_TOKEN)
      i = j
      continue
    }
    tokens += PUNCT_TOKENS_PER_CHAR
    i++
  }
  return Math.round(tokens)
}

/**
 * Rough token count for a string.
 *
 * Without `bytesPerToken` the estimate is class-weighted (see above). Callers
 * that pass an explicit ratio (file-type heuristics) keep the flat behaviour
 * they were tuned for.
 */
export function roughTokenCountEstimation(
  content: string,
  bytesPerToken?: number,
): number {
  if (bytesPerToken !== undefined) {
    return Math.round(content.length / bytesPerToken)
  }
  return estimateTokensByCharClass(content)
}

// ── Session calibration ──────────────────────────────────────────────────────
//
// Intentionally absent. Scaling the local estimate by (engine tokens / local
// estimate) was considered and rejected: it would drag the local estimate down
// exactly when the engine under-reports — the one case the local estimate
// exists to catch — because the feedback loop cannot tell "the local ratio is
// wrong" from "the engine is lying". The two measurements stay independent and
// the trigger takes whichever is higher.


/**
 * Returns an estimated bytes-per-token ratio for a given file extension.
 * Dense JSON has many single-character tokens (`{`, `}`, `:`, `,`, `"`)
 * which makes the real ratio closer to 2 rather than the default 4.
 */
export function bytesPerTokenForFileType(fileExtension: string): number {
  switch (fileExtension) {
    case 'json':
    case 'jsonl':
    case 'jsonc':
      return 2
    default:
      return 4
  }
}

/**
 * Like {@link roughTokenCountEstimation} but uses a more accurate
 * bytes-per-token ratio when the file type is known.
 *
 * This matters when the API-based token count is unavailable (e.g. on
 * Bedrock) and we fall back to the rough estimate — an underestimate can
 * let an oversized tool result slip into the conversation.
 */
export function roughTokenCountEstimationForFileType(
  content: string,
  fileExtension: string,
): number {
  return roughTokenCountEstimation(
    content,
    bytesPerTokenForFileType(fileExtension),
  )
}

export function roughTokenCountEstimationForAPIRequest(
  messages: readonly {
    role?: string
    content?: string | Array<Anthropic.ContentBlock> | Array<Anthropic.ContentBlockParam>
  }[],
  tools: readonly unknown[] = [],
): number {
  let totalTokens = 0
  for (const message of messages) {
    totalTokens += roughTokenCountEstimation(message.role ?? '')
    totalTokens += roughTokenCountEstimationForContent(message.content)
  }
  if (tools.length > 0) {
    totalTokens += roughTokenCountEstimation(jsonStringify({ tools }))
  }
  return totalTokens
}

/**
 * Estimates token count for a Message object by extracting and analyzing its text content.
 * This provides a more reliable estimate than getTokenUsage for messages that may have been compacted.
 * Uses Haiku for token counting (Haiku 4.5 supports thinking blocks), except:
 * - Vertex global region: uses Sonnet (Haiku not available)
 * - Bedrock with thinking blocks: uses Sonnet (Haiku 3.5 doesn't support thinking)
 */
export async function countTokensViaHaikuFallback(
  messages: Anthropic.Beta.Messages.BetaMessageParam[],
  tools: Anthropic.Beta.Messages.BetaToolUnion[],
): Promise<number | null> {
  // Check if messages contain thinking blocks
  const containsThinking = hasThinkingBlocks(messages)

  // If we're on Vertex and using global region, always use Sonnet since Haiku is not available there.
  const isVertexGlobalEndpoint =
    isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) &&
    getVertexRegionForModel(getSmallFastModel()) === 'global'
  // If we're on Bedrock with thinking blocks, use Sonnet since Haiku 3.5 doesn't support thinking
  const isBedrockWithThinking =
    isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK) && containsThinking
  // If we're on Vertex with thinking blocks, use Sonnet since Haiku 3.5 doesn't support thinking
  const isVertexWithThinking =
    isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX) && containsThinking
  // Otherwise always use Haiku - Haiku 4.5 supports thinking blocks.
  // WARNING: if you change this to use a non-Haiku model, this request will fail in 1P unless it uses getCLISyspromptPrefix.
  // Note: We don't need Sonnet for tool_reference blocks because we strip them via
  // stripToolSearchFieldsFromMessages() before sending.
  // Use getSmallFastModel() to respect ANTHROPIC_SMALL_FAST_MODEL env var for Bedrock users
  // with global inference profiles (see issue #10883).
  const model =
    isVertexGlobalEndpoint || isBedrockWithThinking || isVertexWithThinking
      ? getDefaultSonnetModel()
      : getSmallFastModel()
  const anthropic = await getAnthropicClient({
    maxRetries: 1,
    model,
    source: 'count_tokens',
  })

  // Strip tool search-specific fields (caller, tool_reference) before sending
  // These fields are only valid with the tool search beta header
  const normalizedMessages = stripToolSearchFieldsFromMessages(messages)

  const messagesToSend: MessageParam[] =
    normalizedMessages.length > 0
      ? (normalizedMessages as MessageParam[])
      : [{ role: 'user', content: 'count' }]

  const betas = getModelBetas(model)
  // Filter betas for Vertex - some betas (like web-search) cause 400 errors
  // on certain Vertex endpoints. See issue #10789.
  const filteredBetas =
    getAPIProvider() === 'vertex'
      ? betas.filter(b => VERTEX_COUNT_TOKENS_ALLOWED_BETAS.has(b))
      : betas

  // biome-ignore lint/plugin: token counting needs specialized parameters (thinking, betas) that sideQuery doesn't support
  const response = await anthropic.beta.messages.create({
    model: normalizeModelStringForAPI(model),
    max_tokens: containsThinking ? TOKEN_COUNT_MAX_TOKENS : 1,
    messages: messagesToSend,
    tools: tools.length > 0 ? tools : undefined,
    ...(filteredBetas.length > 0 && { betas: filteredBetas }),
    metadata: getAPIMetadata(),
    ...getExtraBodyParams(),
    // Enable thinking if messages contain thinking blocks
    ...(containsThinking && {
      thinking: {
        type: 'enabled',
        budget_tokens: TOKEN_COUNT_THINKING_BUDGET,
      },
    }),
  })

  const usage = response.usage
  const inputTokens = usage.input_tokens
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0
  const cacheReadTokens = usage.cache_read_input_tokens || 0

  return inputTokens + cacheCreationTokens + cacheReadTokens
}

export function roughTokenCountEstimationForMessages(
  messages: readonly {
    type: string
    message?: { content?: unknown }
    attachment?: Attachment
  }[],
): number {
  let totalTokens = 0
  for (const message of messages) {
    totalTokens += roughTokenCountEstimationForMessage(message)
  }
  return totalTokens
}

export function roughTokenCountEstimationForMessage(message: {
  type: string
  message?: { content?: unknown }
  attachment?: Attachment
}): number {
  if (
    (message.type === 'assistant' || message.type === 'user') &&
    message.message?.content
  ) {
    return roughTokenCountEstimationForContent(
      message.message?.content as
        | string
        | Array<Anthropic.ContentBlock>
        | Array<Anthropic.ContentBlockParam>
        | undefined,
    )
  }

  if (message.type === 'attachment' && message.attachment) {
    const userMessages = normalizeAttachmentForAPI(message.attachment)
    let total = 0
    for (const userMsg of userMessages) {
      total += roughTokenCountEstimationForContent(userMsg.message.content)
    }
    return total
  }

  return 0
}

// ── Image tokens ─────────────────────────────────────────────────────────────
//
// Every vision API prices an image by its pixel count, and a single constant
// was wrong for all of them: measured against the local Qwen engine, 1280x577
// screenshots bill 721 tokens, while the flat 2000 this used to return was
// 2.77x high — enough to pin the context meter above the real prompt.
//
// The divisor is provider-specific. Anthropic documents (w*h)/750 for its own
// vision pricing; the local engine patch-tokenizes in 32px blocks, which
// measures as (w*h)/1024 across seven sizes to within 2.2%.
const ANTHROPIC_IMAGE_PIXELS_PER_TOKEN = 750
const PATCHED_IMAGE_PIXELS_PER_TOKEN = 1024
/** Cap and fallback, matching microCompact's IMAGE_MAX_TOKEN_SIZE. */
const IMAGE_MAX_TOKEN_SIZE = 2000
const DOCUMENT_TOKEN_ESTIMATE = 2000

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * Width and height of a base64 PNG, or null when the payload is not a PNG we
 * can read. The IHDR chunk sits at a fixed offset, so the first 32 base64
 * characters (24 bytes) are all that has to be decoded — a full decode of a
 * 100KB screenshot per estimate would cost more than the estimate is worth.
 */
export function pngDimensionsFromBase64(
  data: string,
): { width: number; height: number } | null {
  if (data.length < 32) return null
  let head: Buffer
  try {
    head = Buffer.from(data.slice(0, 32), 'base64')
  } catch {
    return null
  }
  if (head.length < 24) return null
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (head[i] !== PNG_SIGNATURE[i]) return null
  }
  if (head.toString('latin1', 12, 16) !== 'IHDR') return null
  const width = head.readUInt32BE(16)
  const height = head.readUInt32BE(20)
  if (width === 0 || height === 0) return null
  return { width, height }
}

function estimateImageTokens(block: {
  source?: { data?: unknown; media_type?: unknown }
}): number {
  const data = block.source?.data
  if (typeof data !== 'string') return IMAGE_MAX_TOKEN_SIZE
  const dimensions = pngDimensionsFromBase64(data)
  if (!dimensions) return IMAGE_MAX_TOKEN_SIZE
  const divisor = isFirstPartyAnthropicBaseUrl()
    ? ANTHROPIC_IMAGE_PIXELS_PER_TOKEN
    : PATCHED_IMAGE_PIXELS_PER_TOKEN
  const tokens = Math.ceil(
    (dimensions.width * dimensions.height) / divisor,
  )
  return Math.min(IMAGE_MAX_TOKEN_SIZE, Math.max(1, tokens))
}

export function roughTokenCountEstimationForContent(
  content:
    | string
    | Array<Anthropic.ContentBlock>
    | Array<Anthropic.ContentBlockParam>
    | undefined,
): number {
  if (!content) {
    return 0
  }
  if (typeof content === 'string') {
    return roughTokenCountEstimation(content)
  }
  let totalTokens = 0
  for (const block of content) {
    totalTokens += roughTokenCountEstimationForBlock(block)
  }
  return totalTokens
}

function roughTokenCountEstimationForBlock(
  block: string | Anthropic.ContentBlock | Anthropic.ContentBlockParam,
): number {
  if (typeof block === 'string') {
    return roughTokenCountEstimation(block)
  }
  if (block.type === 'text') {
    return roughTokenCountEstimation(block.text)
  }
  return roughTokenCountEstimationForNonTextBlock(block)
}

/**
 * Thinking tokens estimated from an assistant message's own blocks.
 *
 * Stands in for the engine's reasoning count when it reports none, so the split
 * between deliberation and answer stays available on any endpoint rather than
 * only the ones that measure it. Only the thinking blocks are counted: the text
 * and tool input the same message produced belong to the output total, not to
 * this side of it, and adding them here would double them.
 *
 * Returns 0 when there is nothing to estimate, which the caller reads as "this
 * turn did not think" — the same reading a reported zero would get.
 */
export function roughTokenCountEstimationForThinking(
  content:
    | string
    | Array<Anthropic.ContentBlock>
    | Array<Anthropic.ContentBlockParam>
    | undefined,
): number {
  if (!content || typeof content === 'string') {
    return 0
  }
  let totalTokens = 0
  for (const block of content) {
    if (typeof block === 'string') {
      continue
    }
    if (block.type === 'thinking' || block.type === 'redacted_thinking') {
      totalTokens += roughTokenCountEstimationForBlock(block)
    }
  }
  return totalTokens
}

function roughTokenCountEstimationForNonTextBlock(
  block: Anthropic.ContentBlock | Anthropic.ContentBlockParam,
): number {
  if (block.type === 'image' || block.type === 'document') {
    // document: base64 PDF in source.data.  Must NOT reach the
    // jsonStringify catch-all — a 1MB PDF is ~1.33M base64 chars →
    // ~325k estimated tokens, vs the ~2000 the API actually charges.
    // Same constant as microCompact's calculateToolResultTokens.
    if (block.type === 'document') return DOCUMENT_TOKEN_ESTIMATE
    return estimateImageTokens(block)
  }
  if (block.type === 'tool_result') {
    return roughTokenCountEstimationForContent(block.content)
  }
  if (block.type === 'tool_use') {
    // input is the JSON the model generated — arbitrarily large (bash
    // commands, Edit diffs, file contents).  Stringify once for the
    // char count; the API re-serializes anyway so this is what it sees.
    return roughTokenCountEstimation(
      block.name + jsonStringify(block.input ?? {}),
    )
  }
  if (block.type === 'thinking') {
    return roughTokenCountEstimation(block.thinking)
  }
  if (block.type === 'redacted_thinking') {
    const openAIReasoning = parseOpenAIReasoningEnvelope(block.data)
    if (openAIReasoning) {
      return roughTokenCountEstimation(
        openAIReasoning.summary.map(entry => entry.text).join('\n'),
      )
    }
    return roughTokenCountEstimation(block.data)
  }
  // server_tool_use, web_search_tool_result, mcp_tool_use, etc. —
  // text-like payloads (tool inputs, search results, no base64).
  // Stringify-length tracks the serialized form the API sees; the
  // key/bracket overhead is single-digit percent on real blocks.
  return roughTokenCountEstimation(jsonStringify(block))
}

async function countTokensWithBedrock({
  model,
  messages,
  tools,
  betas,
  containsThinking,
}: {
  model: string
  messages: Anthropic.Beta.Messages.BetaMessageParam[]
  tools: Anthropic.Beta.Messages.BetaToolUnion[]
  betas: string[]
  containsThinking: boolean
}): Promise<number | null> {
  try {
    const client = await createBedrockRuntimeClient()
    // Bedrock CountTokens requires a model ID, not an inference profile / ARN
    const modelId = isFoundationModel(model)
      ? model
      : await getInferenceProfileBackingModel(model)
    if (!modelId) {
      return null
    }

    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      // When we pass tools and no messages, we need to pass a dummy message
      // to get an accurate tool token count.
      messages:
        messages.length > 0 ? messages : [{ role: 'user', content: 'foo' }],
      max_tokens: containsThinking ? TOKEN_COUNT_MAX_TOKENS : 1,
      ...(tools.length > 0 && { tools }),
      ...(betas.length > 0 && { anthropic_beta: betas }),
      ...(containsThinking && {
        thinking: {
          type: 'enabled',
          budget_tokens: TOKEN_COUNT_THINKING_BUDGET,
        },
      }),
    }

    const { CountTokensCommand } = await import(
      '@aws-sdk/client-bedrock-runtime'
    )
    const input: CountTokensCommandInput = {
      modelId,
      input: {
        invokeModel: {
          body: new TextEncoder().encode(jsonStringify(requestBody)),
        },
      },
    }
    const response = await client.send(new CountTokensCommand(input))
    const tokenCount = response.inputTokens ?? null
    return tokenCount
  } catch (error) {
    logError(error)
    return null
  }
}
