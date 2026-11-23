import { env } from "node:process";
import { z } from "zod";
import { defineProvider } from "./model-provider.ts";
import { ProviderError } from "./provider-errors.ts";

const tokens = z.number().int().nonnegative();
const completionSchema = z.object({
  id: z.string().min(1), model: z.string().min(1),
  choices: z.array(z.object({
    finish_reason: z.string(), message: z.object({ content: z.string() }),
  })).min(1),
  usage: z.object({ prompt_tokens: tokens, completion_tokens: tokens, total_tokens: tokens }).optional(),
});

export function createDeepSeekProvider(modelId = env.DEEPSEEK_MODEL || "deepseek-flash", transport = fetch) {
  if (typeof window !== "undefined") throw new ProviderError("configuration");
  if (!["deepseek-flash", "deepseek-v4-pro"].includes(modelId)) throw new ProviderError("unknown_model");
  const providerId = "deepseek";
  return defineProvider({ providerId, modelId, formats: ["text", "json"] }, async (input, signal) => {
    const key = env.DEEPSEEK_API_KEY?.trim();
    if (!key) throw new ProviderError("missing_key");
    const json = input.responseFormat === "json";
    const messages = json ? [{ role: "system", content: 'Return one JSON object, e.g. {"answer":"..."}.' }, ...input.messages] : input.messages;
    const response = await transport("https://api.deepseek.com/chat/completions", {
      method: "POST", redirect: "error", cache: "no-store", signal,
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId, messages, max_tokens: input.maxOutputTokens,
        stream: false, ...(json && { response_format: { type: "json_object" } }) }),
    });
    if (!response.ok) {
      const codes = { 400: "invalid_request", 401: "authentication", 403: "authentication",
        402: "insufficient_balance", 408: "timeout", 422: "invalid_request", 429: "rate_limited" } as const;
      throw new ProviderError(codes[response.status as keyof typeof codes] ?? "upstream");
    }
    const raw: unknown = await response.json().catch(() => { throw new ProviderError("invalid_response"); });
    const parsed = completionSchema.safeParse(raw);
    if (!parsed.success) throw new ProviderError("invalid_response");
    const { choices, usage, id, model } = parsed.data;
    const { message, finish_reason } = choices[0];
    if ([message.content, id, model].some(value => value.includes(key))) throw new ProviderError("invalid_response");
    const finish = new Map<string, "stop" | "length" | "content-filter">([
      ["stop", "stop"], ["length", "length"], ["content_filter", "content-filter"],
    ]);
    return { content: message.content, finishReason: finish.get(finish_reason) ?? "unknown",
      metadata: { providerId, modelId: model, requestId: id },
      ...(usage && { usage: { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, totalTokens: usage.total_tokens } }),
    };
  });
}
