export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(code);
  }
}
export const TRUSTED_ORIGINS = [
  "https://www.bilibili.com",
  "https://www.bilibilitoy.com",
] as const;
export function trustedOrigin(
  value: string | null,
): value is (typeof TRUSTED_ORIGINS)[number] {
  return TRUSTED_ORIGINS.includes(value as (typeof TRUSTED_ORIGINS)[number]);
}
export function freeModel(value = "openrouter/free") {
  if (
    value === "openrouter/free" ||
    /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free$/.test(value)
  )
    return value;
  throw new ApiError("FREE_MODEL_REQUIRED", 503);
}
export function boundedLimit(
  value: string | undefined,
  fallback: number,
  max: number,
) {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new ApiError("INVALID_SERVER_LIMIT", 503);
  const n = Number(value);
  if (n < 1 || n > max) throw new ApiError("INVALID_SERVER_LIMIT", 503);
  return n;
}
export async function limitedText(response: Response | Request, max: number) {
  if (Number(response.headers.get("Content-Length")) > max)
    throw new ApiError("BODY_TOO_LARGE", 413);
  if (!response.body) return "";
  const reader = response.body.getReader();
  let size = 0;
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ApiError("BODY_TOO_LARGE", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export async function readJSON(request: Request, max = 4096): Promise<unknown> {
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ApiError("JSON_REQUIRED", 415);
  try {
    return JSON.parse(await limitedText(request, max));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("INVALID_JSON", 400);
  }
}
export function reply(data: unknown, status = 200, extra?: HeadersInit) {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(data), { status, headers });
}
export function errorResponse(error: unknown) {
  const e =
    error instanceof ApiError
      ? error
      : new ApiError("SERVICE_UNAVAILABLE", 503);
  return reply(
    { error: e.code },
    e.status,
    e.retryAfter ? { "Retry-After": String(e.retryAfter) } : undefined,
  );
}
export async function sha(value: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function randomToken() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip: string,
  hostnames: readonly string[],
  send: typeof fetch = fetch,
) {
  if (!secret) throw new ApiError("HUMAN_VERIFICATION_NOT_CONFIGURED", 503);
  const result = await send(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    },
  );
  if (!result.ok) throw new ApiError("HUMAN_VERIFICATION_UNAVAILABLE", 503);
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(await limitedText(result, 8192));
  } catch {
    throw new ApiError("HUMAN_VERIFICATION_UNAVAILABLE", 503);
  }
  if (
    data.success !== true ||
    data.action !== "vibe_quiz" ||
    !hostnames.includes(String(data.hostname))
  )
    throw new ApiError("HUMAN_VERIFICATION_FAILED", 403);
}
