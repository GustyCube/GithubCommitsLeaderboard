import { NextRequest } from "next/server";
import { z } from "zod";

import { listLeaderboard } from "@/lib/db";
import {
  createJsonResponse,
  createRateLimitedResponse,
  createServerErrorResponse,
  withPublicApiCache,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
  cursor: z.string().min(1).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await enforceRateLimit(request, "leaderboard");

    if (!rateLimit.allowed) {
      return createRateLimitedResponse(rateLimit.retryAfterSeconds ?? 60);
    }

    const searchParams = request.nextUrl.searchParams;
    const query = querySchema.parse({
      limit: searchParams.get("limit") ?? "50",
      cursor: searchParams.get("cursor") ?? undefined,
    });
    const data = await listLeaderboard(query.limit, query.cursor);

    return withPublicApiCache(createJsonResponse(data));
  } catch (error) {
    return createServerErrorResponse(error);
  }
}
