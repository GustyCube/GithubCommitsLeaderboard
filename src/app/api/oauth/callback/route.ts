import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { upsertConnectedUser } from "@/lib/db";
import { exchangeCodeForAccessToken, getViewerIdentity } from "@/lib/github";
import { createSessionCookieValue, SESSION_COOKIE } from "@/lib/session";
import { requireEnv } from "@/lib/runtime-env";

const OAUTH_STATE_COOKIE = "gh-commit-board-oauth-state";

export async function GET(request: NextRequest) {
  const env = await requireEnv(["APP_URL"]);
  const errorRedirect = new URL("/", env.APP_URL);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !returnedState || storedState !== returnedState) {
    errorRedirect.searchParams.set("error", "oauth_state");
    return NextResponse.redirect(errorRedirect);
  }

  try {
    const redirectUri = new URL("/api/oauth/callback", env.APP_URL).toString();
    const accessToken = await exchangeCodeForAccessToken(code, redirectUri);
    const identity = await getViewerIdentity(accessToken);
    const sessionUser = await upsertConnectedUser(identity, accessToken);

    const sessionCookie = await createSessionCookieValue(sessionUser);
    const successRedirect = new URL("/onboarding", env.APP_URL);

    const response = NextResponse.redirect(successRedirect);
    response.cookies.set(SESSION_COOKIE, sessionCookie.value, {
      httpOnly: true,
      sameSite: "lax",
      secure: sessionCookie.secure,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete(OAUTH_STATE_COOKIE);

    return response;
  } catch {
    errorRedirect.searchParams.set("error", "oauth_callback");
    const response = NextResponse.redirect(errorRedirect);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }
}
