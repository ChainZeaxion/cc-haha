# 20-h5-gzip-transport — H5 远端 API 响应 gzip 压缩传输（链位 20，`20-h5-gzip-transport.patch`）

> 功能组：pr-9 — 大体积会话加载与传输性能（历史膨胀治理 + gzip 压缩传输）（pr-prepare/pr-9/）
> 链位 20，patch `20-h5-gzip-transport.patch`（本目录）

- 需求背景：用户反馈 H5 访问会话疑似发送全量消息记录，希望非本机访问时默认启用压缩传输以省带宽、提速。实测坐实前提：H5 打开会话 = `getFullHistory` 先 `mode=full` 再逐页 cursor 拉全量历史，生产 193MB 会话实测 wire 139MB / 701 页 / 25.9s（loopback）。而 `Bun.serve` 无 compression 选项，全仓无 content-encoding 中间件。
- 方案：
  - 新增 `src/server/responseCompression.ts`：`shouldGzipResponse`（门控）+ `withGzipIfEligible`（压缩）；门控 = 仅 GET 200 + `Accept-Encoding` 含 gzip + 非 loopback + content-type json + >128KB（`MIN_COMPRESS_BYTES`）；`gzipSync level 6`。
  - `src/server/index.ts` `/api` 分支一行接线；客户端零改动（浏览器 fetch 透明解压 gzip）。
  - env 开关：`CC_HAHA_TRANSPORT_GZIP=0` 关 / `=1` 强制 loopback 也压（测试用）；前 5 次压缩打日志。
- 验证：dev 7788 E2E（LAN IP 触发 vs 127.0.0.1 基线，同一大会话）：wire 136.19MB → 43.09MB（**-68%**），解压后逐字节一致（27984 条 / 705 页全对齐）；705 页中 485 页压缩、<128KB 小页正确透传；loopback `gz_pages=0` 桌面零影响；server 全量 3442 pass / 0 fail。
- 踩坑：`response.arrayBuffer()` 消耗 body 后回退路径直接 `return response` 会致客户端收到 200+空 body，回退必须 `new Response(raw, {status, headers})` 重建；Bun 的 `Response.text()` 不透明解压 gzip，单测须手动 `gunzipSync` 模拟客户端视角。
