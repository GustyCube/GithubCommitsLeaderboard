import { refreshAllUsers } from "./db";
import type { RuntimeEnv } from "./runtime-env";

export async function runRefreshCycle({
  env,
  source,
  now,
}: {
  env?: Partial<RuntimeEnv>;
  source: string;
  now?: Date;
}) {
  return refreshAllUsers(env, source, now);
}
