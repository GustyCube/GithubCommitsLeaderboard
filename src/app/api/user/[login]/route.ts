import { NextRequest } from "next/server";
import { z } from "zod";

import { findUserByLogin } from "@/lib/db";
import {
  createJsonResponse,
  createRateLimitedResponse,
  createServerErrorResponse,
  withPublicApiCache,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const loginSchema = z.string().trim().min(1).max(40);

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      login: string;
    }>;
  },
) {
  try {
    const rateLimit = await enforceRateLimit(request, "user");

    if (!rateLimit.allowed) {
      return createRateLimitedResponse(rateLimit.retryAfterSeconds ?? 60);
    }

    const { login } = await context.params;
    const normalized = loginSchema.parse(login);
    const data = await findUserByLogin(normalized);

    return withPublicApiCache(createJsonResponse(data));
  } catch (error) {
    return createServerErrorResponse(error);
  }
}
