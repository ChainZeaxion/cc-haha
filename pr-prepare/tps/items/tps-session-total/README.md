# tps-session-total — 会话读数 = 会话总量（去子代理重复计）（原链位 新增）

> 功能主题：`tps` — TPS 实时解码速度指示器（`pr-prepare/tps/`）｜ PR 分支 `tps-indicator`
> **单一真相源 patch**：`modify/patches/tps/tps-session-total-patch1.patch`（5 文件 +118−70）—— 本目录只存说明，**不复制 patch**

## 明细

### 2026-10-03 新增

**需求背景**（用户）：「会话扩展信息」的会话读数应显示**会话总量**（主 + 子代理合计），与收纳栏口径一致。
- **方案**：会话读数改为取会话总量，去掉把子代理重复计入的部分。
- **验证**：TPS 家族单测（`chatMeter`/`chatStore`）全绿。
