# vcc-calibration-scripts — vcc 校准脚本（原链位 59）

> 功能主题：`vcc` — vcc 算法压缩（`pr-prepare/vcc/`）｜ PR 分支 `vcc-compaction`
> **单一真相源 patch**：`modify/patches/vcc/vcc-calibration-scripts-patch1.patch`（3 文件 +1518−0）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 59 | `chapter-27-vcc-calibration-scripts` | 二十七 27.2：**vcc 片段模式校准/判分脚本**——`scripts/vcc-slice-calibration.ts`(1076 行) + `scripts/vcc-slice-judge.ts`(439 行)，随「局部压缩接入 vcc 片段模式 + 语料校准」引入；`.gitignore` 排除**机器生成的报告**（含会话原文与真实语料，入库的是手写版）。属**测量工具**而非产品代码，故原未纳入章节（3 文件） |

## 明细

### 原链位 59 — `chapter-27-vcc-calibration-scripts`

- **需求背景**：vcc 片段模式（局部压缩接入）的摘要质量需要**可复现的离线测量**：确定性指标（文件召回、杜撰、引用可解析性、是否越出片段、压缩比、段清单、Bash 参数噪音）+ 引擎裁判。历轮结论反复推翻的根因全是测量口径（`max_tokens` 截断、抽样漂移、切片尺寸差 12 倍），脚本把这些口径钉死后才能动参数。脚本属**测量工具**而非产品代码，此前只在「二十七章登记」未入链。
- **方案**（要点）：
  - `scripts/vcc-slice-calibration.ts`（1076 行）：语料 = `~/.claude/projects` 顶层会话，`bun run scripts/vcc-slice-calibration.ts --max 20`（20 会话/240 场景）；`--slice-chars` 默认 750000（切片尺寸必须与分数同报，且贴近生产口径）；裁判 `max_tokens=32768`、样本钉到 `vcc-slice-judge.sample.json`（`--resample` 才重抽）、judge `temperature:0`。
  - `scripts/vcc-slice-judge.ts`（439 行）：让引擎读同一片段评判摘要的覆盖/杜撰/误导/可读性，输出结构化 JSON；默认不嵌「summary under review」（`--embed-summaries` 才开，防语料外泄）。
  - `.gitignore`：排除**机器生成的报告**（机器输出含每个场景的摘要全文、引用会话原文，不入库；入库的是手写版报告）。
- **验证**：脚本产出的校准指标即优化项 1 的验收数据（240 场景 87.1%/88.9%/97.0%）；8 例引擎裁判 coverage 2.88 / readability 3.62；补丁 59 与链 1–57 相互独立（无人共享文件），可在任何位置应用。
