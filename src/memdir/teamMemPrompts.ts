import {
  buildSearchingPastContextSection,
  DIRS_EXIST_GUIDANCE,
  ENTRYPOINT_NAME,
  MAX_ENTRYPOINT_LINES,
} from './memdir.js'
import {
  MEMORY_DRIFT_CAVEAT,
  buildMemoryFrontmatterExample,
  buildTrustingRecallSection,
  buildCombinedTypesSection,
  buildWhatNotToSaveSection,
} from './memoryTypes.js'
import { localizedPrompt } from '../prompts/i18n/index.js'
import { getAutoMemPath } from './paths.js'
import { getTeamMemPath } from './teamMemPaths.js'

/**
 * Build the combined prompt when both auto memory and team memory are enabled.
 * Closed four-type taxonomy (user / feedback / project / reference) with
 * per-type <scope> guidance embedded in XML-style <type> blocks.
 */
export function buildCombinedMemoryPrompt(
  extraGuidelines?: string[],
  skipIndex = false,
): string {
  const autoDir = getAutoMemPath()
  const teamDir = getTeamMemPath()

  const howToSave = skipIndex
    ? [
        localizedPrompt('memdir.howToSave.header', '## How to save memories'),
        '',
        localizedPrompt(
          'memdir.combined.howToSave.writeEach',
          "Write each memory to its own file in the chosen directory (private or team, per the type's scope guidance) using this frontmatter format:",
        ),
        '',
        ...buildMemoryFrontmatterExample(),
        '',
        localizedPrompt('memdir.howToSave.keepFields', '- Keep the name, description, and type fields in memory files up-to-date with the content'),
        localizedPrompt('memdir.howToSave.organize', '- Organize memory semantically by topic, not chronologically'),
        localizedPrompt('memdir.howToSave.updateRemove', '- Update or remove memories that turn out to be wrong or outdated'),
        localizedPrompt('memdir.howToSave.noDuplicates', '- Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one.'),
      ]
    : [
        localizedPrompt('memdir.howToSave.header', '## How to save memories'),
        '',
        localizedPrompt('memdir.howToSave.twoStep', 'Saving a memory is a two-step process:'),
        '',
        localizedPrompt(
          'memdir.combined.howToSave.step1',
          "**Step 1** — write the memory to its own file in the chosen directory (private or team, per the type's scope guidance) using this frontmatter format:",
        ),
        '',
        ...buildMemoryFrontmatterExample(),
        '',
        localizedPrompt(
          'memdir.combined.howToSave.step2',
          `**Step 2** — add a pointer to that file in the same directory's \`${ENTRYPOINT_NAME}\`. Each directory (private and team) has its own \`${ENTRYPOINT_NAME}\` index — each entry should be one line, under ~150 characters: \`- [Title](file.md) — one-line hook\`. They have no frontmatter. Never write memory content directly into a \`${ENTRYPOINT_NAME}\`.`,
          { entrypoint: ENTRYPOINT_NAME },
        ),
        '',
        localizedPrompt(
          'memdir.combined.howToSave.entrypointLoaded',
          `- Both \`${ENTRYPOINT_NAME}\` indexes are loaded into your conversation context — lines after ${MAX_ENTRYPOINT_LINES} will be truncated, so keep them concise`,
          { entrypoint: ENTRYPOINT_NAME, maxLines: MAX_ENTRYPOINT_LINES },
        ),
        localizedPrompt('memdir.howToSave.keepFields', '- Keep the name, description, and type fields in memory files up-to-date with the content'),
        localizedPrompt('memdir.howToSave.organize', '- Organize memory semantically by topic, not chronologically'),
        localizedPrompt('memdir.howToSave.updateRemove', '- Update or remove memories that turn out to be wrong or outdated'),
        localizedPrompt('memdir.howToSave.noDuplicates', '- Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one.'),
      ]

  const lines = [
    localizedPrompt('memdir.combined.title', '# Memory'),
    '',
    localizedPrompt(
      'memdir.combined.dirLine',
      `You have a persistent, file-based memory system with two directories: a private directory at \`${autoDir}\` and a shared team directory at \`${teamDir}\`. ${DIRS_EXIST_GUIDANCE}`,
      { autoDir, teamDir, guidance: localizedPrompt('memdir.dirsExistGuidance', DIRS_EXIST_GUIDANCE) },
    ),
    '',
    localizedPrompt(
      'memdir.buildUp',
      "You should build up this memory system over time so that future conversations can have a complete picture of who the user is, how they'd like to collaborate with you, what behaviors to avoid or repeat, and the context behind the work the user gives you.",
    ),
    '',
    localizedPrompt(
      'memdir.rememberImmediately',
      'If the user explicitly asks you to remember something, save it immediately as whichever type fits best. If they ask you to forget something, find and remove the relevant entry.',
    ),
    '',
    localizedPrompt('memdir.combined.scopeHeader', '## Memory scope'),
    '',
    localizedPrompt('memdir.combined.scopeIntro', 'There are two scope levels:'),
    '',
    localizedPrompt(
      'memdir.combined.scopePrivate',
      `- private: memories that are private between you and the current user. They persist across conversations with only this specific user and are stored at the root \`${autoDir}\`.`,
      { autoDir },
    ),
    localizedPrompt(
      'memdir.combined.scopeTeam',
      `- team: memories that are shared with and contributed by all of the users who work within this project directory. Team memories are synced at the beginning of every session and they are stored at \`${teamDir}\`.`,
      { teamDir },
    ),
    '',
    ...buildCombinedTypesSection(),
    ...buildWhatNotToSaveSection(),
    localizedPrompt(
      'memdir.combined.sensitiveData',
      '- You MUST avoid saving sensitive data within shared team memories. For example, never save API keys or user credentials.',
    ),
    '',
    ...howToSave,
    '',
    localizedPrompt('memdir.whenToAccess.header', '## When to access memories'),
    localizedPrompt(
      'memdir.combined.whenRelevant',
      '- When memories (personal or team) seem relevant, or the user references prior work with them or others in their organization.',
    ),
    localizedPrompt(
      'memdir.whenToAccess.must',
      '- You MUST access memory when the user explicitly asks you to check, recall, or remember.',
    ),
    localizedPrompt(
      'memdir.whenToAccess.ignore',
      '- If the user says to *ignore* or *not use* memory: proceed as if MEMORY.md were empty. Do not apply remembered facts, cite, compare against, or mention memory content.',
    ),
    MEMORY_DRIFT_CAVEAT,
    '',
    ...buildTrustingRecallSection(),
    '',
    localizedPrompt('memdir.persist.header', '## Memory and other forms of persistence'),
    localizedPrompt(
      'memdir.persist.intro',
      'Memory is one of several persistence mechanisms available to you as you assist the user in a given conversation. The distinction is often that memory can be recalled in future conversations and should not be used for persisting information that is only useful within the scope of the current conversation.',
    ),
    localizedPrompt(
      'memdir.persist.plan',
      '- When to use or update a plan instead of memory: If you are about to start a non-trivial implementation task and would like to reach alignment with the user on your approach you should use a Plan rather than saving this information to memory. Similarly, if you already have a plan within the conversation and you have changed your approach persist that change by updating the plan rather than saving a memory.',
    ),
    localizedPrompt(
      'memdir.persist.tasks',
      '- When to use or update tasks instead of memory: When you need to break your work in current conversation into discrete steps or keep track of your progress use tasks instead of saving to memory. Tasks are great for persisting information about the work that needs to be done in the current conversation, but memory should be reserved for information that will be useful in future conversations.',
    ),
    ...(extraGuidelines ?? []),
    '',
    ...buildSearchingPastContextSection(autoDir),
  ]

  return lines.join('\n')
}
