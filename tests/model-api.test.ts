import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  boundedLimit,
  freeModel,
  limitedText,
  readJSON,
  trustedOrigin,
  verifyTurnstile,
} from "../services/model-api/policy";
import {
  anchorsForDay,
  completion,
  generatePack,
  judgeAnswer,
  publicPack,
} from "../services/model-api/model";
import { QUIZ_SCENARIOS } from "../shared/quiz/scenarios";
import { toyGameFetch } from "../src/toy-game";

test("free model policy cannot route to a paid model, URL, fallback array, or malformed server limit", () => {
  assert.equal(freeModel(), "openrouter/free");
  assert.equal(freeModel("vendor/name:free"), "vendor/name:free");
  for (const v of [
    "openrouter/auto",
    "vendor/name",
    "https://evil.test:free",
    "vendor/name:free,paid/model",
    "vendor/../../name:free",
  ])
    assert.throws(() => freeModel(v), ApiError);
  assert.equal(boundedLimit(undefined, 20, 40), 20);
  for (const value of ["0", "41", "-1", "NaN", "1.5"])
    assert.throws(() => boundedLimit(value, 20, 40), ApiError);
});
test("request and streamed upstream bodies have real byte caps", async () => {
  await assert.rejects(
    readJSON(new Request("https://test", { method: "POST", body: "{}" })),
    { code: "JSON_REQUIRED" },
  );
  await assert.rejects(
    readJSON(
      new Request("https://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{oops",
      }),
    ),
    { code: "INVALID_JSON" },
  );
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("中文中文"));
      c.close();
    },
  });
  await assert.rejects(limitedText(new Response(stream), 8), {
    code: "BODY_TOO_LARGE",
  });
});
test("Turnstile requires successful verification with the exact expected hostname and action", async () => {
  for (const payload of [
    { success: false },
    { success: true, hostname: "evil.test", action: "vibe_quiz" },
    { success: true, hostname: "www.bilibili.com", action: "other" },
  ]) {
    await assert.rejects(
      verifyTurnstile(
        "untrusted",
        "secret",
        "127.0.0.1",
        ["www.bilibili.com"],
        (async () => Response.json(payload)) as typeof fetch,
      ),
      { code: "HUMAN_VERIFICATION_FAILED" },
    );
  }
  await verifyTurnstile(
    "opaque",
    "secret",
    "127.0.0.1",
    ["www.bilibili.com"],
    (async () =>
      Response.json({
        success: true,
        hostname: "www.bilibili.com",
        action: "vibe_quiz",
      })) as typeof fetch,
  );
});
test("public gateway rejects spoofed origins, credentials, methods and arbitrary prompts without invoking the model", async () => {
  let calls = 0;
  const env = {
    TOY_MODEL: {
      fetch: async () => {
        calls++;
        return Response.json({ ok: true });
      },
    } as unknown as Fetcher,
  };
  for (const origin of [
    "null",
    "https://evil.test",
    "https://www.bilibili.com.evil.test",
  ]) {
    assert(!trustedOrigin(origin));
    assert.equal(
      (
        await toyGameFetch(
          new Request("https://vibe.test/api/toy/game/quiz", {
            method: "POST",
            headers: { Origin: origin },
          }),
          env,
        )
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await toyGameFetch(
        new Request("https://vibe.test/api/toy/game/quiz", {
          method: "POST",
          headers: {
            Origin: "https://www.bilibili.com",
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
        env,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await toyGameFetch(
        new Request("https://vibe.test/api/toy/game/chat/completions", {
          method: "POST",
          headers: { Origin: "https://www.bilibili.com" },
        }),
        env,
      )
    ).status,
    404,
  );
  assert.equal(calls, 0);
});
test("gateway discards client-selected authority, identity and routing headers", async () => {
  let forwarded: Request | undefined;
  const env = {
    TOY_MODEL: {
      fetch: async (req: Request) => {
        forwarded = req;
        return Response.json({ ok: true });
      },
    } as unknown as Fetcher,
  };
  const request = new Request("https://vibe.test/api/toy/game/quiz", {
    method: "POST",
    headers: {
      Origin: "https://www.bilibili.com",
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.5",
      Authorization: "Bearer " + "a".repeat(43),
      Cookie: "secret-session",
      "X-Toy-Client-IP": "evil",
      "X-API-Key": "do-not-forward",
    },
    body: "{}",
  });
  const r = await toyGameFetch(request, env);
  assert.equal(r.status, 200);
  assert.equal(forwarded?.headers.get("Cookie"), null);
  assert.equal(forwarded?.headers.get("X-API-Key"), null);
  assert.equal(forwarded?.headers.get("X-Toy-Client-IP"), "192.0.2.5");
  assert.equal(new URL(forwarded!.url).host, "model.internal");
});
test("upstream protocol pins the endpoint, free routing and template, and never exposes credentials in errors", async () => {
  let body: Record<string, unknown> | undefined;
  const send = (async (url: string, init: RequestInit) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    body = JSON.parse(init.body as string);
    assert.equal(init.redirect, "manual");
    return Response.json(
      { error: { message: "private-provider-error-token" } },
      { status: 401 },
    );
  }) as typeof fetch;
  await assert.rejects(
    completion(
      "test-key",
      "openrouter/free",
      "fixed task",
      { answer: "untrusted" },
      100,
      send,
    ),
    { code: "MODEL_CONFIGURATION_REQUIRED" },
  );
  assert.equal(body?.model, "openrouter/free");
  assert(!("tools" in body!));
  assert(!("models" in body!));
  assert.deepEqual(body?.provider, {
    require_parameters: true,
    max_price: { prompt: 0, completion: 0, request: 0 },
  });
});
test("question generation keeps authored answers and rejects missing, duplicated or substituted anchor IDs", async () => {
  const day = "2026-10-25",
    anchors = anchorsForDay(day);
  assert.equal(new Set(anchors.map((x) => x.id)).size, 5);
  assert.deepEqual(anchorsForDay(day), anchors);
  const rounds = anchors.map((q) => ({
    id: q.id,
    scene: q.scene,
    replies: q.replies,
  }));
  const send = (async () =>
    Response.json({
      model: "test/model:free",
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify({ rounds }) },
        },
      ],
    })) as typeof fetch;
  const pack = await generatePack("test", "openrouter/free", day, send);
  assert.deepEqual(
    pack.rounds.map((r) => r.correct),
    anchors.map((r) => r.correct),
  );
  assert(!("correct" in publicPack(pack).rounds[0]));
  rounds[0].id = "invented";
  await assert.rejects(generatePack("test", "openrouter/free", day, send), {
    code: "INVALID_MODEL_RESPONSE",
  });
});
test("free-answer score is computed server-side and every positive criterion must quote the actual player answer", async () => {
  const answer = "只修改预约按钮，保留收藏，并测试预约和收藏";
  const question = QUIZ_SCENARIOS[0];
  const payload = {
    checks: [
      { met: true, evidence: "只修改预约按钮" },
      { met: true, evidence: "保留收藏" },
      { met: true, evidence: "测试预约和收藏" },
    ],
    suggestion: "补充失败状态的验收。",
    quip: "这次补丁没有顺便拆掉房子。",
  };
  const send = (async () =>
    Response.json({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    })) as typeof fetch;
  const result = await judgeAnswer(
    "test",
    "openrouter/free",
    question,
    answer,
    send,
  );
  assert.equal(result.score, 100);
  payload.checks[0].evidence = "并不存在的玩家原文";
  await assert.rejects(
    judgeAnswer("test", "openrouter/free", question, answer, send),
    { code: "INVALID_MODEL_RESPONSE" },
  );
});
