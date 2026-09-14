import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/chat/route";
import { readChatRequest } from "../../src/lib/chatRequest";
import { maximumChatBodyBytes, maximumChatMessages, serializeChatRequest } from "../../src/lib/chatHistory";
import { RateLimiter } from "../../src/lib/rateLimit";
import type { ChatRequest } from "../../src/types/chat";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Server request limits are independent of the browser engine.");
});

function jsonRequest(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(payload),
  });
}

test("chat cooldown, request budget and window expiry remain enforced", () => {
  let now = 0;
  const limiter = new RateLimiter(() => now);
  expect(limiter.check("client").allowed).toBe(true);
  now = 1_499;
  expect(limiter.check("client")).toEqual({ allowed: false, retryAfterSeconds: 1 });
  for (let request = 1; request < 12; request += 1) {
    now = request * 1_500;
    expect(limiter.check("client").allowed).toBe(true);
  }
  now = 18_000;
  expect(limiter.check("client")).toEqual({ allowed: false, retryAfterSeconds: 42 });
  now = 60_000;
  expect(limiter.check("client").allowed).toBe(true);
});

test("rotating client keys cannot grow or displace a full limiter and expired entries release capacity", () => {
  let now = 0;
  const limiter = new RateLimiter(() => now);
  for (let client = 0; client < 5_000; client += 1) {
    expect(limiter.check(`original-${client}`).allowed).toBe(true);
  }
  for (let client = 0; client < 1_000; client += 1) {
    expect(limiter.check(`rejected-${client}`)).toEqual({ allowed: false, retryAfterSeconds: 10 });
  }
  expect(limiter.check("original-0").allowed, "new keys must not evict active rate limits").toBe(false);
  now = 1_500;
  expect(limiter.check("original-0").allowed, "known clients still work when capacity is reached").toBe(true);
  now = 60_000;
  for (let client = 0; client < 5_000; client += 1) {
    expect(limiter.check(`replacement-${client}`).allowed, "new requests must sweep expired keys before insertion").toBe(true);
  }
  expect(limiter.check("overflow").allowed).toBe(false);
});

test("an unknown-length upload is cancelled as soon as its bytes exceed the body limit", async () => {
  let chunksRead = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunksRead += 1;
      controller.enqueue(new Uint8Array(1_024).fill(32));
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half",
  };
  const request = new Request("http://localhost/api/chat", init);
  expect(request.headers.has("content-length")).toBe(false);
  expect(await readChatRequest(request)).toBeNull();
  expect(cancelled).toBe(true);
  expect(chunksRead, "a never-ending upload must stop after the first oversized chunk").toBe(20);
});

test("body limits count UTF-8 bytes, preserve split characters and reject misleading lengths", async () => {
  const valid = { locale: "ru", messages: [{ role: "user", content: "Клавиатура" }] };
  const encoded = new TextEncoder().encode(JSON.stringify(valid));
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === encoded.length) controller.close();
      else controller.enqueue(encoded.subarray(index, ++index));
    },
  });
  const init: RequestInit & { duplex: "half" } = {
    method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half",
  };
  expect(await readChatRequest(new Request("http://localhost/api/chat", init))).toEqual(valid);

  const oversized = { locale: "ru", messages: Array.from({ length: 3 }, () => ({ role: "assistant", content: "Я".repeat(4_000) })) };
  expect(JSON.stringify(oversized).length).toBeLessThan(20_000);
  expect(await readChatRequest(jsonRequest(oversized, { "content-length": "1" }))).toBeNull();
  expect(await readChatRequest(jsonRequest(valid, { "content-length": "20001" }))).toBeNull();
  expect(await readChatRequest(jsonRequest(valid, { "content-type": "text/plain" }))).toBeNull();
});

test("long assistant history is valid while user and assistant limits stay bounded", async () => {
  const history = { locale: "en", messages: [
    { role: "assistant", content: "A".repeat(2_000) },
    { role: "user", content: "Which switch is quieter?" },
  ] };
  expect(await readChatRequest(jsonRequest(history))).toEqual(history);
  for (const [role, length] of [["user", 801], ["assistant", 4_001]] as const) {
    expect(await readChatRequest(jsonRequest({ locale: "en", messages: [{ role, content: "x".repeat(length) }] }))).toBeNull();
  }
});

test("outgoing Russian history fits the byte budget without truncating the latest question", async () => {
  const messages: ChatRequest["messages"] = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? "user" : "assistant",
    content: "Я".repeat(index % 2 ? 800 : 1_000),
  }));
  const original = JSON.stringify({ locale: "ru", messages });
  expect(new TextEncoder().encode(original).byteLength).toBeGreaterThan(maximumChatBodyBytes);
  const body = serializeChatRequest("ru", messages);
  expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(maximumChatBodyBytes);
  const parsed = await readChatRequest(new Request("http://localhost/api/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body,
  }));
  expect(parsed).not.toBeNull();
  expect(parsed!.messages).toEqual(messages.slice(-parsed!.messages.length));
  expect(parsed!.messages.at(-1)).toEqual(messages.at(-1));
  expect(messages).toHaveLength(12);
});

test("outgoing short history keeps the newest message-count window and strips local IDs", () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({
    id: `local-${index}`, role: "user" as const, content: `Question ${index}`,
  }));
  const parsed = JSON.parse(serializeChatRequest("en", messages)) as ChatRequest;
  expect(parsed.messages).toEqual(messages.slice(-maximumChatMessages).map(({ role, content }) => ({ role, content })));
});

test("chat route rejects invalid requests and accepts long history without calling a provider", async () => {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const makeRequest = (id: string, contentType: string, messages: unknown) => new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": contentType, "x-forwarded-for": `chat-route-test-${id}` },
      body: JSON.stringify({ locale: "ru", messages }),
    });
    const invalid = await POST(makeRequest("invalid", "text/plain", [{ role: "user", content: "Привет" }]));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "invalid_request" });
    const accepted = await POST(makeRequest("accepted", "application/json", [
      { role: "assistant", content: "А".repeat(1_500) },
      { role: "user", content: "Какой свитч тише?" },
    ]));
    expect(accepted.status).toBe(503);
    expect(await accepted.json()).toEqual({ error: "unavailable" });
    const limited = await POST(makeRequest("accepted", "application/json", [{ role: "user", content: "Повтор" }]));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  } finally {
    if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiApiKey;
    if (originalOpenRouterApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }
});

test("OpenRouter uses free routing and retries rather than returning a truncated answer", async () => {
  const originalFetch = globalThis.fetch;
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;
  const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
  const requestBodies: Array<{ model?: unknown; max_tokens?: unknown }> = [];
  let calls = 0;

  process.env.OPENROUTER_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { model?: unknown; max_tokens?: unknown };
    requestBodies.push({ model: body.model, max_tokens: body.max_tokens });
    calls += 1;
    return Response.json({
      choices: [{
        finish_reason: calls === 1 ? "length" : "stop",
        message: { content: calls === 1 ? "Незаконченный ответ" : "Полный ответ." },
      }],
    });
  }) as typeof fetch;

  try {
    const response = await POST(new NextRequest("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "chat-route-free-retry-test" },
      body: JSON.stringify({ locale: "ru", messages: [{ role: "user", content: "Подойдёт ли для игр?" }] }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "Полный ответ." });
    expect(requestBodies).toEqual([
      { model: "openrouter/free", max_tokens: 1_200 },
      { model: "openrouter/free", max_tokens: 2_400 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalGeminiApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiApiKey;
    if (originalOpenRouterApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }
});
