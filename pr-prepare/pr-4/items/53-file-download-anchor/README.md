# 53-file-download-anchor — 下载定稿 anchor 导航（链位 53，53-file-download-anchor.patch）

> 功能组：pr-4 — 文件下载桥接 + 大会话打开提速（pr-prepare/pr-4/）
> 链位 53，patch `53-file-download-anchor.patch`（本目录）

- 需求背景：改 blob 后用户仍报「点了没反应」，改 IPC 后第三次反馈「文件浏览、文件预览的卡片是坏的，对话里的卡片能下，你搞错方向」。决定性实测三态：**无 Origin（anchor 点击=导航）→ 200 + attachment**；`Origin: null`（fetch）→ 403；`Origin: file://`（应用自身 fetch）→ 200。anchor 点击是导航、不带 Origin，走放行路径——这正是对话卡片一直能用的原因。
- 方案：`downloadLocalFile` 回到初版形状——建 anchor → `href` 指 `/local-file/...?download=1` → 带 `download` 名 → `click()`，同步返回；文件浏览（右键）与文件预览（打开方式→下载）共用这一函数，一处修好两处；删掉上一轮在错误前提下加的整套 IPC 机件（`desktop:file:save-copy` 通道 + `files.saveCopy` + `services/fileSave.ts` 等 7 文件），净 **−282 行**。
- 验证（真机，不只是单测）：打包 app `file://` 渲染进程内 CDP 指下载目录到 `/tmp/e2e-nav-out`，页面内点同形状 anchor **文件写出且内容一致（PASS）**；服务端三态如上表；`handlePreviewLink` 38 绿；`electron/ipc`+`services`+`workbench` 653 绿；全量前端 6346 绿；`check:server` 493 文件 5950 绿；`tsc -b` 0 错。
