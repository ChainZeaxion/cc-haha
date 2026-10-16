// Critical system constants extracted to break circular dependencies

import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import { logForDebugging } from '../utils/debug.js'
import { isEnvDefinedFalsy } from '../utils/envUtils.js'
import { getAPIProvider } from '../utils/model/providers.js'
import { getWorkload } from '../utils/workloadContext.js'
import { localizedPrompt } from '../prompts/i18n/index.js'
import { formatClaudeCodeBillingHeader } from './claudeCodeCompatibility.js'
import { isLocalEngineUrl } from '../server/services/api/localEngineHost.js'

// English sources of truth; the Chinese override lives in zh.ts.
const DEFAULT_PREFIX_EN = `You are Claude Code, Anthropic's official CLI for Claude.`
const AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX_EN = `You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.`
const AGENT_SDK_PREFIX_EN = `You are a Claude agent, built on Anthropic's Claude Agent SDK.`

function buildDefaultPrefix(): string {
  return localizedPrompt('system.cliPrefix.default', DEFAULT_PREFIX_EN)
}

function buildAgentSdkCchPresetPrefix(): string {
  return localizedPrompt('system.cliPrefix.agentSdkCchPreset', AGENT_SDK_CLAUDE_CODE_PRESET_PREFIX_EN)
}

function buildAgentSdkPrefix(): string {
  return localizedPrompt('system.cliPrefix.agentSdk', AGENT_SDK_PREFIX_EN)
}

/**
 * All possible CLI sysprompt prefix values, used by splitSysPromptPrefix
 * to identify prefix blocks by content rather than position.
 *
 * Must be called at runtime (not at module import time) so that the prefix
 * content reflects the current prompt language — the same fix applied to
 * memdir sections (module-top-level const freezes localizedPrompt at import).
 */
export function getCliSyspromptPrefixSet(): ReadonlySet<string> {
  return new Set([
    buildDefaultPrefix(),
    buildAgentSdkCchPresetPrefix(),
    buildAgentSdkPrefix(),
  ])
}

export function getCLISyspromptPrefix(options?: {
  isNonInteractive: boolean
  hasAppendSystemPrompt: boolean
}): string {
  const apiProvider = getAPIProvider()
  if (apiProvider === 'vertex') {
    return buildDefaultPrefix()
  }

  if (options?.isNonInteractive) {
    if (options.hasAppendSystemPrompt) {
      return buildAgentSdkCchPresetPrefix()
    }
    return buildAgentSdkPrefix()
  }
  return buildDefaultPrefix()
}

/**
 * Check if attribution header is enabled.
 * Enabled by default, can be disabled via env var or GrowthBook killswitch.
 * Always disabled when the target endpoint is a machine-local or LAN engine
 * (loopback / RFC 1918 / localhost) — the billing header is meaningless
 * there and only exposes the client fingerprint to the self-hosted engine.
 */
function isAttributionHeaderEnabled(): boolean {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_ATTRIBUTION_HEADER)) {
    return false
  }
  if (process.env.ANTHROPIC_BASE_URL && isLocalEngineUrl(process.env.ANTHROPIC_BASE_URL)) {
    return false
  }
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_attribution_header', true)
}

/**
 * Get attribution header for API requests.
 * Returns a header string with cc_version (including fingerprint) and cc_entrypoint.
 * Enabled by default, can be disabled via env var or GrowthBook killswitch.
 *
 * Includes a `cch=00000` placeholder. Before the request is sent,
 * signClaudeCodeCCHBody overwrites the zeros with a computed hash.
 * The server verifies this token to confirm the request came from a real
 * Claude Code client.
 */
export function getAttributionHeader(fingerprint: string): string {
  if (!isAttributionHeaderEnabled()) {
    return ''
  }

  const entrypoint = process.env.CLAUDE_CODE_ENTRYPOINT ?? 'unknown'

  // cc_workload: turn-scoped hint so the API can route e.g. cron-initiated
  // requests to a lower QoS pool. Absent = interactive default. Safe re:
  // fingerprint (computed from msg chars + version only) and cch signature
  // (placeholder overwritten in serialized body bytes after this string is
  // built). Server _parse_cc_header tolerates unknown extra fields so old API
  // deploys silently ignore this.
  const header = formatClaudeCodeBillingHeader({
    fingerprint,
    entrypoint,
    workload: getWorkload(),
  })

  logForDebugging(`attribution header ${header}`)
  return header
}
