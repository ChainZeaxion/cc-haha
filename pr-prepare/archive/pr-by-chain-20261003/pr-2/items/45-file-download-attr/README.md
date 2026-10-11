# 45-file-download-attr — downloadLocalFile 补 anchor.download（链位 45，45-file-download-attr.patch）

> 功能组：pr-4 — 文件下载桥接 + 大会话打开提速（pr-prepare/pr-4/）
> 链位 45，patch `45-file-download-attr.patch`（本目录）

- 需求背景：初版 `downloadLocalFile` 的临时锚点缺 `download` 属性——缺它则点击是**导航**而非下载，打包版渲染进程在 `file://` 下该请求即跨站、被来源门控拒掉，现象是「点了没反应」。该入口此前零测试。
- 方案：`downloadLocalFile` 的锚点补 `download` 属性（文件名来自路径），保证点击语义为下载而非导航；同时为该入口补测试。
- 验证：`handlePreviewLink` 测试全绿（含新增下载用例）；随下载主链进入真机确认。
