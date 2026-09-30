# 51-file-download-blob — 下载改走 blob 取字节（链位 51，51-file-download-blob.patch）

> 功能组：pr-4 — 文件下载桥接 + 大会话打开提速（pr-prepare/pr-4/）
> 链位 51，patch `51-file-download-blob.patch`（本目录）

- 需求背景：用户反馈文件浏览的两个下载入口「可以触发下载，但提示'无法从网站上提取文件'」。实测定位：打包版渲染进程在 `file://`，而**DOM 发起的下载请求 Origin 序列化为 `null`**（非 `file://`）；服务端 `resolveCors` 只在「无 Origin / 本机 Origin / H5 白名单」放行，`null` 不在其中 → 403。不直接放行 `null` 是因为 `null` 是所有不透明来源（含恶意 sandbox iframe）的序列化值。
- 方案：`downloadLocalFile` 改为 `apiGetBlob` 取字节 → `URL.createObjectURL` → 带 `download` 名的临时锚点点击（与既有 app icon 下载同一解法：先取字节即走上其余调用一样的凭证路径）；显式设 `anchor.download`（blob URL 无文件名）；`revokeObjectURL` 延到下一 task（同步撤销可能取消尚未开始的下载）；助手吞掉失败并记录原因（菜单回调即发即忘）。
- 验证：`handlePreviewLink.test` 39 全绿（4 条为改写后的下载用例：走 API 客户端而非 DOM、保留路由与文件名、DOM 无残留、失败返回 false 且不抛）；`tsc -b` 0 错。注：此方案**未解决**打包版 `file://` 下「不透明来源 mint 的 blob 不可下载」问题，成为下一步（链位 53）的起点。
