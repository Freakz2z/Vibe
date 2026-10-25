import { API_ORIGIN } from "../../lib/runtime";
export interface GameConfig {
  configured: boolean;
  turnstileSiteKey: string | null;
  sessionSeconds: number;
  dailyModelLimit: number;
}
export interface Round {
  id: string;
  title: string;
  scene: string;
  clue: string;
  choices: readonly string[];
  challenge: string;
}
export interface Pack {
  id: string;
  source: "openrouter" | "authored";
  rounds: Round[];
}
export interface Answer {
  questionId: string;
  choice?: number;
  correct: boolean;
  score: number;
  quip: string;
  lesson: string;
  correctChoice?: number;
  example: string;
  suggestion?: string;
  checks?: { criterion: string; met: boolean; evidence: string }[];
}
export class GameError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function gameRequest<T>(
  action: string,
  body?: unknown,
  token?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(API_ORIGIN + "/api/toy/game/" + action, {
    method: body === undefined ? "GET" : "POST",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(35000)])
      : AbortSignal.timeout(35000),
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "SERVICE_UNAVAILABLE" }));
  if (!response.ok)
    throw new GameError(
      typeof data.error === "string" ? data.error : "SERVICE_UNAVAILABLE",
    );
  return data as T;
}
export function errorMessage(error: unknown) {
  const code = error instanceof GameError ? error.code : "";
  if (/RATE_LIMIT|COOLDOWN/.test(code))
    return "AI 今天有点忙，先玩固定题库吧。";
  if (/SESSION/.test(code)) return "本局会话已过期，请重新开始。";
  if (/HUMAN_VERIFICATION/.test(code)) return "验证没有通过，请重新验证。";
  return "AI 暂时没接上，可以切换固定题库继续玩。";
}
