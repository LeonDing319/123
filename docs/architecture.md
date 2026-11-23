# AI Danmaku Narrative Engine 架构

## Phase 2B-1

Next.js App Router 的 `app/page.tsx` 渲染 `components/reader/story-preview.tsx`，用于检阅现有阅读器。故事包由 Node.js 侧的 `lib/skills/skill-loader.ts` 读取，`npm run validate:story` 通过同一入口验证作者提交的内容。当前首页继续使用 Part 1 的开场样稿。

```text
content/packs/<pack-id>/ ──> loadStoryPack ──> Zod ──> 引用校验 ──> StoryPack
                                  ↑
                         npm run validate:story

app/page.tsx ──> components/reader/story-preview.tsx
```

## 模块职责

| 模块 | 职责 | 当前交付 |
| --- | --- | --- |
| Reader Interface | 展示当前场景与已生成叙述，采集弹幕 | 静态阅读器小样 |
| Skill Loader | 从内置内容目录读取、校验并返回故事包 | Node.js 读取、格式校验、跨文件校验、命令行入口 |
| State Manager | 初始化会话状态，提交经过验证的回合变更 | `GameState` Zod 契约 |
| Narrative Engine | 核准事件、线索、转场和结局 | 会话内 FIFO、版本检查、原子提交与因果时间线 |
| AI Agent | 基于只读回合上下文提交提案 | 可替换的 Mock Agent |
| Model Adapter | 将统一请求与响应映射至各供应商 | 服务端 Registry、DeepSeek HTTP 适配器与 Mock Provider |

浏览器通过同源 `POST /api/model/generate` 访问模型。Node.js 路由校验输入后，从注册表选取模型并返回内容、元数据和供应商报告的用量。该入口独立于游戏会话。引擎继续从 Agent 接收提案并裁决。部署约束及扩展方式见[模型供应商规格](model-provider-spec.md)。

故事包、回合消息和会话状态的 TypeScript 类型均从对应 Zod schema 推导。后续引擎应从 manifest 的入口场景、主角初始信任和已知事实初始化状态，将回合置为 0，线索、事件和记忆置空，结局置为 `null`。状态提交前需在当前故事包上下文校验引用与回合条件。Zustand 可用于阅读器界面状态，服务端负责以后续校验通过的状态作为会话依据。

Skill Loader 依赖 Node.js 文件系统，应从 Node.js 服务端运行时或命令行调用。其结果包含隐藏线索和结局条件，阅读器接入时应仅投影当前可见信息。供应商 API Key 未来只从服务端环境变量读取，例如 `OPENAI_API_KEY` 与 `DEEPSEEK_API_KEY`。

故事内容见 [故事包规格](story-pack-spec.md)，回合数据见 [Agent 协议](agent-protocol.md)。
