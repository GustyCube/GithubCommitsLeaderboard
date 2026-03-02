import { NextResponse } from "next/server";

export function createJsonResponse(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function withPublicApiCache(response: NextResponse, ttlSeconds = 120) {
  response.headers.set("Cache-Control", `public, s-maxage=${ttlSeconds}, stale-while-revalidate=600`);
  return response;
}

export function createRateLimitedResponse(retryAfterSeconds: number) {
  return createJsonResponse(
    {
      error: "Too many requests",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export function createServerErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";

  return createJsonResponse(
    {
      error: message,
    },
    {
      status: 500,
    },
  );
}
