import { cookies } from "next/headers";

import { signValue, verifySignedValue } from "./crypto";
import { getRuntimeEnv } from "./runtime-env";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "gh-commit-board-session";

function encodePayload(user: SessionUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decodePayload(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SessionUser;
}

export async function createSessionCookieValue(user: SessionUser) {
  const env = await getRuntimeEnv();

  if (!env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required to create a session cookie");
  }

  const payload = encodePayload(user);
  const signature = await signValue(env.SESSION_SECRET, payload);

  return {
    value: `${payload}.${signature}`,
    secure: !env.APP_URL?.startsWith("http://localhost"),
  };
}

export async function writeSessionCookie(user: SessionUser) {
  const store = await cookies();
  const session = await createSessionCookieValue(user);

  store.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: session.secure,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSessionCookie() {
  const env = await getRuntimeEnv();

  if (!env.SESSION_SECRET) {
    return null;
  }

  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");

  if (!payload || !signature) {
    return null;
  }

  const isValid = await verifySignedValue(env.SESSION_SECRET, payload, signature);

  if (!isValid) {
    return null;
  }

  try {
    return decodePayload(payload);
  } catch {
    return null;
  }
}
