import type { RequestCompatibility, SavedProvider } from './types/provider.js'

export type ApiRequestContext = { remoteBrowser?: boolean }
const READ_SETTINGS = ['alwaysThinkingEnabled', 'workflowKeywordTriggerEnabled', 'autoDreamEnabled', 'skipAutoPermissionPrompt', 'chatSendBehavior', 'outputStyle', 'skipWebFetchPreflight', 'language']
// `skipAutoPermissionPrompt` is writable so the H5 "auto mode" opt-in dialog can
// persist from the phone; it only flips a persistent userSettings boolean, same
// risk class as the other booleans below.
const WRITE_SETTINGS = new Set(['language', 'chatSendBehavior', 'alwaysThinkingEnabled', 'workflowKeywordTriggerEnabled', 'outputStyle', 'skipAutoPermissionPrompt'])
const RESERVED_PROVIDER_PATHS = new Set(['settings', 'cc-switch', 'test', 'models', 'presets', 'auth-status', 'official', 'reorder'])
const REMOTE_COMPATIBILITY_KEYS = new Set(['maxOutputTokens', 'outputTokenLimit', 'outputTokenField', 'sampling', 'reasoning', 'parallelTools', 'structuredOutput'])

/** The browser replaces the fields it can edit, while hidden extensions stay on the desktop. */
export function replaceRemoteCompatibility(current: RequestCompatibility | undefined, input: Record<string, unknown> | null) {
  const hidden = Object.fromEntries(Object.entries(current ?? {}).filter(([key]) => !REMOTE_COMPATIBILITY_KEYS.has(key)))
  const editable = Object.fromEntries(Object.entries(input ?? {}).filter(([key]) => REMOTE_COMPATIBILITY_KEYS.has(key)))
  const result = { ...hidden, ...editable }
  return Object.keys(result).length ? result : null
}

export function remoteProviderRouteAllowed(parts: string[], method: string): boolean {
  const id = parts[2]
  if (!id) return method === 'GET' || method === 'POST'
  if (parts.length === 3) {
    if (['presets', 'auth-status'].includes(id)) return method === 'GET'
    if (id === 'official') return method === 'POST'
    if (id === 'reorder') return method === 'PUT'
    return !RESERVED_PROVIDER_PATHS.has(id) && ['GET', 'PUT', 'DELETE'].includes(method)
  }
  return parts.length === 4 && !RESERVED_PROVIDER_PATHS.has(id) && parts[3] === 'activate' && method === 'POST'
}

export function remoteSettingsRouteAllowed(parts: string[], method: string): boolean {
  return parts.length === 3 && parts[2] === 'user' && ['GET', 'PUT'].includes(method)
}

const DESKTOP_TERMINAL_SHELLS = ['', 'system', 'pwsh', 'powershell', 'cmd', 'custom']

function isDesktopTerminalPatch(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  if (entry.startupShell !== undefined && !DESKTOP_TERMINAL_SHELLS.includes(entry.startupShell as string)) return false
  if (entry.customShellPath !== undefined && entry.customShellPath !== null && typeof entry.customShellPath !== 'string') return false
  if (entry.startupShell === 'custom') {
    const customShellPath = typeof entry.customShellPath === 'string' ? entry.customShellPath.trim() : ''
    if (!customShellPath) return false
  }
  return true
}

export function projectRemoteSettings(settings: Record<string, unknown>) {
  const result = Object.fromEntries(READ_SETTINGS.filter(key => ['string', 'boolean', 'number'].includes(typeof settings[key])).map(key => [key, settings[key]]))
  if (isDesktopTerminalPatch(settings.desktopTerminal)) {
    result.desktopTerminal = { ...(settings.desktopTerminal as Record<string, unknown>) }
  }
  return result
}

export function validateRemoteSettingsPatch(input: Record<string, unknown>): boolean {
  return Object.entries(input).every(([key, value]) => {
    if (key === 'desktopTerminal') return isDesktopTerminalPatch(value)
    if (!WRITE_SETTINGS.has(key)) return false
    if (key === 'language') return typeof value === 'string' && value.length <= 80
    if (key === 'outputStyle') return typeof value === 'string' && ['default', 'Explanatory', 'Learning'].includes(value)
    if (key === 'chatSendBehavior') return value === 'enter' || value === 'modifierEnter'
    return typeof value === 'boolean'
  })
}
export function projectRemoteProvider(provider: SavedProvider) {
  const publicKeys = [
    'id', 'presetId', 'name', 'authStrategy', 'baseUrl', 'apiFormat', 'runtimeKind', 'models',
    'model1mSupport', 'autoCompactWindow', 'modelContextWindows', 'toolSearchEnabled',
    'disableExperimentalBetas', 'supportsNestedToolResultMedia', 'notes',
  ] as const
  return {
    ...Object.fromEntries(publicKeys.filter(key => provider[key] !== undefined).map(key => [key, provider[key]])),
    apiKey: '',
    hasApiKey: !!provider.apiKey,
    ...(provider.requestCompatibility ? {
      requestCompatibility: Object.fromEntries([...REMOTE_COMPATIBILITY_KEYS].filter(key => provider.requestCompatibility![key] !== undefined).map(key => [key, provider.requestCompatibility![key]])),
    } : {}),
    ...(provider.imageGeneration ? {
      imageGeneration: {
        model: provider.imageGeneration.model,
        ...(provider.imageGeneration.baseUrl !== undefined ? { baseUrl: provider.imageGeneration.baseUrl } : {}),
        apiKey: '', hasApiKey: !!provider.imageGeneration.apiKey,
      },
    } : {}),
  }
}
