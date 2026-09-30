# pr-4 — 文件下载桥接 + 大会话打开提速

- 上游文档章节：五/五补记(链位55-57)
- 建议分支：`pr/file-download-speed`

## 包含的优化项与 patch（链位顺序）

| 链位 | patch 文件 | 行数 | 文件数 | 文档章节/说明 |
|------|-----------|------|--------|--------------|
| 8 | `items/08-file-download/08-file-download.patch` | +541/−43 | 14 | 五 文件下载桥接（含右键/菜单下载 + H5 内置浏览器提示） |
| 45 | `items/45-file-download-attr/45-file-download-attr.patch` | +75/−0 | 2 | 五 子优化：`downloadLocalFile` 补 `anchor.download`——缺它则点击是**导航**而非下载，打包版渲染进程 `file://` 下该请求即跨站、被来源门控拒掉（「点了没反应」）；该入口此前**零测试**（ |
| 51 | `items/51-file-download-blob/51-file-download-blob.patch` | +133/−54 | 4 | 五 子优化：**下载改走 `apiGetBlob`+blob**——`file://` 下 DOM 自发的下载请求其 Origin 序列化为 `null`（非 `file://`），服务端 403 `CORS origin not allo |
| 53 | `items/53-file-download-anchor/53-file-download-anchor.patch` | +54/−106 | 2 | 五 补记（定稿）：**下载必须走 anchor 导航**——anchor 点击不带 Origin，服务端放行并给 `Content-Disposition`；我误把「`Origin: null` → 403」当成「DOM 下载会被拒」，改  |
| 55 | `items/55-session-history-context-durable/55-session-history-context-durable.patch` | +184/−15 | 2 | 五 补记：**打开大会话「一直转圈」＝归属投影全量扫盘**——为一个 40,119 条消息的会话取一页要**扫 193MB / 2,949ms**（跳过投影仅 6ms）；索引原存 `mkdtemp`+内存 4 项+exit 即删 ⇒ 每次重 |
| 56 | `items/56-session-find-bounded-read/56-session-find-bounded-read.patch` | +135/−6 | 2 | 五 补记二：**大会话一直转圈＝`findSessionFile` 全量解析转录**——判定「有没有真实对话」时把整个文件读完+逐行 JSON.parse，而同一 id 在多个发现根下各有一份（139.7MB+184.5MB）⇒ 每次解析约 |
| 57 | `items/57-transcript-metadata-durable/57-transcript-metadata-durable.patch` | +207/−1 | 3 | 五 补记三：**元数据投影落盘**——冷进程首开大会话仍要 9.6s（该投影本就需要一次全量遍历算 messageCount/最后时间戳，且两份拷贝各建一次）；投影是几 KB 纯标量 ⇒ 落盘 + 只认同 signature，**10.24 |

## 文档章节位置（modify/cc-haha自定义优化-0.6.6重实现.md）

- 章节「五」：自第 604 行起

## 文件清单

- `desktop/src/api/h5Access.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/api/sessions.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ActivityGroup.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/DownloadReferencesCard.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/ThinkingBlock.tsx` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/chat/ToolCallGroup.tsx` （本组 patch 直接改动）
- `desktop/src/components/chat/activityGroupModel.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/components/composite/OpenWithMenu.tsx` （本组 patch 直接改动）
- `desktop/src/components/workbench/WorkspaceFileTreePane.test.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/components/workbench/WorkspaceFileTreePane.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/components/workspace/WorkspaceFileOpenWith.test.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/components/workspace/WorkspaceFileOpenWith.tsx` （本组 patch 直接改动） ⚠️上游 main 也改过
- `desktop/src/hooks/useCompactMetrics.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/desktopHost/browserHost.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/desktopHost/terminalWs.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/desktopRuntime.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/lib/downloadFileMeta.ts` （本组 patch 直接改动）
- `desktop/src/lib/fileSizeCache.ts` （本组 patch 直接改动）
- `desktop/src/lib/handlePreviewLink.test.ts` （本组 patch 直接改动）
- `desktop/src/lib/handlePreviewLink.ts` （本组 patch 直接改动）
- `desktop/src/lib/openWithItems.ts` （本组 patch 直接改动）
- `desktop/src/lib/openWithMenuItems.ts` （本组 patch 直接改动）
- `desktop/src/lib/tpsMeter.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/stores/settingsStore.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/chat.ts` （依赖补齐：链内被其他组改动/新增的传递依赖） ⚠️上游 main 也改过
- `desktop/src/types/session.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `desktop/src/types/settings.ts` （依赖补齐：链内被其他组改动/新增的传递依赖）
- `src/server/__tests__/session-metadata-projection-durable.test.ts` （本组 patch 直接改动）
- `src/server/__tests__/session-transcript-presence.test.ts` （本组 patch 直接改动）
- `src/server/api/localFile.ts` （本组 patch 直接改动）
- `src/server/api/previewFs.ts` （本组 patch 直接改动）
- `src/server/services/sessionHistoryContext.test.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/sessionHistoryContext.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/sessionService.ts` （本组 patch 直接改动） ⚠️上游 main 也改过
- `src/server/services/transcriptMetadataCache.ts` （本组 patch 直接改动）
## ⚠️ patch 应用方式说明（2026-09-29 核验）

- **权威交付形态 = `items/00-group/00-group.patch`**：基座 `068b3ebd` → 本组终态的完整 diff（已验证：干净基座 worktree 上 `git apply --index` 独立成功，且组内全部文件与全链终态逐字节一致）。
- `NN-*.patch`（按链位命名）是链内历史产物，其 hunk 上下文取自**全链前态**（含其他组的改动），因此**单独抽本组按 NN 顺序 apply 不保证成功**（实测 10 组中仅 pr-2/5/7/8 自包含）。提 PR 时用 `items/00-group/00-group.patch`，`NN-*.patch` 仅供对照「本组由哪些优化项构成」。
