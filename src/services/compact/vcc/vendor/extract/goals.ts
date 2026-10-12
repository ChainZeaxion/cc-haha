// Vendored from @sting8k/pi-vcc@0.8.0 (MIT). Do not edit by hand.
// @ts-nocheck
import type { NormalizedBlock } from "../types";
import { nonEmptyLines, clip } from "../core/content";
import { collapseSkillLines } from "../core/skill-collapse";

const SCOPE_CHANGE_RE =
  /\b(instead|actually|change of plan|forget that|new task|switch to|now I want|pivot|let'?s do|stop .* and)\b/i;

const TASK_RE =
  /\b(fix|implement|add|create|build|refactor|debug|investigate|update|remove|delete|migrate|deploy|test|write|set up)\b/i;

// ─── LOCAL EDIT (cc-haha) ─────────────────────────────────────────────────
// Upstream's intent lists are English-only, so a Chinese session never emitted
// a later [Scope change]: its Session Goal stayed pinned to the first six lines
// of the session, forever, while an English session kept updating. The lists
// below mirror the English ones. `\b` is deliberately absent — it is an ASCII
// word boundary and never matches between two CJK characters, so `\b修复\b`
// would match nothing.
const SCOPE_CHANGE_RE_ZH =
  /(改为|改成|改用|换成|换一个|反过来|其实|不如|算了|新任务|切换|重新|不再|先不|暂时不)/;

const TASK_RE_ZH =
  /(修复|修一下|实现|新增|添加|加上|加个|创建|新建|构建|重构|调试|排查|调查|更新|升级|移除|删除|迁移|部署|测试|编写|设置|配置|优化|支持|补上|补充|拆成|拆分|抽取|合并|提取|替换|改写|清理|整理|接入|对接|去掉|调整|改进|完善|适配)/;

// A CJK glyph carries roughly twice the information of one Latin character, so
// a bare `length` bar calibrated on English rejects ordinary Chinese asks
// outright: "修复移动端页面的下载按钮。" is 13 chars but a complete
// instruction. Counting CJK as two keeps one threshold meaningful in both.
const intentLength = (s: string): number =>
  s.length + (s.match(/[\u4e00-\u9fff]/g)?.length ?? 0);

const NOISE_SHORT_RE = /^(ok|yes|no|sure|yeah|yep|go|hi|hey|thx|thanks|ok\b.*|y|n|k)\s*[.!?]*$/i;

// Reject lines that are clearly not user goals (pasted output, code, paths, tool dumps)
// or meta-prompt boilerplate (command templates like `/issues` that start with "For each issue:"
// followed by numbered "Read the issue in full..." steps).
const NON_GOAL_RE =
  /^\s*[\[│├└─╭╰]|```|^\s*(=[A-Z]+\(|function |const |let |var |import |export |class )|^(https?:|file:|\/[A-Za-z])|\\n|^\s*For each\b|\bin full\b[^\n]*\b(comments|issue|issues|PRs?|linked)\b/;

// Signals that the rest of the user message is a command template (e.g. /issues),
// in which case we should stop collecting goals at the signal line.
const TEMPLATE_SIGNAL_RE =
  /^\s*(For each\b|Do NOT implement\b|Analyze and propose\b|If Task\/context\b|Output:\s*$)/i;

const truncateAtTemplate = (lines: string[]): string[] => {
  const idx = lines.findIndex((l) => TEMPLATE_SIGNAL_RE.test(l));
  return idx >= 0 ? lines.slice(0, idx) : lines;
};

const stripLeadingBullet = (line: string): string =>
  line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim();

const MAX_GOAL_CHARS = 200;

const isSubstantiveGoal = (text: string): boolean => {
  const t = text.trim();
  if (intentLength(t) <= 5) return false;
  if (t.length > MAX_GOAL_CHARS) return false;
  if (NOISE_SHORT_RE.test(t)) return false;
  if (NON_GOAL_RE.test(t)) return false;
  return true;
};

// Test scope-change / task intent only on the leading portion of a user block
// so that pasted outputs below the actual instruction do not trigger matches.
const LEADING_CHARS = 200;

// ─── LOCAL EDIT (cc-haha) ─────────────────────────────────────────────────
// Upstream's bar is `lines[0].length > 15`, calibrated on English words. The
// same information in Chinese is fewer glyphs ("补充单元测试。" is 7 chars but a
// complete instruction), so Chinese gets a lower bar. English keeps its exact
// number — `intentLength` is the identity for pure-Latin text.
const TASK_MIN_LENGTH = 15;
const TASK_MIN_LENGTH_ZH = 12;
const taskLengthBar = (s: string): number =>
  /[\u4e00-\u9fff]/.test(s) ? TASK_MIN_LENGTH_ZH : TASK_MIN_LENGTH;

export const extractGoals = (blocks: NormalizedBlock[]): string[] => {
  const goals: string[] = [];
  let latestScopeChange: string[] | null = null;

  for (const b of blocks) {
    if (b.kind !== "user") continue;
    const rawLines = nonEmptyLines(b.text);
    const truncated = truncateAtTemplate(rawLines);
    const lines = collapseSkillLines(truncated.filter(isSubstantiveGoal))
      .map(stripLeadingBullet)
      .filter((l) => intentLength(l) > 5);
    if (lines.length === 0) continue;

    if (goals.length === 0) {
      goals.push(...lines.slice(0, 6));
      continue;
    }

    const leading = b.text.slice(0, LEADING_CHARS);
    if (SCOPE_CHANGE_RE.test(leading) || SCOPE_CHANGE_RE_ZH.test(leading)) {
      latestScopeChange = lines.slice(0, 3).map((l) => clip(l, MAX_GOAL_CHARS));
    } else if (
      (TASK_RE.test(leading) || TASK_RE_ZH.test(leading)) &&
      intentLength(lines[0]) > taskLengthBar(lines[0])
    ) {
      latestScopeChange = lines.slice(0, 2).map((l) => clip(l, MAX_GOAL_CHARS));
    }
  }

  // Only emit the [Scope change] marker when we actually captured bullets.
  if (latestScopeChange && latestScopeChange.length > 0) {
    goals.push("[Scope change]", ...latestScopeChange);
  }

  return goals.slice(0, 8);
};
