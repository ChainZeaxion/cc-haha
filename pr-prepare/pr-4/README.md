# pr-4 — 文件下载桥接

> 分支 `pr/file-download`，基座 `068b3ebd`。功能域：本地会话文件下载桥接：H5 浏览器下载 anchor 导航方案 + <a download> 属性 + blob/URL 生命周期修复

## 优化项

### 8. 文件下载桥接（链位 8，08-file-download.patch）（链位 8，`08-file-download.patch`）
- 需求背景：H5 浏览器端打开文件链接时 `/local-file/<absPath>` 直接内联显示而非触发下载，需要 `Content-Disposition: attachment` 让 H5 真正下载；会话导出的文件列表卡（DownloadReferencesCard）需要展示文件名/大小/下载按钮。0.6.6 基座服务端只有参数预留、路由没读 query，前端 `DownloadReferencesCard`/`fileSizeCache`/`downloadFileMeta` 三件套全缺（老 fork 独有）。
- 方案：
  - `localFile.ts` 实现 `?info=1`（JSON `{name,size,mime}`，只 stat 不读内容）与 `?download=1`（RFC5987 attachment 头，unicode/空格文件名正确）；新增 `handleBatchLocalFileInfo`（POST `/local-file/info`，批量 stat，走 `$HOME` sandbox，失败静默跳过）。
  - `index.ts` 把 `/local-file/info` 路由插在 `/local-file/` 前缀分支**之前**（顺序敏感）。
  - `previewFs.ts` 路由读 `?download=1` 透传，download 时跳过 HTML base-rewrite 变换直接流式。
  - 前端 3 新文件：`fileSizeCache.ts`（hot 50/120s + cold 150/30min 两级 LRU，localStorage 持久化）、`downloadFileMeta.ts`（图标映射 + 自适应单位）、`DownloadReferencesCard.tsx`（收集 turn 内 Read 调用的 `file_path` 去重、默认折叠、展开时批量取缺失大小、20 条分页）；`ToolCallGroup.tsx` 两处接入。
  - i18n 5 键 × 5 语言。
  - 2026-09-25 补全：文件树右键加「下载」（A）、open-with 菜单加「下载」（B）、H5 内置浏览器不可用时 toast 提示 + 系统浏览器兜底（C）；`handlePreviewLink.ts` 新增共享入口 `downloadLocalFile(absolutePath)`（anchor 法，二进制直下，无需缓冲整文件或猜 MIME）。
- 验证：`desktop tsc -b` 0 错；6 受影响测试文件 149/149；全量前端 vitest 12300 pass / 0 fail（零回归）；live 7788 H5 全确认 A/B/C 三入口。已知坑：仓内 `.js` 孪生遮蔽 `.tsx`（vite 实际 bundle 旧码，症状=新字符串在 dist/ 0 命中），须 `tsc --noEmit false` 同步后再 build。

### 45. downloadLocalFile 补 anchor.download（链位 45，45-file-download-attr.patch）（链位 45，`45-file-download-attr.patch`）
- 需求背景：初版 `downloadLocalFile` 的临时锚点缺 `download` 属性——缺它则点击是**导航**而非下载，打包版渲染进程在 `file://` 下该请求即跨站、被来源门控拒掉，现象是「点了没反应」。该入口此前零测试。
- 方案：`downloadLocalFile` 的锚点补 `download` 属性（文件名来自路径），保证点击语义为下载而非导航；同时为该入口补测试。
- 验证：`handlePreviewLink` 测试全绿（含新增下载用例）；随下载主链进入真机确认。

### 51. 下载改走 blob 取字节（链位 51，51-file-download-blob.patch）（链位 51，`51-file-download-blob.patch`）
- 需求背景：用户反馈文件浏览的两个下载入口「可以触发下载，但提示'无法从网站上提取文件'」。实测定位：打包版渲染进程在 `file://`，而**DOM 发起的下载请求 Origin 序列化为 `null`**（非 `file://`）；服务端 `resolveCors` 只在「无 Origin / 本机 Origin / H5 白名单」放行，`null` 不在其中 → 403。不直接放行 `null` 是因为 `null` 是所有不透明来源（含恶意 sandbox iframe）的序列化值。
- 方案：`downloadLocalFile` 改为 `apiGetBlob` 取字节 → `URL.createObjectURL` → 带 `download` 名的临时锚点点击（与既有 app icon 下载同一解法：先取字节即走上其余调用一样的凭证路径）；显式设 `anchor.download`（blob URL 无文件名）；`revokeObjectURL` 延到下一 task（同步撤销可能取消尚未开始的下载）；助手吞掉失败并记录原因（菜单回调即发即忘）。
- 验证：`handlePreviewLink.test` 39 全绿（4 条为改写后的下载用例：走 API 客户端而非 DOM、保留路由与文件名、DOM 无残留、失败返回 false 且不抛）；`tsc -b` 0 错。注：此方案**未解决**打包版 `file://` 下「不透明来源 mint 的 blob 不可下载」问题，成为下一步（链位 53）的起点。

### 53. 下载定稿 anchor 导航（链位 53，53-file-download-anchor.patch）（链位 53，`53-file-download-anchor.patch`）
- 需求背景：改 blob 后用户仍报「点了没反应」，改 IPC 后第三次反馈「文件浏览、文件预览的卡片是坏的，对话里的卡片能下，你搞错方向」。决定性实测三态：**无 Origin（anchor 点击=导航）→ 200 + attachment**；`Origin: null`（fetch）→ 403；`Origin: file://`（应用自身 fetch）→ 200。anchor 点击是导航、不带 Origin，走放行路径——这正是对话卡片一直能用的原因。
- 方案：`downloadLocalFile` 回到初版形状——建 anchor → `href` 指 `/local-file/...?download=1` → 带 `download` 名 → `click()`，同步返回；文件浏览（右键）与文件预览（打开方式→下载）共用这一函数，一处修好两处；删掉上一轮在错误前提下加的整套 IPC 机件（`desktop:file:save-copy` 通道 + `files.saveCopy` + `services/fileSave.ts` 等 7 文件），净 **−282 行**。
- 验证（真机，不只是单测）：打包 app `file://` 渲染进程内 CDP 指下载目录到 `/tmp/e2e-nav-out`，页面内点同形状 anchor **文件写出且内容一致（PASS）**；服务端三态如上表；`handlePreviewLink` 38 绿；`electron/ipc`+`services`+`workbench` 653 绿；全量前端 6346 绿；`check:server` 493 文件 5950 绿；`tsc -b` 0 错。
