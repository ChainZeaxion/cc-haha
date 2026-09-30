# pr-4 — 文件下载桥接 + 大会话打开提速

## 功能域概述

本组包含两条主线：**文件下载桥接**——让 H5 浏览器端与桌面文件浏览能够真正下载本地文件（`?download=1` attachment 端点 + 会话内下载卡 + 文件树/open-with 菜单入口 + H5 内置浏览器提示），并修正了打包版 `file://` 渲染进程下下载请求被 CORS 门控拒绝的问题；**大会话打开提速**——定位并修复打开超大转录（139MB+ / 4 万条消息）「一直转圈」的三层根因（归属投影全量扫盘、`findSessionFile` 全量解析、元数据投影冷进程重扫），核心手法是把可续跑的投影状态落盘持久化。

> 每项已独立建目录：`items/<链位>-<name>/`（含该优化项的 patch 与独立 README），支持按项单独提 PR。

## 优化项明细

### 1. 文件下载桥接（链位 8，08-file-download.patch）

- 需求背景：H5 浏览器端打开文件链接时 `/local-file/<absPath>` 直接内联显示而非触发下载，需要 `Content-Disposition: attachment` 让 H5 真正下载；会话导出的文件列表卡（DownloadReferencesCard）需要展示文件名/大小/下载按钮。0.6.6 基座服务端只有参数预留、路由没读 query，前端 `DownloadReferencesCard`/`fileSizeCache`/`downloadFileMeta` 三件套全缺（老 fork 独有）。
- 方案：
  - `localFile.ts` 实现 `?info=1`（JSON `{name,size,mime}`，只 stat 不读内容）与 `?download=1`（RFC5987 attachment 头，unicode/空格文件名正确）；新增 `handleBatchLocalFileInfo`（POST `/local-file/info`，批量 stat，走 `$HOME` sandbox，失败静默跳过）。
  - `index.ts` 把 `/local-file/info` 路由插在 `/local-file/` 前缀分支**之前**（顺序敏感）。
  - `previewFs.ts` 路由读 `?download=1` 透传，download 时跳过 HTML base-rewrite 变换直接流式。
  - 前端 3 新文件：`fileSizeCache.ts`（hot 50/120s + cold 150/30min 两级 LRU，localStorage 持久化）、`downloadFileMeta.ts`（图标映射 + 自适应单位）、`DownloadReferencesCard.tsx`（收集 turn 内 Read 调用的 `file_path` 去重、默认折叠、展开时批量取缺失大小、20 条分页）；`ToolCallGroup.tsx` 两处接入。
  - i18n 5 键 × 5 语言。
  - 2026-09-25 补全：文件树右键加「下载」（A）、open-with 菜单加「下载」（B）、H5 内置浏览器不可用时 toast 提示 + 系统浏览器兜底（C）；`handlePreviewLink.ts` 新增共享入口 `downloadLocalFile(absolutePath)`（anchor 法，二进制直下，无需缓冲整文件或猜 MIME）。
- 验证：`desktop tsc -b` 0 错；6 受影响测试文件 149/149；全量前端 vitest 12300 pass / 0 fail（零回归）；live 7788 H5 全确认 A/B/C 三入口。已知坑：仓内 `.js` 孪生遮蔽 `.tsx`（vite 实际 bundle 旧码，症状=新字符串在 dist/ 0 命中），须 `tsc --noEmit false` 同步后再 build。

### 2. downloadLocalFile 补 anchor.download（链位 45，45-file-download-attr.patch）

- 需求背景：初版 `downloadLocalFile` 的临时锚点缺 `download` 属性——缺它则点击是**导航**而非下载，打包版渲染进程在 `file://` 下该请求即跨站、被来源门控拒掉，现象是「点了没反应」。该入口此前零测试。
- 方案：`downloadLocalFile` 的锚点补 `download` 属性（文件名来自路径），保证点击语义为下载而非导航；同时为该入口补测试。
- 验证：`handlePreviewLink` 测试全绿（含新增下载用例）；随下载主链进入真机确认。

### 3. 下载改走 blob 取字节（链位 51，51-file-download-blob.patch）

- 需求背景：用户反馈文件浏览的两个下载入口「可以触发下载，但提示'无法从网站上提取文件'」。实测定位：打包版渲染进程在 `file://`，而**DOM 发起的下载请求 Origin 序列化为 `null`**（非 `file://`）；服务端 `resolveCors` 只在「无 Origin / 本机 Origin / H5 白名单」放行，`null` 不在其中 → 403。不直接放行 `null` 是因为 `null` 是所有不透明来源（含恶意 sandbox iframe）的序列化值。
- 方案：`downloadLocalFile` 改为 `apiGetBlob` 取字节 → `URL.createObjectURL` → 带 `download` 名的临时锚点点击（与既有 app icon 下载同一解法：先取字节即走上其余调用一样的凭证路径）；显式设 `anchor.download`（blob URL 无文件名）；`revokeObjectURL` 延到下一 task（同步撤销可能取消尚未开始的下载）；助手吞掉失败并记录原因（菜单回调即发即忘）。
- 验证：`handlePreviewLink.test` 39 全绿（4 条为改写后的下载用例：走 API 客户端而非 DOM、保留路由与文件名、DOM 无残留、失败返回 false 且不抛）；`tsc -b` 0 错。注：此方案**未解决**打包版 `file://` 下「不透明来源 mint 的 blob 不可下载」问题，成为下一步（链位 53）的起点。

### 4. 下载定稿 anchor 导航（链位 53，53-file-download-anchor.patch）

- 需求背景：改 blob 后用户仍报「点了没反应」，改 IPC 后第三次反馈「文件浏览、文件预览的卡片是坏的，对话里的卡片能下，你搞错方向」。决定性实测三态：**无 Origin（anchor 点击=导航）→ 200 + attachment**；`Origin: null`（fetch）→ 403；`Origin: file://`（应用自身 fetch）→ 200。anchor 点击是导航、不带 Origin，走放行路径——这正是对话卡片一直能用的原因。
- 方案：`downloadLocalFile` 回到初版形状——建 anchor → `href` 指 `/local-file/...?download=1` → 带 `download` 名 → `click()`，同步返回；文件浏览（右键）与文件预览（打开方式→下载）共用这一函数，一处修好两处；删掉上一轮在错误前提下加的整套 IPC 机件（`desktop:file:save-copy` 通道 + `files.saveCopy` + `services/fileSave.ts` 等 7 文件），净 **−282 行**。
- 验证（真机，不只是单测）：打包 app `file://` 渲染进程内 CDP 指下载目录到 `/tmp/e2e-nav-out`，页面内点同形状 anchor **文件写出且内容一致（PASS）**；服务端三态如上表；`handlePreviewLink` 38 绿；`electron/ipc`+`services`+`workbench` 653 绿；全量前端 6346 绿；`check:server` 493 文件 5950 绿；`tsc -b` 0 错。

### 5. 归属投影落盘（链位 55，55-session-history-context-durable.patch）

- 需求背景：用户报「老会话打不开」，实为打开 40,119 条消息的会话「一直转圈」。逐项证伪（打开门槛/vcc 扫盘/git/索引 DB 查询）后锁定：`GET /api/sessions/<id>` 取一页要 `projectHistoryPageEntries` 为算 `parent_tool_use_id` **把整个转录从头扫一遍**——默认 2,949ms / 193MB 扫描，`projectContext:false` 仅 6ms，慢约 500 倍。且索引存 `mkdtemp` + 内存 Map 仅 4 项 + `exit` 即删 ⇒ 每次重启/淘汰重扫，`/tmp` 还累积了 634 目录 / 92MB 泄漏。
- 方案：索引的可续跑状态（identity/size/mtime/offset/suppressed/fingerprint）写进 DB `meta` 表、与 context 行**同事务提交**（索引永不与自身内容矛盾）；索引文件放稳定路径 `<cc-haha>/db/history-context-v1/<sha256(路径)>.sqlite`（`CC_HAHA_HISTORY_CONTEXT_DIR` 可覆盖）；淘汰只 close 不删文件，`pruneOnce()` 每进程一次、删 7 天未动索引；所有失效判定原样保留（正确性不变，只把「进程内易失」改为「跨进程可用」）。
- 验证（跨进程=跨重启）：冷启动 **2,949ms → 第 2 进程 37ms → 第 3 进程 36ms**（后两次 `ctxScan=0`）；索引文件仅 3.3MB；`sessionHistoryContext.test.ts` 8/8（新增：冷启动复用落盘索引、冷启动仍拒绝被替换的转录）；`check:server` 493 文件 5952 通过 0 失败。

### 6. findSessionFile 有界读（链位 56，56-session-find-bounded-read.patch）

- 需求背景：链位 55 修掉归属投影后用户实测「还是慢」。给 `getSessionSummary` 各步骤加 env 门控临时计时后定位：重复开销在 `findSessionFile`（单次 4–6 秒）——`hasConversationTranscript` 判「有没有真实对话」时把整个文件读完 + 逐行 JSON.parse，而同一 session id 在多个发现根下各有一份（139.7MB + 184.5MB）⇒ 每次解析约 320MB，且该函数几乎在每个会话端点上。
- 方案：这是**存在性**问题，读到第一个合格条目即可回答。新增 `hasConversationTranscriptInFile`：只读文件头、**命中即停**，设 8MB 上限兜底「头部全是元数据」的病态文件（该标志只用于多匹配间排序，上限语义代价小）。
- 验证：`findSessionFile` **4345–6065ms → 2–8ms**（约 1000 倍）；「老会话打不开」(13.5MB) 冷首开 0.71s → 之后 ~30ms；「…时间线交叉」(139.7MB×2) 热态连打 6 次 **0.010–0.017s**（改前 6.5/14.6/6.9s 且不随请求次数改善）。

### 7. 元数据投影落盘（链位 57，57-transcript-metadata-durable.patch）

- 需求背景：链位 55/56 解决「重复开销」后，冷进程**首次**打开超大会话仍要 9.6s——`getMetadataProjection` 要算 messageCount/最后时间戳/launchCount 等，**本就需要一次全量遍历**（不能靠「少读」解决），而此前只在内存缓存（上限 32），进程重启即失；且同 session 两份拷贝各建一次。
- 方案：投影结果是几 KB 纯标量，落盘：新增 `transcriptMetadataCache`，路径 `<cc-haha>/db/transcript-metadata-v1/<sha256(configDir+文件路径)>.json`（`CC_HAHA_TRANSCRIPT_METADATA_DIR` 可覆盖）；写 tmp+rename（读者不见半写），失败静默；读**只认同 signature**（`dev:ino:size:mtimeNs`）且 `projectDir` 相同 ⇒ 陈旧条目代价是重扫、绝不给错答案；每进程最多扫一次、删 7 天未动条目；顺带把「上限 32」容量守卫抽成 `enforceMetadataProjectionCacheCapacity()` 复用。
- 验证（两个独立冷进程）：冷启动首开 **10.24s → 第 2 次冷启动 0.016s**；落盘条目仅 1.3–1.9KB；真实会话冷首开「老会话打不开」(13.5MB) 0.76s 后 ~29ms、「…时间线交叉」(139.7MB+184.5MB) **0.027s**（改前 9.29s）。测试写法：转录 `chmod 000` 后读——`fs.stat` 仍成功但重扫必 EACCES，能返回正确值即证明命中来自落盘（root 下跳过）。

## 下载方案演进（blob → anchor 的踩坑结论）

下载入口的修法经历三轮迭代（链位 45 → 51 → 53），最终定稿是**回到最朴素的 anchor 导航**。第一轮（链位 45）：初版 anchor 缺 `download` 属性，点击语义是导航，打包版 `file://` 下被跨站来源门控拒掉，补上 `download` 并补零测试覆盖。第二轮（链位 51）：文件浏览下载仍报「无法从网站上提取文件」，实测发现 DOM 发起的下载请求 Origin 序列化为 `null`（不是 `file://`）而被 CORS 403，遂改为 `apiGetBlob` 取字节 + blob URL 点击；但「不透明来源 mint 的 blob 不可下载」让失败变成**静默**（无异常、无提示），现象从「下载失败」升级为「点了毫无反应」，又诱发了第三轮。第三轮（链位 53）：决定性证据是三态实测——**anchor 点击是导航、不带 Origin，走服务端「无 Origin」放行路径并返回 `Content-Disposition: attachment`**；此前误把「构造出的 `Origin: null` 请求被 403」当成了「DOM 下载会被拒」。

核心教训有三条。其一，**当现象里存在一个能用的同类入口（对话里的下载卡片），它就是现成的对照实验，先看它为什么能行**——本仓库里同一个「DOM 直接指向路由」的老路一直是通的，两次「修」把它越改越坏，还净加了一套 7 文件的 IPC 机件，定稿时全部删掉（净 −282 行）。其二，**「测到 403」不等于「真实请求会被 403」**：403 是构造出的请求形状（`Origin: null`）得到的，真实点击走的是另一种形状（导航、无 Origin），先确认自己复刻的是不是真实请求，再去解释结果。其三，**静默失败会把方向带偏**：blob 不可下载不报错，失败模式本身的变化（报错→无反应）就应作为线索；且写进代码注释的因果也要有取证，未验证的「下载卡片能用、树菜单不能」后来被实测推翻（两者同样失败）。

## 验证口径（组级）

- 类型/单测基线：`desktop tsc -b` 0 错；下载链相关 `handlePreviewLink` 38/39 绿、openWithItems 54、OpenWithMenu 17、openWithMenuItems 3、WorkspaceFileOpenWith 10、WorkspaceFileTreePane 31；性能链相关 `sessionHistoryContext.test.ts` 8/8、`session-transcript-presence.test.ts`、`session-metadata-projection-durable.test.ts` 全绿。
- 全量回归：前端 vitest（下载链时期 12300 pass / 0 fail；anchor 定稿后 6346 绿口径）；服务端 `bun run check:server` 493 文件全绿（5950/5952 通过 0 失败，随链位递增）。
- 真机/跨进程实测：打包 app `file://` 渲染进程 CDP 下载落盘内容一致（PASS）；冷启动跨进程 2,949ms→37ms、10.24s→0.016s；真实超大会话热态打开 0.010–0.027s。
- 取证手法：性能归因用 env 门控的临时步骤计时（量完即撤、提交前 grep 确认无残留）；落盘命中证明用 `chmod 000`（stat 可过、重扫必 EACCES）；下载服务端行为用 curl 三态对照（无 Origin / `null` / `file://`）。
- 构建注意：仓内 `.js` 孪生遮蔽 `.ts`，改前端后须 `tsc --noEmit false` 同步再 `vite build`，并 grep dist 验证新字符串。

## 与其他组的关系

- **依赖补齐（传递依赖，非本组功能）**：`h5Access.ts`、`sessions.ts`、`ActivityGroup.tsx`、`ThinkingBlock.tsx`、`activityGroupModel.ts`、`useCompactMetrics.ts`、`browserHost.ts`、`terminalWs.ts`、`desktopRuntime.ts`、`tpsMeter.ts`、`settingsStore.ts`、`types/chat.ts`、`types/session.ts`、`types/settings.ts` 等文件因链内其他组（TPS 计量、子代理用量、收纳栏、思考计时等）的改动/新增而需要带全量终态，本组 patch 只贡献其中本组相关的部分。
- **`ToolCallGroup.tsx`** 是本组直接改动（接入 TurnDownloadCard），同时也被其他组（子代理用量展示、工具计时）改动，链上顺序以 manifest 为准。
- 性能三补丁（链位 55/56/57）作用于同一打开链路但各自独立成节、可分别归因；三者叠加后大会话冷/热打开均进入百毫秒内。

## 风险与备注

- ⚠️ **上游 main 也改过的冲突风险文件**（apply 时需留意）：
  - `desktop/src/components/workbench/WorkspaceFileTreePane.tsx` / `.test.tsx`
  - `desktop/src/components/workspace/WorkspaceFileOpenWith.tsx` / `.test.tsx`
  - `desktop/src/types/chat.ts`
  - `src/server/services/sessionHistoryContext.ts` / `.test.ts`
  - `src/server/services/sessionService.ts`
- 下载链 4 个 patch（链位 8/45/51/53）是**同一功能的迭代**，必须按链位顺序依次 apply，最终形态以链位 53（anchor 导航）为准；链位 51 的 blob 代码在 53 中被回退。
- 服务端路由顺序敏感：`POST /local-file/info` 必须在 `/local-file/` 前缀分支**之前**注册，上游若改动 `index.ts` 路由区需保持该顺序。
- 两个落盘缓存均提供 env 覆盖目录（`CC_HAHA_HISTORY_CONTEXT_DIR` / `CC_HAHA_TRANSCRIPT_METADATA_DIR`），测试依赖这些变量隔离真实配置目录；`CC_HAHA_*` 前缀命名需与上游 env 约定一致。
- `.js` 孪生与 `pkill -f` 自匹配均为本地仓坑，非上游代码问题，但 PR 描述中建议注明前端改动的 build 验证方式。
- 性能数字基于特定大会话样本（13.5MB / 139.7MB+184.5MB / 193MB 扫描），上游 CI 无同尺寸夹具时建议以单测（冷启动复用/拒绝被替换转录/signature 不符不采信）为主要验收，实测数字作为性能佐证。
