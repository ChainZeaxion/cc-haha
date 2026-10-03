/**
 * Persisted four-class density pool for the live usage estimator.
 *
 * The estimator needs to know what a character costs, and the honest way to
 * learn that is from real completions: each contributes what it contained (by
 * character class) and what the engine's `usage` reports it really cost. Twenty
 * recent samples fit four numbers well and stay negligible in size — a few
 * hundred integers per model.
 *
 * "Semi-persistent" on purpose: held in memory, flushed to storage on a short
 * throttle so a burst of completions cannot thrash it, and dropped wholesale
 * when the stored shape is not ours (a future build's payload is not ours to
 * reinterpret — cheaper to re-learn than to guess).
 *
 * Kept apart from `tpsCalibration` (the TPS meter's older two-term fit) so the
 * two can be migrated independently.
 */
import {
  densityForSamples,
  type Density,
  type DensitySample,
  PRIOR_DENSITY,
} from '../../../src/shared/tokenDensity'

export const TPS_DENSITY_STORAGE_KEY = 'cc-haha.tpsDensity'
export const TPS_DENSITY_VERSION = 1
/** Rolling window per model: enough to fit four densities, small enough to be free. */
export const TPS_DENSITY_POOL_MAX = 20
/** Models kept before the least recently updated are dropped. */
const MAX_MODELS = 32
const UNKNOWN_MODEL = '__default__'
const WRITE_THROTTLE_MS = 2_000

type DensityEntry = { samples: DensitySample[]; updatedAt: number }
type DensityStore = { version: number; models: Record<string, DensityEntry> }

let cache: DensityStore | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null

function emptyStore(): DensityStore {
  return { version: TPS_DENSITY_VERSION, models: {} }
}

function modelKey(model: string | null | undefined): string {
  const trimmed = model?.trim()
  return trimmed ? trimmed : UNKNOWN_MODEL
}

function readStore(): DensityStore {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(TPS_DENSITY_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<DensityStore> | null) : null
    if (
      !parsed ||
      parsed.version !== TPS_DENSITY_VERSION ||
      typeof parsed.models !== 'object' ||
      !parsed.models
    ) {
      cache = emptyStore()
    } else {
      cache = { version: TPS_DENSITY_VERSION, models: parsed.models as Record<string, DensityEntry> }
    }
  } catch {
    cache = emptyStore()
  }
  return cache
}

function flushSoon(): void {
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    try {
      if (cache) localStorage.setItem(TPS_DENSITY_STORAGE_KEY, JSON.stringify(cache))
    } catch {
      /* storage unavailable — the in-memory pool still serves this session */
    }
  }, WRITE_THROTTLE_MS)
  ;(writeTimer as { unref?: () => void }).unref?.()
}

/** The samples remembered for `model`, oldest first. */
export function loadTpsSamples(model: string | null | undefined): DensitySample[] {
  return readStore().models[modelKey(model)]?.samples ?? []
}

/**
 * The density to estimate with right now: the learned fit once the pool is
 * mature (see `densityForSamples`), the prior before that.
 */
export function currentTpsDensity(model: string | null | undefined): Density {
  return densityForSamples(loadTpsSamples(model), PRIOR_DENSITY)
}

/** Record one completed response: what it held by class, and its real token cost. */
export function recordTpsSample(
  model: string | null | undefined,
  counts: DensitySample['counts'],
  tokens: number,
): void {
  if (!(tokens > 0)) return
  const store = readStore()
  const key = modelKey(model)
  const previous = store.models[key]
  const samples = previous ? [...previous.samples, { counts, tokens }] : [{ counts, tokens }]
  store.models[key] = {
    samples: samples.slice(-TPS_DENSITY_POOL_MAX),
    updatedAt: Date.now(),
  }
  evictStaleModels(store)
  flushSoon()
}

function evictStaleModels(store: DensityStore): void {
  const keys = Object.keys(store.models)
  if (keys.length <= MAX_MODELS) return
  keys
    .sort((a, b) => (store.models[a]?.updatedAt ?? 0) - (store.models[b]?.updatedAt ?? 0))
    .slice(0, keys.length - MAX_MODELS)
    .forEach((stale) => {
      delete store.models[stale]
    })
}

/** Drop every remembered pool (tests / troubleshooting). */
export function clearTpsDensity(): void {
  cache = emptyStore()
  try {
    localStorage.removeItem(TPS_DENSITY_STORAGE_KEY)
  } catch {
    /* storage unavailable */
  }
}

/** Test seam: forget the in-memory cache so cases do not share it. */
export function resetTpsDensityForTests(): void {
  cache = null
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
}
