import { defineProvider, type Generation } from "./model-provider.ts";

export function createMockProvider(modelId = "mock-v1", json = true, reply?: (input: Generation) => string) {
  const providerId = "mock";
  return defineProvider({ providerId, modelId, formats: json ? ["text", "json"] : ["text"] },
    async (input) => ({
      content: reply ? reply(input) : input.responseFormat === "json" ? '{"mock":true}' : "Mock response",
      finishReason: "stop", metadata: { providerId, modelId },
    }));
}
