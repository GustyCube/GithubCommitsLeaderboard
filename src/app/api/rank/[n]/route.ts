import { NextRequest } from "next/server";
import { z } from "zod";

import { findUserByRank } from "@/lib/db";
import {
  createJsonResponse,
  createRateLimitedResponse,
  createServerErrorResponse,
  withPublicApiCache,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const rankSchema = z.coerce.number().int().min(1).max(10_000_000);

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      n: string;
    }>;
  },
) {
  try {
    const rateLimit = await enforceRateLimit(request, "rank");

    if (!rateLimit.allowed) {
      return createRateLimitedResponse(rateLimit.retryAfterSeconds ?? 60);
    }

    const { n } = await context.params;
    const rank = rankSchema.parse(n);
    const data = await findUserByRank(rank);

    return withPublicApiCache(createJsonResponse(data));
  } catch (error) {
    return createServerErrorResponse(error);
  }
}
