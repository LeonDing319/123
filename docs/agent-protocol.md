# Agent 回合协议

引擎将现有 `AgentTurnOutput` 作为 Decision Proposal。调用方获得独立的上下文副本与取消信号。模型调用在状态事务外执行，默认限时 30 秒。引擎先解析严格的 Zod 契约，再核对本轮消息、开放事件、线索和本轮证据允许的转场或结局。全部通过后才构造下一份 GameState 并提交。失败后保留待处理队列供重试。

Timeline 的 `id` 是会话内从 1 开始的事件编号，与旧字段 `sequence` 相等。`causedBy` 指向直接父事件的 ID，父事件必须已存在，因此自引用、前向引用和循环均无效。弹幕是根输入；采纳决策以该弹幕为父，调查行动以决策为父，同一行动揭示的每条线索均以该行动为父。线索解锁的转场指向最后获得的必需线索。`relatedDanmakuId` 和 `relatedClueIds` 用于检索关联内容。

当前由 Narrative Engine 与可替换的 Mock Agent 运行上述回合协议。

每个会话最多有一个待完成的干预调用。Agent 上下文经过深拷贝与递归冻结。提交弹幕时调用方可传入第二个参数 `requestId`，网络重试应复用该值。同一会话内重复键和相同内容返回原收据，内容冲突则报错。省略键表示一条新弹幕。每次实际入队都会增加队列版本。等待 Agent 期间收到新消息时，旧批次返回 stale 错误，队列保留，下一次调用按原始入队次序处理。超时后的晚到结果也无法提交。幂等收据与版本的有效期为内存会话的生命周期。

## 回合输入与输出

| 类型 | 数据与语义 |
| --- | --- |
| `GameState` | `packId`、`currentSceneId`、`turn`、`trust`、`discoveredClueIds`、`knownFactIds`、`eventHistory`、`memories`、可空的 `endingId` |
| `Danmaku` | `id`、`sceneId`、`submittedAtTurn`、`kind`、`text`。类型为 `advice`、`information` 或 `intervention`，文本修剪后为 1 至 500 字符 |
| `AgentTurnOutput` | `narration`、`danmakuDecisions`、`proposedEvents`、`nextStep`、新增 `memories`、`trustDelta` |
| `GameEvent` | 已提交的事件记录，含运行时 `id`、`storyEventId`、`sceneId`、`turn`、`danmakuId` 和实际 `revealedClueIds` |

每条弹幕决策包含 `danmakuId`、`decision` 和 `reason`，决策取值为 `accept`、`defer` 或 `reject`。同一回合内同一弹幕最多有一条决策。事件提议包含 `storyEventId` 和 `danmakuId`。`nextStep.kind` 取 `stay`、`transition` 或 `end`，后两种分别携带 `sceneId` 和 `endingId`。

后续引擎组装当前状态、角色当前可感知的信息及本轮弹幕作为 Agent 上下文。模型输出须先通过 `agentTurnOutputSchema`。引擎随后检查弹幕是否属于本轮、事件是否由被接受的干预触发、事件是否处于当前场景且满足前置条件，再按故事包登记实际可揭示的线索和事实。预期在事件判定后依据更新后的线索验证转场或结局，整轮通过后再提交状态。

回合是非负整数，信任为 0 到 100 的整数，单轮信任变化量为 −100 到 100 的整数。未来引擎应将提交后的信任限制在 0 到 100。弹幕正文属于玩家输入，不能授予事件、场景和结局的写权限。

## 模型适配

`ModelRequest` 含供应商适配器识别的 `model`、非空的 `messages` 和 `responseFormat`。每条消息的角色取 `system`、`user` 或 `assistant`，并带 `content`。`responseFormat` 取 `text` 或 `json`。

`ModelResponse` 返回原始 `content`、归一化的 `finishReason` 和可选的 `usage`。停止原因取 `stop`、`length`、`content-filter` 或 `unknown`。Provider 级 JSON 校验只验证模型给出完整对象。未来接入真实 Agent 时仍须将该对象交给回合提案 Zod 契约及引擎规则验证。详见[模型供应商规格](model-provider-spec.md)。
