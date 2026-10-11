# 22-autocompact-window-tiers — 上下文压缩阈值按窗口分档（链位 22，`22-autocompact-window-tiers.patch`，+144/−26，2 文件）

> 功能组：pr-7 — vcc 算法压缩（pi-vcc 移植 + 窗口分档 + 降级兜底 + 校准脚本）（pr-prepare/pr-7/）
> 链位 22，patch `22-autocompact-window-tiers.patch`（本目录）

- **需求背景**：`autoCompact.ts` 的缓冲 `AUTOCOMPACT_BUFFER_TOKENS` 固定 13K、与窗口大小无关——512K 窗口下仅剩 ~2.5% 才触发（太晚），32K 小窗口下 13K=41%（靠 `cap` 到 `window/3` 兜底，语义含糊）。用户要求按窗口分档设定软触发（剩余百分比）与硬触发（剩余绝对量）。
- **方案**（要点）：
  - 5 档分档表 `AUTOCOMPACT_TIERS`：≤100K 13%/<13K、≤200K 17%/<32K、≤300K 21%/<36K、≤500K 17%/<53K（用户定稿）、≥500K 15%/<65K。
  - 三个口径：分档键 = **声明窗口**（`getResolvedContextWindow()` 新增，不扣摘要预留）；阈值算在**有效窗口**（已扣预留）；硬触发 `getForcedCompactThreshold()` 算在声明窗口，并以 `max(..., 软)` 钳制保证永不早于软触发。
  - 小窗口安全钳制：软阈值取 `min(档位阈值, window − min(13K, window/3))`，小窗口阈值与旧实现逐字节一致（8K/16K/16.5K/35K/47K），零回归。
  - `calculateTokenWarningState()` 新增 `isAtForcedCompactLimit` 出口；`percentLeft` 分母由 threshold 改为有效窗口（原实现到压缩点显示 0%，与「剩 13%」语义相悖）；`shouldAutoCompact()` 触发条件改为软 ∥ 硬。
- **验证**：`bun test src/services/compact/` 17/17 通过（含 12 个 autoCompact 用例 + 新增分档专项用例）；`analyzeContext` + `inProcessRunner` 25/25；`tsc --noEmit` 改动文件 0 错；小窗口 5 个用例（16K/32K/33K/64K/80K）未改动即通过，证明安全钳制保住原行为。换算表已在文档中按 8 个模型逐一核对（如 1M 窗口：软 833,000 / 硬 935,000）。
