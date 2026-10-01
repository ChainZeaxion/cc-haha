# 33-computer-use-python-path-fallback — 无原生文件选择器时回退填入已探测路径（链位 33，33-computer-use-python-path-fallback.patch）

> 功能组：pr-8 — Computer Use 解锁 Linux(X11) + 连接器目录 Linux 平台支持（pr-prepare/pr-8/）
> 链位 33，patch `33-computer-use-python-path-fallback.patch`（本目录）

- 需求背景：解释器路径输入框点「浏览」在两种情形下拿不到选择器——H5/浏览器下原生文件选择器选的是浏览器所在机器的文件（解释器在跑 sidecar 的机器上，永远选不中）；Linux 无 portal 时原生对话框也可能直接失败。原实现两种情形都只留下一个空输入框让用户手抄路径。
- 方案：失败即回退——`fallbackToDetectedPythonPath()`（`ComputerUseSettings.tsx`）把服务端已探测到的解释器路径填入草稿并提示确认保存；新增 i18n 键 `settings.computerUse.pythonPathDialogDetected`（en/zh/jp/kr/zh-TW 五语言各 +1）。
- 验证：`ComputerUseSettings` 族测试（含新增用例）通过；五语言键对齐。
