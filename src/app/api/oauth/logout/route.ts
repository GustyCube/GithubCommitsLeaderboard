import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";
import { requireEnv } from "@/lib/runtime-env";

export async function GET() {
  const env = await requireEnv(["APP_URL"]);
  const response = NextResponse.redirect(new URL("/", env.APP_URL));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
