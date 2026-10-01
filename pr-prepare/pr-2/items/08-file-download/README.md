# 08-file-download — 文件下载桥接（链位 8，08-file-download.patch）

> 功能组：pr-4 — 文件下载桥接 + 大会话打开提速（pr-prepare/pr-4/）
> 链位 8，patch `08-file-download.patch`（本目录）

- 需求背景：H5 浏览器端打开文件链接时 `/local-file/<absPath>` 直接内联显示而非触发下载，需要 `Content-Disposition: attachment` 让 H5 真正下载；会话导出的文件列表卡（DownloadReferencesCard）需要展示文件名/大小/下载按钮。0.6.6 基座服务端只有参数预留、路由没读 query，前端 `DownloadReferencesCard`/`fileSizeCache`/`downloadFileMeta` 三件套全缺（老 fork 独有）。
- 方案：
  - `localFile.ts` 实现 `?info=1`（JSON `{name,size,mime}`，只 stat 不读内容）与 `?download=1`（RFC5987 attachment 头，unicode/空格文件名正确）；新增 `handleBatchLocalFileInfo`（POST `/local-file/info`，批量 stat，走 `$HOME` sandbox，失败静默跳过）。
  - `index.ts` 把 `/local-file/info` 路由插在 `/local-file/` 前缀分支**之前**（顺序敏感）。
  - `previewFs.ts` 路由读 `?download=1` 透传，download 时跳过 HTML base-rewrite 变换直接流式。
  - 前端 3 新文件：`fileSizeCache.ts`（hot 50/120s + cold 150/30min 两级 LRU，localStorage 持久化）、`downloadFileMeta.ts`（图标映射 + 自适应单位）、`DownloadReferencesCard.tsx`（收集 turn 内 Read 调用的 `file_path` 去重、默认折叠、展开时批量取缺失大小、20 条分页）；`ToolCallGroup.tsx` 两处接入。
  - i18n 5 键 × 5 语言。
  - 2026-09-25 补全：文件树右键加「下载」（A）、open-with 菜单加「下载」（B）、H5 内置浏览器不可用时 toast 提示 + 系统浏览器兜底（C）；`handlePreviewLink.ts` 新增共享入口 `downloadLocalFile(absolutePath)`（anchor 法，二进制直下，无需缓冲整文件或猜 MIME）。
- 验证：`desktop tsc -b` 0 错；6 受影响测试文件 149/149；全量前端 vitest 12300 pass / 0 fail（零回归）；live 7788 H5 全确认 A/B/C 三入口。已知坑：仓内 `.js` 孪生遮蔽 `.tsx`（vite 实际 bundle 旧码，症状=新字符串在 dist/ 0 命中），须 `tsc --noEmit false` 同步后再 build。
