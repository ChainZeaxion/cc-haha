# 交接文档：助手侧（1cat-studio / 前端 agent）工具轮次跳过思考 — enable_thinking 信号协议

> 日期：2026-10-17（v2，协议更正：`no_think` 方案已废弃，改用现成的 `enable_thinking`）
> 引擎侧改造：**零改动**。模板原版（v22.5-newfix）+ 现行 g29 启动参数已完整支持，热重载无需。
> 联系背景：目标行为 = 工具推进轮不思考（省工具间隔时间），最终回答轮恢复思考。

---

## 一、协议（对齐用）

判定信号只有一个：**本轮发请求时，助手侧工具队列里还有没有待执行的工具**。

| 轮次类型 | 思考 | 助手侧动作 |
|---|---|---|
| 用户提问后第一轮（要做工具调用） | **有**（保留，给模型规划空间） | 不带信号 |
| 工具结果返回、**后面还有工具要执行** | **无**（跳过） | 请求带 `chat_template_kwargs: {"enable_thinking": false}` |
| 最后一个工具结果返回、**接下来出最终回答** | **有** | 不带信号 |

- 队列非空（本轮结果处理完还要发起下一轮工具调用）→ 标 `enable_thinking: false`
- 队列空（所有工具都执行完毕，本轮模型输出就是最终答案）→ 不标

## 二、请求格式

```jsonc
// 工具推进中段轮（执行完一个工具、后面还有工具）:
{
  "model": "...",
  "messages": [ ...含 tool 角色结果... ],
  "tools": [ ... ],
  "chat_template_kwargs": { "enable_thinking": false },
  "stream": true
}

// 最终回答轮（最后一个工具结果之后）:
// 什么都不用加。g29 启动参数 default 已是 enable_thinking=true。
```

注意：
- **逐请求生效**，引擎无状态。每次请求独立判定、独立附带。
- 请求级参数会覆盖引擎 default（`--default-chat-template-kwargs {"enable_thinking": true}`），false 能正确压过 true——已线上实测。
- 不需要传 `enable_thinking: true` 来"恢复"——不传即回落 default=true。
- 若请求里已带 `reasoning_effort`，注意 protocol 层会自动注入 enable_thinking（reasoning_effort != "none" → true）；此时助手侧显式传 false 即可覆盖，勿省略。

## 三、助手侧需要改什么

在 1cat-studio 的 agent 循环里（执行工具→回传结果→再请求引擎的那段）：

1. **找到发起下一轮 chat completion 请求的位置**（把 tool result 拼回 messages 后调引擎处）。
2. **加一个判定**：本轮请求之后是否还有待执行的工具调用？
   - 典型实现：assistant 消息发多个 tool_calls，studio 逐个执行；执行完当前工具后队列里仍有未执行的 → 下一轮请求带 `enable_thinking: false`。
   - 攒批模式（本轮全部工具结果一起发回）→ 只判定"这是不是最后一个批次"，最后一批不带信号。
3. **传参**：请求体加 `chat_template_kwargs: {"enable_thinking": false}`（若已有 chat_template_kwargs 则并入该键，不覆盖其他键）。

改动量预估：1 处判定 + 1 处传参，约 5-10 行。

## 四、引擎侧行为说明（助手侧只读，不用动）

1. `enable_thinking=false` 时，模板渲染生成提示为**空思考闭合**（`想做</think` 闭合形式），并连带省掉系统段里全部 think 格式示例——每轮 prefill 更省约 900+ 字符。
2. 解析层（`vllm/reasoning/qwen3_reasoning_parser.py`）`thinking_enabled=False` 分支为生产已验证路径：
   - 非流式：输出整段按 content/tool_calls 解析，reasoning=None ✓（实测 31 token 干净出内容）
   - 流式：`到</think` 即隐式思考结束，正文/工具调用正常路由 ✓
3. 历史轮思考内容照常保留在 prompt（`preserve_thinking=true` default），不受影响。

## 五、线上实测记录（2026-10-17，g29 :8000）

```
[enable_thinking=false] reasoning=None content='文件 ...的内容是...' ct=31   ← 零思考直接回答
[默认(不传)            ] reasoning='The file contains...' content=... ct=49 ← 有思考
```

## 六、验收清单（联调时）

- [ ] 多工具任务（如"读 3 个文件再总结"）：中间轮请求带 enable_thinking=false 且响应 reasoning 为空
- [ ] 最后一个工具结果后的请求不带信号，最终回答带完整思考
- [ ] `completion_tokens_details.reasoning_tokens` 中间轮 ≈ 0
- [ ] 工具调用正确率无回归（对照工具回归套件 35 用例）
- [ ] ITL：中间轮 ttft 明显下降（少了思考生成段）

## 七、回滚 / 退出

助手侧摘掉 enable_thinking 传参即回到原行为，无任何持久影响。引擎侧无改动，无需回滚。
