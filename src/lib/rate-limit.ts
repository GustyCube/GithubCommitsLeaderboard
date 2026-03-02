import { getRuntimeEnv, type KvLike, type RuntimeEnv } from "./runtime-env";

type RateLimitPolicy = {
  perMinute: number;
  perDay: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

const localRateLimitStore = new Map<string, { count: number; expiresAt: number }>();

const POLICIES: Record<string, RateLimitPolicy> = {
  leaderboard: {
    perMinute: 60,
    perDay: 1000,
  },
  user: {
    perMinute: 20,
    perDay: 200,
  },
  rank: {
    perMinute: 20,
    perDay: 200,
  },
  jobs: {
    perMinute: 5,
    perDay: 100,
  },
};

async function incrementMemoryCounter(key: string, ttlSeconds: number) {
  const now = Date.now();
  const existing = localRateLimitStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    localRateLimitStore.set(key, {
      count: 1,
      expiresAt: now + ttlSeconds * 1000,
    });

    return 1;
  }

  existing.count += 1;
  localRateLimitStore.set(key, existing);
  return existing.count;
}

async function incrementSharedCounter(kv: KvLike, key: string, ttlSeconds: number) {
  const current = Number((await kv.get(key)) ?? "0") + 1;

  await kv.put(key, String(current), {
    expirationTtl: ttlSeconds,
  });

  return current;
}

async function incrementCounter(env: RuntimeEnv, key: string, ttlSeconds: number) {
  if (env.RATE_LIMITS) {
    return incrementSharedCounter(env.RATE_LIMITS, key, ttlSeconds);
  }

  return incrementMemoryCounter(key, ttlSeconds);
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

async function checkWindow(
  env: RuntimeEnv,
  scope: string,
  ip: string,
  windowKey: string,
  ttlSeconds: number,
  limit: number,
) {
  const key = `${scope}:${windowKey}:${ip}`;
  const count = await incrementCounter(env, key, ttlSeconds);

  if (count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: ttlSeconds,
    } satisfies RateLimitResult;
  }

  return {
    allowed: true,
  } satisfies RateLimitResult;
}

export async function enforceRateLimit(
  request: Request,
  scope: keyof typeof POLICIES,
  overrides?: Partial<RuntimeEnv>,
) {
  const env = await getRuntimeEnv(overrides);
  const ip = getClientIp(request);
  const policy = POLICIES[scope];
  const minuteKey = new Date().toISOString().slice(0, 16);
  const dayKey = new Date().toISOString().slice(0, 10);

  const minuteResult = await checkWindow(env, scope, ip, `m:${minuteKey}`, 60, policy.perMinute);

  if (!minuteResult.allowed) {
    return minuteResult;
  }

  return checkWindow(env, scope, ip, `d:${dayKey}`, 60 * 60 * 24, policy.perDay);
}
