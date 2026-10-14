# vcc-compact-dead-import — 压缩死导入清理（原链位 36）

> 功能主题：`vcc` — vcc 算法压缩（`pr-prepare/vcc/`）｜ PR 分支 `vcc-compaction`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/vcc/vcc-compact-dead-import-patch1.patch`（3 文件 +1−3）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 36 | `compact-dead-import-cleanup` | 策略门禁 `check:policy` 的 **dead-imports 清零**（十三章 vcc 移植遗留的 3 处未引用导入；该规则口径是「删」而非白名单） |

## 明细

### 原链位 36 — `compact-dead-import-cleanup`

- **需求背景**：`check:policy` 的 dead-imports 规则因十三章 vcc 移植遗留的 3 处未引用导入一直红：`compact.ts` 的 `isEnvTruthy`、`vcc/vendor/core/build-sections.ts` 的 `clip`、`vcc/vendor/types.ts` 的 `Message`。该规则的既定口径是「删掉」而非加白名单。
- **方案**：删除这 3 处未引用导入，共 3 文件 3 行，无逻辑改动。
- **验证**：`check:policy`（dead-imports/module-graph/change-policy/changed-files）全绿；全链重放失败 0，3 文件逐字节等于工作树。
