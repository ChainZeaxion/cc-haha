// Engine-as-judge pass over partial-compaction summaries.
//
// The deterministic harness (vcc-slice-calibration.ts) can count files and refs
// but cannot say whether a summary is *usable*: whether it omits the thing the
// span was about, or states something the span contradicts. This asks the local
// engine to read a span and the summary of it and report that judgement.
//
// Deliberately separate from the calibration harness: that one must stay
// inference-free and runnable at any time; this one costs a model call per case
// and only makes sense on a spread of cases chosen by hand.
//
//   bun run scripts/vcc-slice-judge.ts [--count 8] [--endpoint http://127.0.0.1:8000]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'

import { runVccSliceCompaction } from '../src/services/compact/vcc/vccCompact.js'
import { loadCcGlobalIndexByUuid } from '../src/services/compact/vcc/ccGlobalIndex.js'

const args = process.argv.slice(2)
const argOf = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback
}

const COUNT = Number(argOf('count', '8'))
const ENDPOINT = argOf('endpoint', 'http://127.0.0.1:8000')
const MODEL = argOf('model', 'zxsv-ai')
const CORPUS = '/home/zeaxion/.claude/projects'
// Anchored to this file's own tree: the repo's preload chdirs to the caller's
// directory, so a relative output path lands outside the repo depending on
// where the script was invoked from.
const REPO_ROOT = join(dirname(import.meta.dir), '.')
const OUT = join(REPO_ROOT, 'modify/reports/vcc-slice-judge.md')

// A span is far larger than the judge can read, so it is bounded head+tail with
// the elision stated in the prompt. Enough to judge whether the summary covers
// what the span was about, which is a different question from "did it name
// every file" (the deterministic pass owns that).
const TRANSCRIPT_BUDGET = 120_000
const PER_MESSAGE_CHARS = 400

// A production partial compaction runs over the live window, which is bounded by
// the auto-compact threshold — not over a whole 24k-message session. Taking the
// pivot-outward 600 keeps the sampled slice at the size the feature actually
// meets, so the judge is not judging a view that only exists in a harness.
const SLICE_MAX_MESSAGES = 600

type Cc = { type: string; uuid?: string; message?: any; timestamp?: string }

const linesOf = (file: string): Cc[] => {
  const out: Cc[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue
    try {
      const o = JSON.parse(line) as Cc
      if ((o.type === 'user' || o.type === 'assistant') && o.message) out.push(o)
    } catch {
      // A corrupt line is not a message; skipping keeps the index aligned with
      // ccGlobalIndex, which also drops unparseable lines.
    }
  }
  return out
}

const clip = (text: string, limit = PER_MESSAGE_CHARS): string =>
  text.length <= limit ? text : `${text.slice(0, limit)}…[${text.length - limit} more chars]`

/** Render a span readably; the judge needs prose, not JSON. */
const render = (messages: Cc[]): string => {
  const parts: string[] = []
  for (const m of messages) {
    const role = m.type === 'user' ? 'user' : 'assistant'
    const content = m.message?.content
    if (typeof content === 'string') {
      parts.push(`[${role}] ${clip(content)}`)
      continue
    }
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (block?.type === 'text') parts.push(`[${role}] ${clip(block.text ?? '')}`)
      else if (block?.type === 'thinking') parts.push(`[thinking] ${clip(block.thinking ?? '')}`)
      else if (block?.type === 'tool_use') {
        parts.push(`* Tool "${block.name}" ${clip(JSON.stringify(block.input ?? {}), 300)}`)
      } else if (block?.type === 'tool_result') {
        const text = typeof block.content === 'string'
          ? block.content
          : JSON.stringify(block.content ?? '')
        parts.push(`  → ${clip(text, 300)}`)
      }
    }
  }
  const joined = parts.join('\n')
  if (joined.length <= TRANSCRIPT_BUDGET) return joined
  // Head and tail both matter: a span's goal is usually at its start and its
  // outcome at its end.
  const head = Math.floor(TRANSCRIPT_BUDGET * 0.4)
  const tail = TRANSCRIPT_BUDGET - head
  const dropped = joined.length - head - tail
  return `${joined.slice(0, head)}\n\n…[${dropped} chars elided from the middle]…\n\n${joined.slice(-tail)}`
}

const PROMPT = (transcript: string, summary: string): string => `You are reviewing one internal summary of a slice of a coding session.

Context you need to judge it fairly:
- The slice below is a *part* of a session. The other part is kept verbatim outside this summary, so the summary neither needs nor is allowed to describe it.
- The summary replaces the slice in the model's context. A reader who never sees the slice must be able to continue work from the summary alone.
- Short, structured, terse summaries are intended. Do NOT penalise brevity, bullet form, file lists, or terseness.
- Do NOT penalise the absence of things the slice never contains.

Report only real problems. Quote exact text when you flag something.

Answer with JSON only, no prose around it:
{
  "coverage": 1-5,        // how much of what the slice was actually about survives
  "missing": ["..."],     // most important things a reader would need and cannot get, most important first
  "falseClaims": ["..."], // statements the slice contradicts or does not support (quote them)
  "misleading": ["..."],  // statements that are technically true but would misdirect the reader
  "readability": 1-5,     // can a reader act on it
  "verdict": "usable" | "needs-work"
}

--- SLICE (what must be represented) ---
${transcript}

--- SUMMARY (what will represent it) ---
${summary}
`

const judge = async (
  transcript: string,
  summary: string,
): Promise<{ ok: boolean; raw: string }> => {
  const res = await fetch(`${ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: PROMPT(transcript, summary) }],
      temperature: 0,
      max_tokens: 1500,
      // Thinking off on purpose: the verdict is what is wanted, and on a
      // 120k-char prompt this build otherwise reasons until the allowance is
      // gone and the judgement never arrives.
      chat_template_kwargs: { enable_thinking: false },
    }),
    signal: AbortSignal.timeout(300_000),
  })
  if (!res.ok) return { ok: false, raw: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` }
  const body = (await res.json()) as any
  const choice = body?.choices?.[0]
  const message = choice?.message ?? {}
  const content = typeof message.content === 'string' && message.content.trim() !== ''
    ? message.content
    // A reasoning build can spend the whole allowance thinking and come back
    // with `content: null`; the answer is then in `reasoning` (this engine) or
    // `reasoning_content` (vLLM's usual key).
    : message.reasoning ?? message.reasoning_content ?? null
  if (typeof content !== 'string' || content.trim() === '') {
    return {
      ok: false,
      raw: `empty content (finish_reason=${choice?.finish_reason}, completion_tokens=${body?.usage?.completion_tokens})`,
    }
  }
  return { ok: true, raw: content }
}

const extractJson = (text: string): any | null => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

// Sessions largest-first, so the sampled cases are the ones with real content.
const sessions = readdirSync(CORPUS)
  .flatMap((dir) => {
    const full = join(CORPUS, dir)
    try {
      if (!statSync(full).isDirectory()) return []
      return readdirSync(full)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => join(full, f))
    } catch {
      return []
    }
  })
  .map((file) => ({ file, size: statSync(file).size }))
  .sort((a, b) => b.size - a.size)
  .slice(0, COUNT * 2)

async function main() {
  const cases: string[] = []
  for (const [i, session] of sessions.entries()) {
    if (cases.length >= COUNT) break
    const messages = linesOf(session.file)
    if (messages.length < 120) continue

    // Alternate direction so both sides of a pivot are represented, and take a
    // pivot well inside the session so each slice is substantial.
    const direction = i % 2 === 0 ? 'up_to' : 'from'
    const pivot = Math.floor(messages.length * 0.6)
    // Pivot outward: the 600 messages adjacent to the pivot, which is the
    // neighbourhood a person actually picks a pivot in.
    const slice = direction === 'up_to'
      ? messages.slice(Math.max(0, pivot - SLICE_MAX_MESSAGES), pivot)
      : messages.slice(pivot, pivot + SLICE_MAX_MESSAGES)

    const globalIndexByUuid = loadCcGlobalIndexByUuid(session.file)
    let result
    try {
      result = runVccSliceCompaction({ messages: slice as never, globalIndexByUuid })
    } catch (error) {
      console.log(`[judge] ${session.file.split('/').pop()} ${direction}@${pivot}: compaction threw — ${(error as Error).message}`)
      continue
    }

    const name = session.file.split('/').pop()!
    console.log(`[judge] ${name} ${direction}@${pivot} slice=${slice.length} msgs → summary ${result.summary.length} chars`)
    const judged = await judge(render(slice), result.summary)
    const parsed = judged.ok ? extractJson(judged.raw) : null
    cases.push(
      [
        `### ${name} — ${direction}@${pivot}`,
        '',
        `- Slice: ${slice.length} messages (pivot-outward cap ${SLICE_MAX_MESSAGES}), ${render(slice).length} chars rendered · Summary: ${result.summary.length} chars · compression ${(result.summary.length / render(slice).length * 100).toFixed(1)}%`,
        `- Sections: ${JSON.stringify(result.sections)}`,
        judged.ok
          ? `- Judge: ${parsed ? '```json\n' + JSON.stringify(parsed, null, 2) + '\n```' : 'raw: ' + judged.raw.slice(0, 1200)}`
          : `- Judge FAILED: ${judged.raw}`,
        '',
        '<details><summary>summary under review</summary>',
        '',
        '````',
        result.summary,
        '````',
        '',
        '</details>',
        '',
      ].join('\n'),
    )
  }

  const header = [
    '# Engine judgement of partial-compaction summaries',
    '',
    `Local engine \`${MODEL}\` at ${ENDPOINT}. ${cases.length} cases sampled from the largest sessions, alternating the pivot direction.`,
    '',
    'The engine sees the same span the compactor did and is asked to report coverage,',
    'unsupported statements and misdirection. It is a reading, not a measurement: the',
    'deterministic numbers live in `vcc-slice-calibration.md`.',
    '',
    '```',
    `bun run scripts/vcc-slice-judge.ts --count ${COUNT}`,
    '```',
    '',
    '---',
    '',
  ].join('\n')

  writeFileSync(OUT, header + cases.join('\n'))
  console.log(`[judge] wrote ${OUT} (${cases.length} cases)`)
}

void main()
