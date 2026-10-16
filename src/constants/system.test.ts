import { describe, expect, test } from 'bun:test'
import { CLAUDE_CODE_COMPAT_VERSION } from './claudeCodeCompatibility.js'
import { getAttributionHeader } from './system.js'

describe('getAttributionHeader', () => {
  test('tracks the audited upstream Claude Code compatibility release', () => {
    expect(CLAUDE_CODE_COMPAT_VERSION).toBe('2.1.281')
  })

  test('uses Claude Code compatibility version and always includes CCH placeholder', () => {
    const originalEntrypoint = process.env.CLAUDE_CODE_ENTRYPOINT
    const originalAttribution = process.env.CLAUDE_CODE_ATTRIBUTION_HEADER
    const originalBaseUrl = process.env.ANTHROPIC_BASE_URL
    process.env.CLAUDE_CODE_ENTRYPOINT = 'cli'
    // The desktop app exports CLAUDE_CODE_ATTRIBUTION_HEADER=0 into its
    // processes; a falsy inherited value would disable the header and break
    // this default-enabled assertion, so pin it on for the test.
    process.env.CLAUDE_CODE_ATTRIBUTION_HEADER = '1'
    // The desktop app also exports a loopback proxy as ANTHROPIC_BASE_URL;
    // the private-network override would then suppress the header, so pin a
    // non-local endpoint to keep testing the default-enabled path.
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'

    try {
      expect(getAttributionHeader('abc')).toBe(
        'x-anthropic-billing-header: cc_version=2.1.281.abc; cc_entrypoint=cli; cch=00000;',
      )
    } finally {
      if (originalEntrypoint === undefined) delete process.env.CLAUDE_CODE_ENTRYPOINT
      else process.env.CLAUDE_CODE_ENTRYPOINT = originalEntrypoint
      if (originalAttribution === undefined) delete process.env.CLAUDE_CODE_ATTRIBUTION_HEADER
      else process.env.CLAUDE_CODE_ATTRIBUTION_HEADER = originalAttribution
      if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = originalBaseUrl
    }
  })

  test('returns an empty header on a private-network endpoint even when enabled', () => {
    const originalAttribution = process.env.CLAUDE_CODE_ATTRIBUTION_HEADER
    const originalBaseUrl = process.env.ANTHROPIC_BASE_URL
    process.env.CLAUDE_CODE_ATTRIBUTION_HEADER = '1'
    process.env.ANTHROPIC_BASE_URL = 'http://192.168.1.50:8000/v1'

    try {
      expect(getAttributionHeader('abc')).toBe('')
    } finally {
      if (originalAttribution === undefined) delete process.env.CLAUDE_CODE_ATTRIBUTION_HEADER
      else process.env.CLAUDE_CODE_ATTRIBUTION_HEADER = originalAttribution
      if (originalBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL
      else process.env.ANTHROPIC_BASE_URL = originalBaseUrl
    }
  })
})
