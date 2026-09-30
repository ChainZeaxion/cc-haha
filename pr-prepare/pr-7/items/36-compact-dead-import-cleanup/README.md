# 36-compact-dead-import-cleanup — 策略门禁 dead-imports 清零（链位 36，`36-compact-dead-import-cleanup.patch`，+1/−3，3 文件）

> 功能组：pr-7 — vcc 算法压缩（pi-vcc 移植 + 窗口分档 + 降级兜底 + 校准脚本）（pr-prepare/pr-7/）
> 链位 36，patch `36-compact-dead-import-cleanup.patch`（本目录）

- **需求背景**：`check:policy` 的 dead-imports 规则因十三章 vcc 移植遗留的 3 处未引用导入一直红：`compact.ts` 的 `isEnvTruthy`、`vcc/vendor/core/build-sections.ts` 的 `clip`、`vcc/vendor/types.ts` 的 `Message`。该规则的既定口径是「删掉」而非加白名单。
- **方案**：删除这 3 处未引用导入，共 3 文件 3 行，无逻辑改动。
- **验证**：`check:policy`（dead-imports/module-graph/change-policy/changed-files）全绿；全链重放失败 0，3 文件逐字节等于工作树。
