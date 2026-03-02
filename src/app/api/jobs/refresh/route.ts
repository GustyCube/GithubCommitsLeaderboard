import { NextRequest } from "next/server";

import {
  createJsonResponse,
  createRateLimitedResponse,
  createServerErrorResponse,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { runRefreshCycle } from "@/lib/refresh-service";
import { getRuntimeEnv } from "@/lib/runtime-env";

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await enforceRateLimit(request, "jobs");

    if (!rateLimit.allowed) {
      return createRateLimitedResponse(rateLimit.retryAfterSeconds ?? 60);
    }

    const env = await getRuntimeEnv();
    const authorization = request.headers.get("authorization");

    if (!env.CRON_SECRET || authorization !== `Bearer ${env.CRON_SECRET}`) {
      return createJsonResponse(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const result = await runRefreshCycle({
      source: "http-manual",
    });

    return createJsonResponse(result);
  } catch (error) {
    return createServerErrorResponse(error);
  }
}
