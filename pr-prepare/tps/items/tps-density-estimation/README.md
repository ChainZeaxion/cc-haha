# tps-density-estimation — TPS 密度估算（4 类字符 + 岭回归收缩）（原链位 66）

> 功能主题：`tps` — TPS 实时解码速度指示器（`pr-prepare/tps/`）｜ PR 分支 `tps-indicator`
> **单一真相源 patch**：`modify/archive/patches-merged-20261014/tps/tps-density-estimation-patch1.patch`（10 文件 +728−43）—— 本目录只存说明，**不复制 patch**

## 含链位

| 原链位 | 旧链名 | 说明 |
|---|---|---|
| 66 | `—` | （链位 65+ 新增，无旧 item） |

## 明细

### 原链位 66 — `—`

**需求背景**：路径 B（无 ids 时的估算兜底）须「接近准确的初始比例 + 历史样本自动学习」，且通杀各服务商（token ids 非行业标准）。
- **方案**：4 类**互斥**字符（cjk/latin/digit/sym）计数 + **岭回归收缩**（λ≈2~3，非离散门槛：某类 0 样本时该类停先验、不卡全局）；样本池 20 条/模型，**只存计数不存文本**（无隐私）；`localStorage` v6 半持久化 + 按 model 分桶 LRU≤32；n≥10 后学习优先。共享估计器 `src/shared/tokenDensity.ts`（服务端/客户端共用）+ 客户端 `desktop/src/lib/tpsDensityStore.ts`。实测本引擎 CJK 密度 **1.003 tok/char**（kCjk≈1）、latin≈0.286。
- **验证**：密度实测 CJK=1.003；`tokenDensity.test.ts` / `tpsDensityStore.test.ts`；某类 0 样本时不锁死。
