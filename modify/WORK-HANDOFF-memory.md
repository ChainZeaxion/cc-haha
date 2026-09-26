# cc-haha 0.6.6 重实现 — 交接检查点（2026-09-26 更新：十八章完成）

## 最新状态

- **分支**：custom-066，最新 commit `50e0423f`（docs 重基清单）→ 本次提交十八章 Computer Use Linux。
- **本轮完成（task#78 + task#75）**：十八章 Computer Use 解锁 Linux（X11）平台，批次 A（门控放宽+状态页，22 生产/测试文件）+ 批次 B（linux_helper.py 986 行 + requirements-linux.txt，2 新文件）全落地。
  - **python-xlib API 3+1 处实机冒烟暴露全修**：①`get_property` 4 参（`property,property_type,offset,length`）抽 `_read_property_value`；②`drawable.display` 是 `_BaseDisplay` 无 `intern_atom`→改 `disp.get_atom(name)`；③frontmost 优先 EWMH `_NET_ACTIVE_WINDOW`（root 属性）input-focus 兜底；④GTK 窗无 `_NET_WM_PID`→`_app_info_from_wm_class` WM_CLASS 兜底；⑤`pyautogui.moveTo(duration=)` 非 `_duration=`。
  - **验证**：computer-use 全族 bun test 24=基线 24 零新增（worktree 对照法）；desktop tsc 0；全量 desktop vitest 12454 pass/4 fail（4=image-processor-packaging .js/.ts 孪生 `spawn bun ENOENT` 环境问题，非本任务）；**live 7788 `GET /api/computer-use/status` 回 `{platform:'linux',supported:true,engine:'linux-x11'}`**；X11 实机冒烟全 26 命令面过（screenshot 回图/输入生效/frontmost gnome-terminal/running 20/installed 112）。
  - **patch**：`modify/patches/computer-use-linux-x11.patch`（24 文件 1758 行含 2 新文件，20 链末位，基线 068b3ebd）；20 链 fresh worktree 顺序 apply 全干净，24 文件与工作树逐字节一致。
  - **文档**：十八章回写实施记录+验证+踩坑，两表 ⬜→✅，重基说明 19→20 patch。

## 上一章状态（2026-09-26 14:00，task#81 上游融合）
- **本轮完成（task#81）**：上游 main `068b3ebd`（09-25，20 commit：pending 问题超时自动回答/聊天外观偏好/CORS 门控重做/OAuth 2.1.281/agent-teams/Kimi K3 图片透传等）融入 custom-066 + 19 patch 全部重基到 068b3ebd。
  - 提交链：a973e578 → `4e25e022`(merge 上游, 5 冲突全并集解决) → `005684ea`(修两处合并吞行+autoQuestion GET 测试期望) → `dbaa10b8`(MessagePayloadRetention 注释对齐上游) → `638c9bca`(AppShell 测试修复+19 patch 重基) → `50e0423f`(docs)。
  - **AppShell 既有回归修复**：chatStore mock 缺 `getSubordinateTpsMeters`（TPS 子代理汇聚引入）→ 补 `() => []`，22/22。
  - **19 patch 重基法（overlay 终态法）**：worktree@068b3ebd 每章 cp 终态文件→commit→相邻章 diff 出 patch。2 章变空 patch（h5-settings-whitelist/h5-mobile-market，共享文件 delta 被前序章覆盖，无损）；apply 用 `--allow-empty`。
  - **验证**：fresh worktree@068b3ebd 顺序 apply 19/19 全干净，终态 vs 工作树仅 4 已知非章 delta（bun.lock、TerminalSettings.tsx、providerModels.ts、preview-agent.js）。desktop tsc 0；desktop vitest 12456/2（2=MessageList 一条负载 flaky，隔离 201/201 绿）；server 6854/10（全 flaky，隔离全绿）。
- **桌面应用已编译**（合并前源码，符合「先编译当前版本」）：`desktop/build-artifacts/electron/` deb(201MB)+AppImage(253MB)+linux-unpacked，bundle App-C1OyVXUg.js（含 TPS 汇聚徽章，无上游新功能）。

## patch 体系（20 链，**新基线 068b3ebd**）

顺序（自上而下 `git apply --allow-empty`）：h5-require-token → h5-auto-mode-optin → session-export → h5-settings-parity → h5-terminal-bridge → session-refresh → tps-indicator → file-download → disable-updates → cache-billing → thinking-switch → h5-settings-whitelist(空) → server-test-baseline-zeroing → h5-mobile-quick-actions → vcc-compactor → h5-mobile-market(空) → h5-mobile-scheduled → connector-linux-platform → h5-mobile-market-layout → **computer-use-linux-x11**（末位）。

## 工作树未提交项（预期内，非章 delta）

- `desktop/src-tauri/resources/preview-agent.js`（M，minified build 产物）
- 大量 untracked `.js` 孪生（tsc emit，不入 git/patch）

## 待办

- ~~task #78：十八章 Computer Use Linux 门控放宽+状态页~~ ✅ 已完成
- ~~task #75：实施 linux_helper（X11 像素面）~~ ✅ 已完成
- H5 市场显示 6 问题清单（已调研未实施，等用户圈范围）
- 可选后续：Linux 桌面端（非 H5）Computer Use 设置页 live 走一遍 Python 安装流（venv 建+依赖装）端到端- 合并后如需重新出桌面包：`cd desktop && bun run electron:package`（产物落 build-artifacts/electron/）

## 环境速记

- dev 7788 运行中；H5 token `h5_H7kDPNb-KkhMnULdmQ-B0eoAd8ey-Pcc9PhtcpbeSUQ`
- 文档：`modify/cc-haha自定义优化-0.6.6重实现.md`（Patch 清单已重基到 068b3ebd，含应用法说明）
- 上游 remote：cchaha-06scode 的 origin 指向 /home/zeaxion/myproject/cc-haha；refs/upstream/main=068b3ebd
