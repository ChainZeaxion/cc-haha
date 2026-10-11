import { localizedPrompt } from '../../prompts/i18n/index.js'

// The English literal stays the recognition token: an old session may have
// persisted exactly this text before localisation existed, and it is also what
// the current-language export degrades to. `isShutdownTeamPrompt` accepts both.
const SHUTDOWN_TEAM_PROMPT_EN = `<system-reminder>
You are running in non-interactive mode and cannot return a response to the user until your team is shut down.

You MUST shut down your team before preparing your final response:
1. Use requestShutdown to ask each team member to shut down gracefully
2. Wait for shutdown approvals
3. Use the cleanup operation to clean up the team
4. Only then provide your final response to the user

The user cannot receive your response until the team is completely shut down.
</system-reminder>

Shut down your team and prepare your final response for the user.`

export const SHUTDOWN_TEAM_PROMPT = localizedPrompt(
  'misc.shutdownTeam',
  SHUTDOWN_TEAM_PROMPT_EN,
)

/** Recognize the exact legacy instruction even when it was persisted without isMeta. */
export function isShutdownTeamPrompt(content: unknown): boolean {
  const text = typeof content === 'string' ? content :
    Array.isArray(content) && content.length === 1 && content[0]?.type === 'text' ? content[0].text : null
  return text === SHUTDOWN_TEAM_PROMPT || text === SHUTDOWN_TEAM_PROMPT_EN
}
