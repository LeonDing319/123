import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeepSeekProvider } from "./deepseek-provider.ts";
import { createMockProvider } from "./mock-provider.ts";
import { ProviderRegistry } from "./provider-registry.ts";
import { POST } from "../../app/api/model/generate/route.ts";

const input = { messages: [{ role: "user", content: "JSON please" }], responseFormat: "json" } as const;
const request = { ...input, messages: [...input.messages] };
const fixture = {
  id: "fixture-1", model: "deepseek-flash", choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
  usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
};

function testKey(t: import("node:test").TestContext, key = "test-key-only") {
  const original = process.env.DEEPSEEK_API_KEY;
  if (key) process.env.DEEPSEEK_API_KEY = key;
  else delete process.env.DEEPSEEK_API_KEY;
  t.after(() => {
    if (original === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = original;
  });
}

test("registry selects providers, models, defaults and supported formats", async () => {
  const registry = new ProviderRegistry();
  registry.register(createMockProvider());
  registry.register(createMockProvider("plain", false));
  registry.register(createDeepSeekProvider("deepseek-flash"));
  registry.setDefault("mock", "plain");
  assert.deepEqual(registry.capabilities(), ["text"]);
  await assert.rejects(registry.select().generate(request), { code: "unsupported_capability" });
  assert.equal((await registry.select("mock", "mock-v1").generate(request)).content, '{"mock":true}');
  assert.throws(() => registry.register(createMockProvider()), { code: "configuration" });
  assert.throws(() => registry.select("unknown"), { code: "unknown_model" });
  assert.throws(() => registry.select("mock", "wrong-model"), { code: "unknown_model" });
  registry.setDefault("deepseek");
  assert.equal(registry.select().modelId, "deepseek-flash");
});

test("DeepSeek maps the official wire request, JSON, metadata and reported usage", async t => {
  testKey(t);
  const provider = createDeepSeekProvider("deepseek-flash", async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-key-only");
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.model, "deepseek-flash");
    assert.equal(body.max_tokens, 31);
    assert.match(body.messages[0].content, /JSON/);
    return Response.json(fixture);
  });
  const result = await provider.generate({ ...request, maxOutputTokens: 31 });
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 5, totalTokens: 17 });
  assert.deepEqual(JSON.parse(result.content), { ok: true });
  assert.equal(result.metadata.requestId, "fixture-1");
});

for (const [status, code] of [[401,"authentication"], [402,"insufficient_balance"], [429,"rate_limited"], [503,"upstream"]] as const) {
  test("DeepSeek sanitizes HTTP " + status, async t => {
    testKey(t);
    const provider = createDeepSeekProvider("deepseek-flash", async () => new Response("test-key-only", { status }));
    await assert.rejects(provider.generate(request), { code, message: code });
  });
}

test("missing credential fails before outbound transport", async t => {
  testKey(t, "");
  const provider = createDeepSeekProvider("deepseek-flash", async () => assert.fail("unexpected transport"));
  await assert.rejects(provider.generate(request), { code: "missing_key" });
});

test("network failure strips transport diagnostics", async t => {
  testKey(t);
  const provider = createDeepSeekProvider("deepseek-flash", async () => { throw new Error("test-key-only"); });
  await assert.rejects(provider.generate(request), { code: "network", message: "network" });
});

test("deadline aborts even when transport does not settle", async t => {
  testKey(t);
  let signal: AbortSignal | null | undefined;
  const provider = createDeepSeekProvider("deepseek-flash", (_, init) => {
    signal = init?.signal;
    return new Promise(() => {});
  });
  await assert.rejects(provider.generate(request, { timeoutMs: 10 }), { code: "timeout" });
  assert.ok(signal?.aborted);
});

for (const content of [" ", "[]", "broken", "null"]) {
  test("invalid JSON object result " + JSON.stringify(content), async t => {
    testKey(t);
    const provider = createDeepSeekProvider("deepseek-flash", async () => Response.json({
      ...fixture, choices: [{ message: { content }, finish_reason: "stop" }],
    }));
    await assert.rejects(provider.generate(request), { code: "invalid_response" });
  });
}

test("malformed completion envelope fails closed", async t => {
  testKey(t);
  const provider = createDeepSeekProvider("deepseek-flash", async () => Response.json({ choices: [] }));
  await assert.rejects(provider.generate(request), { code: "invalid_response" });
});

test("text mode leaves unreported usage absent and preserves the stop reason", async t => {
  testKey(t);
  const provider = createDeepSeekProvider("deepseek-v4-pro", async () => Response.json({
    id: "fixture-2", model: "deepseek-v4-pro",
    choices: [{ finish_reason: "length", message: { content: "partial reply" } }],
  }));
  const result = await provider.generate({ ...request, responseFormat: "text" });
  assert.equal(result.finishReason, "length");
  assert.equal(result.usage, undefined);
  assert.throws(() => createDeepSeekProvider("not-registered"), { code: "unknown_model" });
});

test("credential reflection in a successful response is suppressed", async t => {
  testKey(t);
  const provider = createDeepSeekProvider("deepseek-flash", async () => Response.json({
    ...fixture, id: "test-key-only",
  }));
  await assert.rejects(provider.generate(request), { code: "invalid_response", message: "invalid_response" });
});

function post(body: string, headers: Record<string,string> = {}) {
  return POST(new Request("http://localhost/api/model/generate", { method: "POST",
    headers: { "Content-Type": "application/json", ...headers }, body }));
}

test("server dispatches mock and emits no estimated usage", async () => {
  const response = await post(JSON.stringify({ provider: "mock", request }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.metadata.providerId, "mock");
  assert.equal(result.usage, undefined);
});

test("server rejects cross-origin, oversized, malformed and out-of-policy requests", async () => {
  assert.equal((await post("{}", { origin: "https://example.net" })).status, 403);
  assert.equal((await post("x".repeat(65537))).status, 413);
  assert.equal((await post("{}" , { "content-length": "70000" })).status, 413);
  assert.equal((await post("invalid")).status, 400);
  for (const body of [
    { provider: "unknown", request }, { provider: "mock", request: { ...request, model: "remote" } },
    { request, gameState: {} }, { request: { ...request, apiKey: "forbidden" } },
    { request: { ...request, messages: [{ role: "user", content: "x".repeat(8001) }] } },
  ]) assert.equal((await post(JSON.stringify(body))).status, 400);
});
