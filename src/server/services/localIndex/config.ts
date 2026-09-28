import { delimiter, join } from 'node:path'
import { getCcHahaDir } from '../../../utils/envUtils.js'
import type { LocalIndexMode } from './types.js'

export const LOCAL_INDEX_INVALID_MODE = 'LOCAL_INDEX_INVALID_MODE' as const

export type LocalIndexModeResolution = {
  mode: LocalIndexMode
  warningCode: typeof LOCAL_INDEX_INVALID_MODE | null
}

export function resolveLocalIndexMode(
  value = process.env.CC_HAHA_LOCAL_INDEX,
): LocalIndexModeResolution {
  // SQLite is the normal product read path. Explicit modes remain available
  // only for deterministic parity/fallback tests and emergency diagnosis.
  if (value === undefined || value === 'on') {
    return { mode: 'on', warningCode: null }
  }
  if (value === 'off') {
    return { mode: 'off', warningCode: null }
  }
  if (value === 'shadow') {
    return { mode: value, warningCode: null }
  }
  return { mode: 'on', warningCode: LOCAL_INDEX_INVALID_MODE }
}

export function getLocalIndexDatabasePath(): string {
  return join(getCcHahaDir(), 'db', 'index-v1.sqlite')
}

/**
 * Extra `projects/` directories to index alongside the active config dir's own.
 *
 * A development instance runs with its own `CLAUDE_CONFIG_DIR`, which also makes
 * its discovery root its own — so its session list shows only the sessions that
 * instance created, and the conversations in the real config dir never appear.
 * Listing that dir's `projects/` here makes the dev server read and display the
 * real history while keeping the config dir (port, settings, database file)
 * separate. Read-only by itself: the listing only widens what discovery walks.
 */
export function resolveExtraProjectRoots(
  value = process.env.CC_HAHA_EXTRA_PROJECT_ROOTS,
): string[] {
  if (!value) return []
  return value
    .split(delimiter)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0)
}
