# 故事包规格 v1

从项目根目录使用 Node.js 22.18 或更新版本运行 `npm run validate:story`，可校验内置的 `demo-story`。用 `npm run validate:story -- <pack-id>` 校验其他 `content/packs/<pack-id>/` 下的故事包。失败时命令会输出错误并以非零状态退出。

## 文件

每个包包含以下九份 UTF-8 文件。三个 Markdown 文件均须包含正文。JSON 对象仅接受表中定义的字段，字段均为必填。

| 文件 | 形态 | 字段与用途 |
| --- | --- | --- |
| `manifest.json` | 对象 | `schemaVersion` 固定为 1，`id` 与目录名一致，另有 `title`、`entrySceneId` 和 `character` |
| `SKILL.md` | Markdown | 叙事视角、风格与内容规则 |
| `character.md` | Markdown | 主角的背景、行为偏好和认知边界 |
| `world.md` | Markdown | 地点、时间和世界设定 |
| `facts.json` | 对象数组 | `id`、`description` |
| `clues.json` | 对象数组 | `id`、`sceneId`、`description`、`factIds` |
| `scenes.json` | 非空对象数组 | `id`、`title`、`opening`、`transitions`，可选 `goal`。每条转场包含 `toSceneId` 和 `requiresClueIds` |
| `events.json` | 对象数组 | `id`、`sceneId`、`trigger`、`description`、`requiresClueIds`、`revealsClueIds`。触发类型为 `danmaku-intervention` 或 `autonomous`，后者必须填写 `result` |

自主事件的 `id` 即 Agent 可选的行动 ID。候选仅包含当前场景中已满足前置线索且尚未执行的事件。Agent 可见行动描述，执行结果 `result` 与揭示的线索由引擎在验证后提交。每次调用最多执行一个行动。干预优先，自主回合返回 `waiting_for_player`，待现有干预流程处理后再继续。没有可执行行动时，引擎尝试合法转场或结局，否则返回 `no_action`。
| `endings.json` | 非空对象数组 | `id`、`priority`、`sceneId`、`title`、`requiresClueIds`、`excludesClueIds`、`narrativeGoal` |

每个结局须填写有限数值 `priority`，在全包内唯一。条件重叠时，取满足条件的最高优先级结局。旧包升级时需为每个结局补上数值。

`character` 包含 `id`、`name`、`initialTrust` 和 `knownFactIds`。初始信任是 0 到 100 的整数。ID 用 1 至 64 个小写 ASCII 字母、数字和分段连字符。在同一故事包内，manifest、角色、场景、事实、线索、事件和结局的 ID 全局唯一。引用列表可以为空，列表中的 ID 不得重复。

## 引用与条件

- 入口、线索归属、事件归属、结局归属及转场目标均引用场景。每个场景的转场目标各自唯一，所有场景须从入口沿有向转场可达。
- 角色的已知事实和线索关联的事实引用 `facts.json`。转场、事件、结局的线索条件引用 `clues.json`。
- 事件需已满足全部前置线索，且只能揭示归属同一场景的线索。同一线索不可同时在事件的前置与揭示列表中。
- 结局要求当前场景匹配、所需线索齐全，且排除列表中的线索均未发现。要求和排除列表不可重叠。`narrativeGoal` 是结局生成的叙事要求。

加载器先校验包 ID，再从项目根目录下的 `content/packs` 打开指定子目录。包目录和固定文件名须解析到其预期位置，且分别为真实目录和普通文件。包目录及内容文件的符号链接和目录联接会被拒绝。加载器按版本、字段和引用逐层校验，场景可达性按转场拓扑判断。线索获取顺序与结局可达性仍需通过后续引擎验证。

示例包从走廊进入档案间，再由旧图纸指引到书房。在书房能否确认维修记录决定适用的结局条件。示例提供两种结局的叙事目标。
