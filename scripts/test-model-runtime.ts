import {
  Miniflare,
  convertV4MiniflareOptions,
  Response as MFResponse,
} from "miniflare";
import assert from "node:assert/strict";
import fs from "node:fs";
import { anchorsForDay } from "../services/model-api/model";
const usedTokens = new Set<string>();
let modelCalls = 0;
const anchors = anchorsForDay(new Date().toISOString().slice(0, 10));
const outboundService = async (request: Request) => {
  const url = new URL(request.url);
  if (
    url.href === "https://challenges.cloudflare.com/turnstile/v0/siteverify" &&
    request.method === "POST"
  ) {
    const form = new URLSearchParams(await request.text());
    const token = form.get("response") || "";
    const ok = token.startsWith("valid-") && !usedTokens.has(token);
    usedTokens.add(token);
    return MFResponse.json({
      success: ok,
      hostname: "www.bilibilitoy.com",
      action: "vibe_quiz",
    });
  }
  if (
    url.href === "https://openrouter.ai/api/v1/chat/completions" &&
    request.method === "POST"
  ) {
    modelCalls++;
    const body = JSON.parse(await request.text());
    assert.equal(body.model, "openrouter/free");
    assert.equal(body.provider.max_price.prompt, 0);
    assert.equal(body.provider.max_price.completion, 0);
    const input = JSON.parse(body.messages[1].content);
    const content = input.cases
      ? {
          rounds: anchors.map((q) => ({
            id: q.id,
            scene: q.scene,
            replies: q.replies,
          })),
        }
      : {
          checks: [
            { met: true, evidence: input.playerAnswer.slice(0, 3) },
            { met: true, evidence: input.playerAnswer.slice(3, 6) },
            { met: true, evidence: input.playerAnswer.slice(6, 9) },
          ],
          suggestion: "补充具体验收条件。",
          quip: "这次指令终于没有让 AI 猜谜。",
        };
    return MFResponse.json({
      model: "fixture/model:free",
      choices: [
        {
          finish_reason: "stop",
          message: { content: JSON.stringify(content) },
        },
      ],
    });
  }
  throw new Error("Unexpected external fetch: " + url.origin + url.pathname);
};
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    scriptPath: "services/model-api/output/model-api/index.js",
    compatibilityDate: "2026-10-01",
    durableObjects: { GUARD: { className: "QuizGuard", useSQLite: true } },
    d1Databases: { QUIZ_DB: "quiz-db-local-tests" },
    bindings: {
      OPENROUTER_API_KEY: "local-fixture-key",
      OPENROUTER_MODEL: "openrouter/free",
      TURNSTILE_SECRET_KEY: "local-fixture-turnstile",
      TURNSTILE_SITE_KEY: "fixture-site-key",
      MODEL_DAILY_LIMIT: "2",
    },
    outboundService,
  }),
);
let count = 0;
try {
  const db = await mf.getD1Database("QUIZ_DB");
  await db.exec(
    fs
      .readFileSync(
        "services/model-api/migrations/0001_question_packs.sql",
        "utf8",
      )
      .replace(/--[^\n]*/g, "")
      .replace(/\n/g, " "),
  );
  const req = async (
    path: string,
    body: unknown,
    token?: string,
    ip = "192.0.2.7",
    origin = "https://www.bilibilitoy.com",
  ) =>
    mf.dispatchFetch("https://private.internal" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Toy-Origin": origin,
        "X-Toy-Client-IP": ip,
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
    });
  const check = (name: string) => {
    count++;
    process.stdout.write("PASS " + name + "\n");
  };
  const health = await mf.dispatchFetch("https://private.internal/health");
  assert.equal(
    ((await health.json()) as { configured: boolean }).configured,
    true,
  );
  check("private worker readiness");
  assert.equal((await req("/v1/chat/completions", {})).status, 404);
  assert.equal(
    (await req("/v1/session", { turnstileToken: "bad" })).status,
    403,
  );
  check("arbitrary proxy and invalid human token rejected");
  assert.equal(
    (
      await req("/v1/session", {
        turnstileToken: "valid-extra",
        following: true,
      })
    ).status,
    400,
  );
  assert.equal(modelCalls, 0);
  check("client-reported follows do not authenticate");
  const r = await req("/v1/session", { turnstileToken: "valid-first" });
  assert.equal(r.status, 200);
  const session = (await r.json()) as { sessionToken: string };
  assert.match(session.sessionToken, /^[A-Za-z0-9_-]{43}$/);
  check("verified short session issued");
  assert.equal(
    (await req("/v1/session", { turnstileToken: "valid-first" })).status,
    403,
  );
  check("human-token replay rejected");
  assert.equal((await req("/v1/quiz", {})).status, 401);
  assert.equal((await req("/v1/quiz", {}, "a".repeat(43))).status, 401);
  assert.equal(
    (await req("/v1/quiz", {}, session.sessionToken, "192.0.2.8")).status,
    401,
  );
  assert.equal(
    (
      await req(
        "/v1/quiz",
        {},
        session.sessionToken,
        "192.0.2.7",
        "https://www.bilibili.com",
      )
    ).status,
    401,
  );
  check("missing, forged and cross-principal sessions rejected");
  const packs = await Promise.all(
    Array.from({ length: 8 }, () => req("/v1/quiz", {}, session.sessionToken)),
  );
  for (const response of packs) assert.equal(response.status, 200);
  assert.equal(modelCalls, 1);
  const pack = (await packs[0].json()) as { rounds: { id: string }[] };
  assert.equal(pack.rounds.length, 5);
  assert(!("correct" in pack.rounds[0]));
  assert(!("replies" in pack.rounds[0]));
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM question_packs")
        .first<{ n: number }>()
    )?.n,
    1,
  );
  check("parallel generation coalesced and D1 cache stores one validated pack");
  assert.equal(
    (await req("/v1/quiz", { model: "paid/model" }, session.sessionToken))
      .status,
    400,
  );
  assert.equal(modelCalls, 1);
  check("client cannot override provider or task");
  assert.equal(
    (
      await req(
        "/v1/answer",
        { questionId: pack.rounds[1].id, choice: 0 },
        session.sessionToken,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await req(
        "/v1/answer",
        { questionId: "not-owned", choice: 0 },
        session.sessionToken,
      )
    ).status,
    403,
  );
  check("questions belong to the session and must be answered in order");
  const first = { questionId: anchors[0].id, choice: anchors[0].correct };
  const original = await req("/v1/answer", first, session.sessionToken);
  assert.equal(original.status, 200);
  const repeated = await req("/v1/answer", first, session.sessionToken);
  assert.deepEqual(await original.json(), await repeated.json());
  assert.equal(
    (
      await req(
        "/v1/answer",
        { ...first, choice: (first.choice + 1) % 3 },
        session.sessionToken,
      )
    ).status,
    409,
  );
  check(
    "duplicate answers are idempotent; changed answers cannot inflate score",
  );
  for (let i = 1; i < 4; i++)
    assert.equal(
      (
        await req(
          "/v1/answer",
          { questionId: anchors[i].id, choice: anchors[i].correct },
          session.sessionToken,
        )
      ).status,
      200,
    );
  const answer = anchors[4].example;
  const judges = await Promise.all(
    Array.from({ length: 3 }, () =>
      req(
        "/v1/judge",
        { questionId: anchors[4].id, answer },
        session.sessionToken,
      ),
    ),
  );
  assert.equal(judges.filter((x) => x.status === 200).length >= 1, true);
  assert.equal(modelCalls, 2);
  assert(judges.every((x) => [200, 409].includes(x.status)));
  check("parallel grading cannot spend multiple upstream requests");
  const again = await req(
    "/v1/judge",
    { questionId: anchors[4].id, answer },
    session.sessionToken,
  );
  assert.equal(again.status, 200);
  assert.equal(modelCalls, 2);
  check("grading replay uses the stored result");
  const second = await req(
    "/v1/session",
    { turnstileToken: "valid-second" },
    undefined,
    "192.0.2.11",
  );
  const s2 = (await second.json()) as { sessionToken: string };
  assert.equal(
    (await req("/v1/quiz", {}, s2.sessionToken, "192.0.2.11")).status,
    200,
  );
  assert.equal(modelCalls, 2);
  for (let i = 0; i < 4; i++)
    assert.equal(
      (
        await req(
          "/v1/answer",
          { questionId: anchors[i].id, choice: anchors[i].correct },
          s2.sessionToken,
          "192.0.2.11",
        )
      ).status,
      200,
    );
  assert.equal(
    (
      await req(
        "/v1/judge",
        { questionId: anchors[4].id, answer },
        s2.sessionToken,
        "192.0.2.11",
      )
    ).status,
    429,
  );
  assert.equal(modelCalls, 2);
  check("global daily model quota is enforced before external fetch");
  assert.equal(
    (
      await req(
        "/v1/answer",
        { questionId: anchors[4].id, choice: anchors[4].correct },
        s2.sessionToken,
        "192.0.2.11",
      )
    ).status,
    200,
  );
  check("choice round still works after AI quota is exhausted");
  process.stdout.write(
    `Verified ${count} local workerd security paths; real OpenRouter was not called.\n`,
  );
} finally {
  await mf.dispose();
}
