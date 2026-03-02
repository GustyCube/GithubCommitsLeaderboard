import { getCloudflareContext } from "@opennextjs/cloudflare";

export type KvLike = {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: {
      expirationTtl?: number;
    },
  ): Promise<void>;
};

export type HyperdriveLike = {
  connectionString: string;
};

export type RuntimeEnv = {
  APP_URL?: string;
  CRON_SECRET?: string;
  DATABASE_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  HYPERDRIVE?: HyperdriveLike;
  NEXT_PUBLIC_REPOSITORY_URL?: string;
  RATE_LIMITS?: KvLike;
  SESSION_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
};

export async function getRuntimeEnv(overrides?: Partial<RuntimeEnv>) {
  const processEnv = process.env as RuntimeEnv;

  if (overrides) {
    return {
      ...processEnv,
      ...overrides,
    };
  }

  try {
    const { env } = await getCloudflareContext({ async: true });

    return {
      ...processEnv,
      ...(env as Partial<RuntimeEnv>),
    };
  } catch {
    return processEnv;
  }
}

export async function requireEnv(
  keys: Array<keyof RuntimeEnv>,
  overrides?: Partial<RuntimeEnv>,
) {
  const env = await getRuntimeEnv(overrides);

  for (const key of keys) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return env as RuntimeEnv & Record<(typeof keys)[number], string>;
}
