import { api } from '@/api/client'
import { randomId } from '@/lib/randomId'
import type { PermissionMode } from '@/types/settings'

export type SideChatSession = {
  sessionId: string
  parentSessionId: string
  workDir: string
  title: string
  ephemeral: true
  permissionMode?: PermissionMode
}
export const sideChatsApi = {
  create(parentSessionId: string) {
    return api.post<SideChatSession>(`/api/sessions/${encodeURIComponent(parentSessionId)}/side-chats`, { sideChatId: randomId() })
  },
  discard(parentSessionId: string, sideChatId: string) {
    return api.delete(`/api/sessions/${encodeURIComponent(parentSessionId)}/side-chats/${encodeURIComponent(sideChatId)}`)
  },
}
