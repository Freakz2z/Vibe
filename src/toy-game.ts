import {
  errorResponse,
  readJSON,
  reply,
  trustedOrigin,
  ApiError,
} from "../services/model-api/policy";
export interface ToyGameEnv {
  TOY_MODEL?: Fetcher;
}
const paths: Record<string, string> = {
  session: "/v1/session",
  quiz: "/v1/quiz",
  answer: "/v1/answer",
  judge: "/v1/judge",
};
/** Public gateway: CORS is origin isolation, not authentication. Turnstile + opaque sessions live behind the private binding. */
export async function toyGameFetch(
  request: Request,
  env: ToyGameEnv,
): Promise<Response> {
  const origin = request.headers.get("Origin");
  let response: Response;
  try {
    if (origin && !trustedOrigin(origin))
      throw new ApiError("ORIGIN_NOT_ALLOWED", 403);
    const action = new URL(request.url).pathname.replace(
      /^\/api\/toy\/game\//,
      "",
    );
    if (action !== "config" && !paths[action])
      throw new ApiError("NOT_FOUND", 404);
    if (request.method === "OPTIONS") {
      const headers = (
        request.headers.get("Access-Control-Request-Headers") || ""
      )
        .toLowerCase()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (
        !origin ||
        request.headers.get("Access-Control-Request-Method") !== "POST"
      )
        throw new ApiError("METHOD_NOT_ALLOWED", 405);
      if (headers.some((h) => !["content-type", "authorization"].includes(h)))
        throw new ApiError("HEADER_NOT_ALLOWED", 403);
      response = new Response(null, { status: 204 });
    } else if (action === "config") {
      if (!["GET", "HEAD"].includes(request.method))
        throw new ApiError("METHOD_NOT_ALLOWED", 405);
      response = env.TOY_MODEL
        ? await env.TOY_MODEL.fetch("https://model.internal/health")
        : reply({
            status: "setup_required",
            configured: false,
            turnstileSiteKey: null,
          });
    } else {
      if (request.method !== "POST")
        throw new ApiError("METHOD_NOT_ALLOWED", 405);
      if (!origin) throw new ApiError("ORIGIN_REQUIRED", 403);
      if (!env.TOY_MODEL) throw new ApiError("MODEL_NOT_CONFIGURED", 503);
      const body = await readJSON(request);
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Toy-Origin": origin,
        "X-Toy-Client-IP": request.headers.get("CF-Connecting-IP") || "",
      });
      // Never forward cookies, client-selected routing headers or upstream credentials.
      if (action !== "session") {
        const auth = request.headers.get("Authorization") || "";
        if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(auth))
          throw new ApiError("SESSION_REQUIRED", 401);
        headers.set("Authorization", auth);
      }
      response = await env.TOY_MODEL.fetch(
        new Request("https://model.internal" + paths[action], {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
      );
    }
  } catch (e) {
    response = errorResponse(e);
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Vary", "Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  if (origin && trustedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    headers.set("Access-Control-Expose-Headers", "Retry-After");
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    headers,
  });
}
