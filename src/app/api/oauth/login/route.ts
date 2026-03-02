import { NextResponse } from "next/server";

import { requireEnv } from "@/lib/runtime-env";

const OAUTH_STATE_COOKIE = "gh-commit-board-oauth-state";

export async function GET() {
  const env = await requireEnv(["APP_URL", "GITHUB_CLIENT_ID"]);
  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/oauth/callback", env.APP_URL).toString();
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");

  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "read:user read:org");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: !env.APP_URL.startsWith("http://localhost"),
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
