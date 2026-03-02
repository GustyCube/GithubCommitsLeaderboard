import type { CursorPayload } from "./types";

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function encodeCursor(cursor: CursorPayload) {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(cursor)) as Partial<CursorPayload>;

    if (typeof parsed.commits !== "number" || typeof parsed.githubId !== "number") {
      return null;
    }

    return {
      commits: parsed.commits,
      githubId: parsed.githubId,
    } satisfies CursorPayload;
  } catch {
    return null;
  }
}
