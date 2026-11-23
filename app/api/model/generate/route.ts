import { Buffer } from "node:buffer";
import { z } from "zod";
import { createDeepSeekProvider } from "../../../../lib/providers/deepseek-provider.ts";
import { createMockProvider } from "../../../../lib/providers/mock-provider.ts";
import { generationSchema } from "../../../../lib/providers/model-provider.ts";
import { ProviderRegistry } from "../../../../lib/providers/provider-registry.ts";
import { errorStatus, ProviderError } from "../../../../lib/providers/provider-errors.ts";

export const runtime = "nodejs";
const limit = 65536;
const bodySchema = z.strictObject({
  provider: z.string().min(1).max(64).optional(),
  request: generationSchema,
});

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > limit) throw new ProviderError("too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new ProviderError("invalid_request");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new ProviderError("too_large");
      }
      chunks.push(value);
    }
    return bodySchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    throw error instanceof ProviderError ? error : new ProviderError("invalid_request");
  } finally { reader.releaseLock(); }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ProviderError("forbidden");
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
      throw new ProviderError("invalid_request");
    const body = await readBody(request);
    const registry = new ProviderRegistry();
    registry.register(createMockProvider());
    registry.register(createDeepSeekProvider());
    registry.setDefault(process.env.DEFAULT_LLM_PROVIDER || "mock");
    const provider = registry.select(body.provider, body.request.model);
    return Response.json(await provider.generate(body.request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : "configuration";
    return Response.json({ error: code }, { status: errorStatus[code] });
  }
}
