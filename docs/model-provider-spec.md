# 模型供应商规格

## 服务端入口

向同源 `POST /api/model/generate` 发送 `application/json`。以下请求使用默认供应商。成功响应包含 `content` 字符串、`finishReason` 和 `metadata`，元数据记录供应商、实际模型以及上游提供的请求 ID。

```json
{"request":{"messages":[{"role":"user","content":"请返回一个描述走廊的 JSON 对象。"}],"responseFormat":"json","maxOutputTokens":512}}
```

顶层可传 `provider`，请求内可传 `model`，两者须匹配服务器注册的适配器。正文最多 65,536 字节，读取流时累计检查。消息最多 32 条，每条最多 8,000 个 UTF-16 码元，合计最多 16,000。输出预算为 1–4,096 tokens，默认 512。公开协议支持文本与单个 JSON 对象。服务端调用可设置 1–120,000 毫秒超时，默认 30 秒。超时会中止传输并结束调用。

## 配置与计量

将 `.env.example` 的配置填入本地忽略的 `.env.local` 或部署平台服务端密钥存储。默认供应商为 mock。DeepSeek 从 `DEEPSEEK_API_KEY` 读取密钥，使用 Bearer 认证访问固定的 HTTPS Chat Completions endpoint。每次部署通过 `DEEPSEEK_MODEL` 选择 `deepseek-flash` 或 `deepseek-v4-pro`。请求方只能选择已注册的模型。JSON 请求增加格式指令、示例和 `response_format.type=json_object`，返回后解析并检查停止原因。[DeepSeek 官方调用说明](https://api-docs.deepseek.com/) · [JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)

`usage.inputTokens`、`outputTokens`、`totalTokens` 分别映射上游的 `prompt_tokens`、`completion_tokens`、`total_tokens`。缺少 usage 时省略整个字段，Mock 同样省略。测试夹具的计数仅用于验证映射。[响应字段](https://api-docs.deepseek.com/api/create-chat-completion/)

## 错误与部署

失败返回固定的 `error` 代码。无效输入或模型返回 400，跨域来源返回 403，正文过大返回 413，能力不支持返回 422，上游限流返回 429，超时返回 504。缺密钥或余额不足返回 503，上游认证、网络、服务错误和非法响应返回 502。错误响应省略上游正文与请求头。[上游错误码](https://api-docs.deepseek.com/quick_start/error_codes/)

生产部署应在路由前配置身份验证、按用户授权可用模型、请求速率与并发限制、每日 token 配额，并对入口日志脱敏。Origin 检查仅约束浏览器跨站请求。非浏览器客户端可以直接调用 HTTP 接口。真实供应商开放前需落实这些网关控制。

## 扩展与事务

每个注册项对应一组 `providerId` 和 `modelId`，声明支持的格式并实现 `generate`。注册表支持选择模型、查询格式和切换默认项。新增 OpenAI 等适配器时，可复用 `defineProvider` 处理输入、能力检查、超时与 JSON 校验，在适配器内部转换供应商字段，并在服务端路由注册。模型响应只作为数据返回。后续 Agent 可据此构造 Decision Proposal，游戏状态始终由引擎校验并提交。
