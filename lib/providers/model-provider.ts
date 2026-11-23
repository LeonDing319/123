import { z } from "zod";
import { modelRequestSchema, type ModelRequest, type ModelResponse } from "../schemas/agent-protocol.ts";
import { ProviderError } from "./provider-errors.ts";

export const generationSchema = modelRequestSchema.extend({
  model: z.string().min(1).max(128).optional(),
  messages: modelRequestSchema.shape.messages.max(32),
  maxOutputTokens: z.number().int().min(1).max(4096).default(512),
}).refine(({ messages }) => messages.every(m => m.content.length <= 8000) &&
  messages.reduce((n, m) => n + m.content.length, 0) <= 16000, "Message length exceeded");

export type Generation = z.input<typeof generationSchema>;
export type GenerationResult = ModelResponse & {
  metadata: { providerId: string; modelId: string; requestId?: string };
};
export interface ModelProvider {
  readonly providerId: string;
  readonly modelId: string;
  readonly formats: readonly ModelRequest["responseFormat"][];
  generate(input: Generation, options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<GenerationResult>;
}

export function defineProvider(
  config: Pick<ModelProvider, "providerId" | "modelId" | "formats">,
  call: (input: z.output<typeof generationSchema>, signal: AbortSignal) => Promise<GenerationResult>,
): ModelProvider {
  return { ...config, async generate(input, { timeoutMs = 30000, signal } = {}) {
    const parsed = generationSchema.safeParse(input);
    if (!parsed.success || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
      throw new ProviderError("invalid_request");
    if (parsed.data.model && parsed.data.model !== config.modelId) throw new ProviderError("unknown_model");
    if (!config.formats.includes(parsed.data.responseFormat)) throw new ProviderError("unsupported_capability");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { reject(new ProviderError("timeout")); controller.abort(); }, timeoutMs);
    });
    try {
      signal?.throwIfAborted();
      const transportSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      const result = await Promise.race([call(parsed.data, transportSignal), deadline]);
      if (parsed.data.responseFormat === "json") {
        try {
          const value = JSON.parse(result.content);
          if (result.finishReason !== "stop" || !value || typeof value !== "object" || Array.isArray(value))
            throw new Error();
        } catch { throw new ProviderError("invalid_response"); }
      }
      return result;
    } catch (error) {
      throw error instanceof ProviderError ? error : new ProviderError("network");
    } finally { clearTimeout(timer); }
  }};
}
