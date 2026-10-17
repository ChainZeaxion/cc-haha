import { ApiError, api, getApiUrl, getAuthToken } from './client'
import type { VoicePreferences } from './voice'

export type SidebarProjectPreferences = {
  projectOrder: string[]
  pinnedProjects: string[]
  hiddenProjects: string[]
  projectOrganization: 'project' | 'recentProject' | 'time'
  projectSortBy: 'createdAt' | 'updatedAt'
}

export type DesktopProfilePreferences = {
  displayName: string
  subtitle: string
  avatarFile: string | null
  avatarUpdatedAt: string | null
}

export type DesktopPetPreferences = {
  enabled: boolean
  selectedPetId: string
  size: number
  showTaskPanel: boolean
  collapsed: boolean
  motionEnabled: boolean
  lastSessionId: string | null
}

export type DesktopUiPreferences = {
  schemaVersion: number
  sidebar: SidebarProjectPreferences
  profile: DesktopProfilePreferences
  pet: DesktopPetPreferences
  /** Absent when talking to a server older than the voice input feature. */
  voiceInput?: VoicePreferences
  projectDisplayNames: Record<string, string>
}

export type DesktopUiPreferencesResponse = {
  preferences: DesktopUiPreferences
  exists: boolean
}

export type DesktopPetPreferencesResponse = {
  exists: boolean
  pet: DesktopPetPreferences
}

export type DesktopPetPreferencesUpdateResponse =
  | { ok: true; preferences: DesktopUiPreferences }
  | { ok: true; pet: DesktopPetPreferences }

export type ProjectDisplayNameUpdateResponse = {
  ok: true
  projectKey: string
  displayName: string | null
}

/** `auto` follows the UI locale; `zh`/`en` pin the reasoning language. */
export type ThinkingLanguageSetting = 'auto' | 'zh' | 'en'

/**
 * `auto` derives the prompt language from the UI locale (the original
 * behaviour); `zh`/`en` pin it regardless of the locale.
 */
export type PromptLanguageSetting = 'auto' | 'zh' | 'en'

export const desktopUiPreferencesApi = {
  getPreferences() {
    return api.get<DesktopUiPreferencesResponse>('/api/desktop-ui/preferences')
  },

  getPetPreferences() {
    return api.get<DesktopPetPreferencesResponse>('/api/desktop-ui/preferences/pet')
  },

  /**
   * Tell the server which UI language is set.
   *
   * The renderer's own storage is invisible to the sidecar that assembles the
   * model prompts, so the choice has to be sent over. Returns the resolved
   * prompt language so a caller (or a test) can see it took effect.
   */
  updateLocalePreference(locale: string | null) {
    return api.put<{ ok: true; locale: string | null; promptLanguage: 'en' | 'zh' }>(
      '/api/desktop-ui/preferences/locale',
      { locale },
    )
  },

  /**
   * The language the model should reason in, independent of the UI language.
   * `auto` follows the UI locale; `zh`/`en` pin it.
   */
  getThinkingLanguage() {
    return api.get<{ exists: boolean; thinkingLanguage: ThinkingLanguageSetting }>(
      '/api/desktop-ui/preferences/thinking-language',
    )
  },

  updateThinkingLanguagePreference(thinkingLanguage: ThinkingLanguageSetting) {
    return api.put<{ ok: true; thinkingLanguage: ThinkingLanguageSetting; locale: string | null }>(
      '/api/desktop-ui/preferences/thinking-language',
      { thinkingLanguage },
    )
  },

  /**
   * Whether tool-continuation turns think on a self-hosted engine. `false`
   * (default) sends `enable_thinking: false` on those turns to skip the
   * thinking preamble; `true` keeps the engine default.
   */
  getToolTurnThinking() {
    return api.get<{ exists: boolean; toolTurnThinking: boolean }>(
      '/api/desktop-ui/preferences/tool-turn-thinking',
    )
  },

  updateToolTurnThinking(toolTurnThinking: boolean) {
    return api.put<{ ok: true; toolTurnThinking: boolean; locale: string | null }>(
      '/api/desktop-ui/preferences/tool-turn-thinking',
      { toolTurnThinking },
    )
  },

  /** The language the built-in model prompts render in, independent of the UI. */
  getPromptLanguage() {
    return api.get<{ exists: boolean; promptLanguage: PromptLanguageSetting }>(
      '/api/desktop-ui/preferences/prompt-language',
    )
  },

  updatePromptLanguagePreference(promptLanguage: PromptLanguageSetting) {
    return api.put<{ ok: true; promptLanguage: PromptLanguageSetting; locale: string | null }>(
      '/api/desktop-ui/preferences/prompt-language',
      { promptLanguage },
    )
  },

  updateSidebarPreferences(sidebar: SidebarProjectPreferences) {
    return api.put<{ ok: true; preferences: DesktopUiPreferences }>(
      '/api/desktop-ui/preferences/sidebar',
      sidebar,
    )
  },

  updateProjectDisplayName(projectKey: string, displayName: string | null) {
    return api.put<ProjectDisplayNameUpdateResponse>(
      '/api/desktop-ui/preferences/project-display-name',
      { projectKey, displayName },
    )
  },

  updateProfilePreferences(profile: Pick<DesktopProfilePreferences, 'displayName' | 'subtitle'>) {
    return api.put<{ ok: true; preferences: DesktopUiPreferences }>(
      '/api/desktop-ui/preferences/profile',
      profile,
    )
  },

  updatePetPreferences(pet: Partial<DesktopPetPreferences>) {
    return api.put<DesktopPetPreferencesUpdateResponse>(
      '/api/desktop-ui/preferences/pet',
      pet,
    )
  },

  async uploadProfileAvatar(file: File) {
    return uploadProfileAvatar(file)
  },

  deleteProfileAvatar() {
    return api.delete<{ ok: true; preferences: DesktopUiPreferences }>(
      '/api/desktop-ui/preferences/profile/avatar',
    )
  },
}

export function getProfileAvatarUrl(updatedAt: string | null | undefined) {
  const suffix = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : ''
  return getApiUrl(`/api/desktop-ui/preferences/profile/avatar${suffix}`)
}

async function uploadProfileAvatar(file: File): Promise<{ ok: true; preferences: DesktopUiPreferences }> {
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
  }
  const token = getAuthToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(getApiUrl('/api/desktop-ui/preferences/profile/avatar'), {
    method: 'PUT',
    headers,
    body: file,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => res.text())
    throw new ApiError(res.status, body)
  }

  return res.json() as Promise<{ ok: true; preferences: DesktopUiPreferences }>
}
