# 30-tps-centered-second-line — 费用/TPS 保持两行，TPS 第二行居中（链位 30，`30-tps-centered-second-line.patch`，2 文件 +6/−3）

> 功能组：pr-3 — TPS 实时解码速度指示器（真实 token 口径 + 125ms 分桶引擎）（pr-prepare/pr-3/）
> 链位 30，patch `30-tps-centered-second-line.patch`（本目录）

- **问题/需求**（用户 verbatim 意译）：费用信息宽度充足，其下方的 TPS 右对齐显得不对仗，应改为两行中 TPS 第二行**居中**显示。
- **方案**：仅改水平对齐——桌面 `ActiveSession.tsx` 与 H5 `AppShell.tsx` 外层 `flex-col items-end` → `items-center`；「上=费用、下=TPS」双行结构保留，`<TpsIndicator vertical />` 保留。外层宽度由最宽子项（费用徽章）决定，较窄的 TPS 行在费用徽章正下方居中。
- **验证**：TpsIndicator(4) + AppShell + ActiveSession(34) 三文件 vitest 60/60 全绿；35 链中该 patch 2 文件与工作树逐字节一致。
