import { z } from "zod";
import {
  ApiError,
  boundedLimit,
  errorResponse,
  freeModel,
  randomToken,
  readJSON,
  reply,
  sha,
  trustedOrigin,
  verifyTurnstile,
} from "./policy";
import {
  generatePack,
  judgeAnswer,
  publicPack,
  type QuestionPack,
} from "./model";
export interface ModelEnv {
  GUARD: DurableObjectNamespace;
  QUIZ_DB: D1Database;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_HOSTNAMES?: string;
  MODEL_DAILY_LIMIT?: string;
  SESSION_DAILY_LIMIT?: string;
}
interface Session {
  hash: string;
  principal: string;
  origin: string;
  expires: number;
  progress: number;
  score: number;
  answers: string;
  pack: string;
  busy: number;
  judge_calls: number;
}
const sessionInput = z
  .object({ turnstileToken: z.string().min(1).max(2048) })
  .strict();
const choiceInput = z
  .object({
    questionId: z.string().min(1).max(40),
    choice: z.number().int().min(0).max(2),
  })
  .strict();
const judgeInput = z
  .object({
    questionId: z.string().min(1).max(40),
    answer: z.string().trim().min(3).max(280),
  })
  .strict();
function parsed<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ApiError("INVALID_REQUEST", 400);
  return r.data;
}
function status(env: ModelEnv) {
  const configured = Boolean(
    env.OPENROUTER_API_KEY?.trim() &&
      env.TURNSTILE_SECRET_KEY &&
      env.TURNSTILE_SITE_KEY,
  );
  return {
    status: configured ? "ready" : "setup_required",
    configured,
    model: freeModel(env.OPENROUTER_MODEL),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || null,
    sessionSeconds: 900,
    dailyModelLimit: boundedLimit(env.MODEL_DAILY_LIMIT, 20, 40),
  };
}
export default {
  async fetch(request: Request, env: ModelEnv): Promise<Response> {
    try {
      const path = new URL(request.url).pathname;
      if (path === "/health" && request.method === "GET")
        return reply(status(env));
      if (
        !["/v1/session", "/v1/quiz", "/v1/answer", "/v1/judge"].includes(path)
      )
        throw new ApiError("NOT_FOUND", 404);
      if (request.method !== "POST")
        throw new ApiError("METHOD_NOT_ALLOWED", 405);
      if (!trustedOrigin(request.headers.get("X-Toy-Origin")))
        throw new ApiError("ORIGIN_NOT_ALLOWED", 403);
      if (!status(env).configured)
        throw new ApiError("MODEL_NOT_CONFIGURED", 503);
      return await env.GUARD.get(env.GUARD.idFromName("quiz-global-v1")).fetch(
        request,
      );
    } catch (e) {
      return errorResponse(e);
    }
  },
};
/** One SQLite-backed coordinator enforces global quotas across isolates and regions. */
export class QuizGuard {
  private sql: SqlStorage;
  private salt = "";
  private generation: Promise<QuestionPack> | null = null;
  private dailyPack: QuestionPack | null = null;
  constructor(
    private ctx: DurableObjectState,
    private env: ModelEnv,
  ) {
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS quota (key TEXT PRIMARY KEY,used INTEGER NOT NULL,expires INTEGER NOT NULL)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY,principal TEXT NOT NULL,origin TEXT NOT NULL,expires INTEGER NOT NULL,progress INTEGER NOT NULL DEFAULT 0,score INTEGER NOT NULL DEFAULT 0,answers TEXT NOT NULL DEFAULT '[]',pack TEXT NOT NULL DEFAULT '',busy INTEGER NOT NULL DEFAULT 0,judge_calls INTEGER NOT NULL DEFAULT 0)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY,payload TEXT NOT NULL,expires INTEGER NOT NULL)",
    );
    ctx.blockConcurrencyWhile(async () => {
      this.salt = (await ctx.storage.get<string>("ip-salt")) || randomToken();
      await ctx.storage.put("ip-salt", this.salt);
    });
  }
  private now() {
    return Math.floor(Date.now() / 1000);
  }
  private spend(limits: { key: string; max: number; expires: number }[]) {
    for (const limit of limits) {
      const row = this.sql
        .exec("SELECT used FROM quota WHERE key=?", limit.key)
        .toArray()[0];
      if (Number(row?.used || 0) >= limit.max)
        throw new ApiError(
          "RATE_LIMITED",
          429,
          Math.max(1, limit.expires - this.now()),
        );
    }
    for (const limit of limits)
      this.sql.exec(
        "INSERT INTO quota(key,used,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET used=used+1",
        limit.key,
        limit.expires,
      );
  }
  private reserve(limits: { key: string; max: number; expires: number }[]) {
    this.ctx.storage.transactionSync(() => this.spend(limits));
  }
  private async principal(request: Request) {
    const ip = request.headers.get("X-Toy-Client-IP") || "";
    if (!ip || ip.length > 100)
      throw new ApiError("CLIENT_ADDRESS_REQUIRED", 403);
    return sha(this.salt + "|" + ip);
  }
  private async auth(request: Request, principal: string, origin: string) {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
      request.headers.get("Authorization") || "",
    )?.[1];
    if (!token) throw new ApiError("SESSION_REQUIRED", 401);
    const hash = await sha(token);
    const row = this.sql
      .exec("SELECT * FROM sessions WHERE hash=?", hash)
      .toArray()[0] as unknown as Session | undefined;
    if (
      !row ||
      row.expires <= this.now() ||
      row.principal !== principal ||
      row.origin !== origin
    )
      throw new ApiError("SESSION_INVALID", 401);
    return row;
  }
  private async pack(): Promise<QuestionPack> {
    const day = new Date().toISOString().slice(0, 10),
      key = "daily-" + day;
    if (this.dailyPack?.id === key) return this.dailyPack;
    if (this.generation) return this.generation;
    this.generation = (async () => {
      const cached = await this.env.QUIZ_DB.prepare(
        "SELECT payload FROM question_packs WHERE id=? AND expires>?",
      )
        .bind(key, this.now())
        .first<{ payload: string }>();
      if (cached) {
        this.dailyPack = JSON.parse(cached.payload) as QuestionPack;
        return this.dailyPack;
      }
      const cooldown = this.sql
        .exec(
          "SELECT expires FROM cache WHERE key='model-cooldown' AND expires>?",
          this.now(),
        )
        .toArray()[0];
      if (cooldown)
        throw new ApiError(
          "MODEL_COOLDOWN",
          429,
          Number(cooldown.expires) - this.now(),
        );
      const end = Math.floor(Date.parse(day + "T00:00:00Z") / 1000) + 86400;
      this.reserve([
        {
          key: "model:" + day,
          max: boundedLimit(this.env.MODEL_DAILY_LIMIT, 20, 40),
          expires: end,
        },
        {
          key: "model-minute:" + Math.floor(this.now() / 60),
          max: 4,
          expires: this.now() + 60,
        },
      ]);
      const pack = await generatePack(
        this.env.OPENROUTER_API_KEY!,
        freeModel(this.env.OPENROUTER_MODEL),
        day,
      );
      await this.env.QUIZ_DB.batch([
        this.env.QUIZ_DB.prepare(
          "DELETE FROM question_packs WHERE expires<=?",
        ).bind(this.now()),
        this.env.QUIZ_DB.prepare(
          "INSERT OR REPLACE INTO question_packs(id,payload,expires) VALUES(?,?,?)",
        ).bind(key, JSON.stringify(pack), end),
      ]);
      this.dailyPack = pack;
      return pack;
    })()
      .catch((e) => {
        this.sql.exec(
          "INSERT OR REPLACE INTO cache(key,payload,expires) VALUES('model-cooldown','{}',?)",
          this.now() + 60,
        );
        throw e;
      })
      .finally(() => {
        this.generation = null;
      });
    return this.generation;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const origin = request.headers.get("X-Toy-Origin");
      if (!trustedOrigin(origin)) throw new ApiError("ORIGIN_NOT_ALLOWED", 403);
      const path = new URL(request.url).pathname;
      const now = this.now(),
        day = new Date().toISOString().slice(0, 10),
        end = Math.floor(Date.parse(day + "T00:00:00Z") / 1000) + 86400;
      const principal = await this.principal(request);
      this.reserve([
        { key: "ingress:" + day, max: 8000, expires: end },
        {
          key: "burst:" + principal + ":" + Math.floor(now / 60),
          max: 30,
          expires: now + 60,
        },
      ]);
      const value = await readJSON(request);
      if (path === "/v1/session") {
        const input = parsed(sessionInput, value);
        this.reserve([
          {
            key: "verify:" + principal + ":" + Math.floor(now / 600),
            max: 8,
            expires: now + 600,
          },
        ]);
        const hosts = (
          this.env.TURNSTILE_HOSTNAMES || "www.bilibili.com,www.bilibilitoy.com"
        )
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        await verifyTurnstile(
          input.turnstileToken,
          this.env.TURNSTILE_SECRET_KEY!,
          request.headers.get("X-Toy-Client-IP")!,
          hosts,
        );
        const token = randomToken(),
          hash = await sha(token);
        this.ctx.storage.transactionSync(() => {
          this.spend([
            {
              key: "sessions:" + principal + ":" + day,
              max: boundedLimit(this.env.SESSION_DAILY_LIMIT, 5, 10),
              expires: end,
            },
          ]);
          this.sql.exec("DELETE FROM sessions WHERE expires<=?", now);
          this.sql.exec("DELETE FROM quota WHERE expires<=?", now);
          this.sql.exec("DELETE FROM cache WHERE expires<=?", now);
          this.sql.exec(
            "INSERT INTO sessions(hash,principal,origin,expires) VALUES(?,?,?,?)",
            hash,
            principal,
            origin,
            now + 900,
          );
        });
        return reply({
          sessionToken: token,
          expiresAt: new Date((now + 900) * 1000).toISOString(),
        });
      }
      const session = await this.auth(request, principal, origin);
      if (path === "/v1/quiz") {
        parsed(z.object({}).strict(), value);
        if (session.pack) return reply(publicPack(JSON.parse(session.pack)));
        const pack = await this.pack();
        // Once a session owns a pack it cannot switch to another day's answers mid-game.
        this.sql.exec(
          "UPDATE sessions SET pack=? WHERE hash=? AND pack=''",
          JSON.stringify(pack),
          session.hash,
        );
        const actual = this.sql
          .exec("SELECT pack FROM sessions WHERE hash=?", session.hash)
          .toArray()[0];
        return reply(publicPack(JSON.parse(String(actual.pack))));
      }
      if (!session.pack) throw new ApiError("QUIZ_REQUIRED", 409);
      const pack = JSON.parse(session.pack) as QuestionPack;
      const answers = JSON.parse(session.answers) as Record<string, unknown>[];
      if (path === "/v1/answer") {
        const input = parsed(choiceInput, value);
        const index = pack.rounds.findIndex((q) => q.id === input.questionId);
        if (index < 0) throw new ApiError("QUESTION_NOT_IN_SESSION", 403);
        if (index < session.progress) {
          const old = answers[index];
          if (old?.choice !== input.choice)
            throw new ApiError("ANSWER_ALREADY_SUBMITTED", 409);
          return reply(old);
        }
        if (index !== session.progress || session.busy)
          throw new ApiError("ROUND_OUT_OF_ORDER", 409);
        const round = pack.rounds[index],
          correct = input.choice === round.correct;
        const answer = {
          questionId: round.id,
          choice: input.choice,
          correct,
          score: correct ? 100 : 0,
          quip: round.replies[input.choice],
          lesson: round.lesson,
          correctChoice: round.correct,
          example: round.example,
        };
        answers.push(answer);
        const cursor = this.sql.exec(
          "UPDATE sessions SET progress=progress+1,score=score+?,answers=? WHERE hash=? AND progress=? AND busy=0",
          answer.score,
          JSON.stringify(answers),
          session.hash,
          index,
        );
        if (!cursor.rowsWritten) throw new ApiError("ROUND_OUT_OF_ORDER", 409);
        return reply(answer);
      }
      if (path === "/v1/judge") {
        const input = parsed(judgeInput, value);
        const round = pack.rounds[4];
        if (input.questionId !== round.id)
          throw new ApiError("QUESTION_NOT_IN_SESSION", 403);
        const answerHash = await sha(input.answer);
        if (session.progress === 5) {
          const old = answers[4];
          if (old?.answerHash === answerHash) return reply(old);
          throw new ApiError("ANSWER_ALREADY_SUBMITTED", 409);
        }
        if (session.progress !== 4)
          throw new ApiError("ROUND_OUT_OF_ORDER", 409);
        this.ctx.storage.transactionSync(() => {
          const claimed = this.sql.exec(
            "UPDATE sessions SET busy=1,judge_calls=judge_calls+1 WHERE hash=? AND busy=0 AND progress=4 AND judge_calls=0",
            session.hash,
          );
          if (!claimed.rowsWritten)
            throw new ApiError("JUDGE_ALREADY_REQUESTED", 409);
          this.spend([
            {
              key: "model:" + day,
              max: boundedLimit(this.env.MODEL_DAILY_LIMIT, 20, 40),
              expires: end,
            },
            {
              key: "model-minute:" + Math.floor(now / 60),
              max: 4,
              expires: now + 60,
            },
          ]);
        });
        try {
          const result = await judgeAnswer(
            this.env.OPENROUTER_API_KEY!,
            freeModel(this.env.OPENROUTER_MODEL),
            round,
            input.answer,
          );
          const answer = {
            ...result,
            questionId: round.id,
            answerHash,
            correct: result.score >= 67,
            lesson: round.lesson,
            example: round.example,
          };
          answers.push(answer);
          this.sql.exec(
            "UPDATE sessions SET progress=5,score=score+?,answers=?,busy=0 WHERE hash=?",
            result.score,
            JSON.stringify(answers),
            session.hash,
          );
          return reply(answer);
        } catch (e) {
          this.sql.exec(
            "UPDATE sessions SET busy=0 WHERE hash=?",
            session.hash,
          );
          throw e;
        }
      }
      throw new ApiError("NOT_FOUND", 404);
    } catch (e) {
      return errorResponse(e);
    }
  }
}
