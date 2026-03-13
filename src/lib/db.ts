import { Client } from "pg";

import { decodeCursor, encodeCursor } from "./cursor";
import { decryptText, encryptText } from "./crypto";
import { computeAllTimeCommits, computeIncrementalCommits } from "./github";
import { getRuntimeEnv, type RuntimeEnv } from "./runtime-env";
import type {
  GitHubIdentity,
  LeaderboardEntry,
  LeaderboardResponse,
  RankLookupResponse,
  RefreshSummary,
  SessionUser,
  StoredLeaderboardUser,
  UserLookupResponse,
} from "./types";

type Queryable = Client;

type LeaderboardRow = {
  github_id: string;
  login: string;
  name: string | null;
  avatar_url: string;
  profile_url: string;
  github_created_at: Date;
  all_time_commits: number;
  last_updated_at: Date | null;
};

type StoredUserRow = LeaderboardRow & {
  id: string;
  last_checked_at: Date | null;
  access_token_encrypted: string;
};

function normalizeLogin(login: string) {
  return login.replace(/^@+/, "").trim().toLowerCase();
}

function mapLeaderboardRow(row: LeaderboardRow, rank: number): LeaderboardEntry {
  return {
    rank,
    githubId: Number(row.github_id),
    login: row.login,
    name: row.name,
    avatarUrl: row.avatar_url,
    profileUrl: row.profile_url,
    githubCreatedAt: row.github_created_at.toISOString(),
    allTimeCommits: row.all_time_commits,
    lastUpdatedAt: row.last_updated_at?.toISOString() ?? null,
  };
}

function getConnectionString(env: RuntimeEnv): string {
  // Prefer Hyperdrive connection string in production (Cloudflare Workers)
  if (env.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString;
  }
  // Fallback to DATABASE_URL for local development
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  throw new Error("No database connection string available. Set HYPERDRIVE binding or DATABASE_URL.");
}

async function withDb<T>(callback: (client: Client, env: RuntimeEnv) => Promise<T>, overrides?: Partial<RuntimeEnv>) {
  const env = await getRuntimeEnv(overrides);
  const connectionString = getConnectionString(env);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await callback(client, env);
  } finally {
    await client.end();
  }
}

async function getLeaderboardVersion(client: Queryable) {
  const result = await client.query<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'leaderboard_version'",
  );

  return Number(result.rows[0]?.value ?? "1");
}

async function bumpLeaderboardVersion(client: Queryable) {
  await client.query(`
    INSERT INTO app_meta (key, value, updated_at)
    VALUES ('leaderboard_version', '2', NOW())
    ON CONFLICT (key)
    DO UPDATE SET
      value = ((app_meta.value)::integer + 1)::text,
      updated_at = NOW()
  `);
}

async function getStartingRank(client: Queryable, commits: number, githubId: number) {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM users u
      JOIN scores s ON s.user_id = u.id
      WHERE u.needs_reconnect = FALSE
        AND (
          s.all_time_commits > $1
          OR (s.all_time_commits = $1 AND u.github_id <= $2)
        )
    `,
    [commits, githubId],
  );

  return Number(result.rows[0]?.count ?? "0") + 1;
}

export async function getTotalUserCount(): Promise<number> {
  return withDb(async (client) => {
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE needs_reconnect = FALSE`,
    );
    return Number(result.rows[0]?.count ?? "0");
  });
}

export async function listLeaderboard(limit = 50, rawCursor?: string | null): Promise<LeaderboardResponse> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  return withDb(async (client) => {
    const cursor = decodeCursor(rawCursor);
    const version = await getLeaderboardVersion(client);
    const startingRank = cursor ? await getStartingRank(client, cursor.commits, cursor.githubId) : 1;

    const rows = await client.query<LeaderboardRow>(
      `
        SELECT
          u.github_id,
          u.login,
          u.name,
          u.avatar_url,
          u.profile_url,
          u.github_created_at,
          s.all_time_commits,
          s.last_updated_at
        FROM users u
        JOIN scores s ON s.user_id = u.id
        WHERE u.needs_reconnect = FALSE
          AND (
            $1::integer IS NULL
            OR s.all_time_commits < $1
            OR (s.all_time_commits = $1 AND u.github_id > $2)
          )
        ORDER BY s.all_time_commits DESC, u.github_id ASC
        LIMIT $3
      `,
      [cursor?.commits ?? null, cursor?.githubId ?? null, safeLimit],
    );

    const lastRow = rows.rows.at(-1);

    return {
      version,
      generatedAt: new Date().toISOString(),
      startingRank,
      nextCursor: lastRow
        ? encodeCursor({
            commits: lastRow.all_time_commits,
            githubId: Number(lastRow.github_id),
          })
        : null,
      source: "database",
      data: rows.rows.map((row, index) => mapLeaderboardRow(row, startingRank + index)),
    } satisfies LeaderboardResponse;
  });
}

export async function findUserByLogin(login: string): Promise<UserLookupResponse> {
  const normalized = normalizeLogin(login);

  return withDb(async (client) => {
    const version = await getLeaderboardVersion(client);
    const userResult = await client.query<LeaderboardRow>(
      `
        SELECT
          u.github_id,
          u.login,
          u.name,
          u.avatar_url,
          u.profile_url,
          u.github_created_at,
          s.all_time_commits,
          s.last_updated_at
        FROM users u
        JOIN scores s ON s.user_id = u.id
        WHERE u.login_lc = $1
          AND u.needs_reconnect = FALSE
        LIMIT 1
      `,
      [normalized],
    );

    const row = userResult.rows[0];

    if (!row) {
      return {
        version,
        generatedAt: new Date().toISOString(),
        found: false,
        source: "database",
        data: null,
      } satisfies UserLookupResponse;
    }

    const rankResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM users u
        JOIN scores s ON s.user_id = u.id
        WHERE u.needs_reconnect = FALSE
          AND (
            s.all_time_commits > $1
            OR (s.all_time_commits = $1 AND u.github_id < $2)
          )
      `,
      [row.all_time_commits, row.github_id],
    );

    const rank = Number(rankResult.rows[0]?.count ?? "0") + 1;

    return {
      version,
      generatedAt: new Date().toISOString(),
      found: true,
      source: "database",
      data: mapLeaderboardRow(row, rank),
    } satisfies UserLookupResponse;
  });
}

export async function findUserByLoginWithCount(login: string): Promise<UserLookupResponse & { totalUsers: number }> {
  const normalized = normalizeLogin(login);

  return withDb(async (client) => {
    const version = await getLeaderboardVersion(client);

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE needs_reconnect = FALSE`,
    );
    const totalUsers = Number(countResult.rows[0]?.count ?? "0");

    const userResult = await client.query<LeaderboardRow>(
      `
        SELECT
          u.github_id,
          u.login,
          u.name,
          u.avatar_url,
          u.profile_url,
          u.github_created_at,
          s.all_time_commits,
          s.last_updated_at
        FROM users u
        JOIN scores s ON s.user_id = u.id
        WHERE u.login_lc = $1
          AND u.needs_reconnect = FALSE
        LIMIT 1
      `,
      [normalized],
    );

    const row = userResult.rows[0];

    if (!row) {
      return {
        version,
        generatedAt: new Date().toISOString(),
        found: false,
        source: "database",
        data: null,
        totalUsers,
      } satisfies UserLookupResponse & { totalUsers: number };
    }

    const rankResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM users u
        JOIN scores s ON s.user_id = u.id
        WHERE u.needs_reconnect = FALSE
          AND (
            s.all_time_commits > $1
            OR (s.all_time_commits = $1 AND u.github_id < $2)
          )
      `,
      [row.all_time_commits, row.github_id],
    );

    const rank = Number(rankResult.rows[0]?.count ?? "0") + 1;

    return {
      version,
      generatedAt: new Date().toISOString(),
      found: true,
      source: "database",
      data: mapLeaderboardRow(row, rank),
      totalUsers,
    } satisfies UserLookupResponse & { totalUsers: number };
  });
}

export async function findUserByRank(rank: number): Promise<RankLookupResponse> {
  return withDb(async (client) => {
    const version = await getLeaderboardVersion(client);
    const result = await client.query<LeaderboardRow>(
      `
        SELECT
          u.github_id,
          u.login,
          u.name,
          u.avatar_url,
          u.profile_url,
          u.github_created_at,
          s.all_time_commits,
          s.last_updated_at
        FROM users u
        JOIN scores s ON s.user_id = u.id
        WHERE u.needs_reconnect = FALSE
        ORDER BY s.all_time_commits DESC, u.github_id ASC
        OFFSET $1
        LIMIT 1
      `,
      [rank - 1],
    );

    const row = result.rows[0];

    return {
      version,
      generatedAt: new Date().toISOString(),
      found: Boolean(row),
      source: "database",
      data: row ? mapLeaderboardRow(row, rank) : null,
    } satisfies RankLookupResponse;
  });
}

export async function upsertConnectedUser(identity: GitHubIdentity, accessToken: string) {
  return withDb(async (client, env) => {
    if (!env.TOKEN_ENCRYPTION_KEY) {
      throw new Error("TOKEN_ENCRYPTION_KEY is required to store OAuth tokens");
    }

    const encryptedToken = await encryptText(env.TOKEN_ENCRYPTION_KEY, accessToken);
    const staleLoginReplacement = `renamed-${identity.githubId}`;

    await client.query("BEGIN");

    try {
      await client.query(
        `
          UPDATE users
          SET login = $1, login_lc = $1, updated_at = NOW()
          WHERE login_lc = $2
            AND github_id <> $3
        `,
        [staleLoginReplacement, identity.login.toLowerCase(), identity.githubId],
      );

      const userResult = await client.query<{ id: string }>(
        `
          INSERT INTO users (
            github_id,
            login,
            login_lc,
            name,
            avatar_url,
            profile_url,
            github_created_at,
            needs_reconnect,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW())
          ON CONFLICT (github_id)
          DO UPDATE SET
            login = EXCLUDED.login,
            login_lc = EXCLUDED.login_lc,
            name = EXCLUDED.name,
            avatar_url = EXCLUDED.avatar_url,
            profile_url = EXCLUDED.profile_url,
            github_created_at = EXCLUDED.github_created_at,
            needs_reconnect = FALSE,
            updated_at = NOW()
          RETURNING id
        `,
        [
          identity.githubId,
          identity.login,
          identity.login.toLowerCase(),
          identity.name,
          identity.avatarUrl,
          identity.profileUrl,
          identity.createdAt,
        ],
      );

      const userId = userResult.rows[0]?.id;

      if (!userId) {
        throw new Error("Failed to upsert GitHub user");
      }

      await client.query(
        `
          INSERT INTO tokens (user_id, access_token_encrypted, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (user_id)
          DO UPDATE SET
            access_token_encrypted = EXCLUDED.access_token_encrypted,
            updated_at = NOW()
        `,
        [userId, encryptedToken],
      );

      await client.query(
        `
          INSERT INTO scores (user_id, all_time_commits, last_checked_at, last_updated_at)
          VALUES ($1, 0, NULL, NULL)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [userId],
      );

      await client.query("COMMIT");

      return {
        userId,
        githubId: identity.githubId,
        login: identity.login,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      } satisfies SessionUser;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function getConnectedSessionUser(userId: string) {
  return withDb(async (client) => {
    const result = await client.query<{
      id: string;
      github_id: string;
      login: string;
      name: string | null;
      avatar_url: string;
    }>(
      `
        SELECT id, github_id, login, name, avatar_url
        FROM users
        WHERE id = $1
          AND needs_reconnect = FALSE
        LIMIT 1
      `,
      [userId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      userId: row.id,
      githubId: Number(row.github_id),
      login: row.login,
      name: row.name,
      avatarUrl: row.avatar_url,
    } satisfies SessionUser;
  });
}

async function listUsersForRefresh(client: Queryable) {
  const result = await client.query<StoredUserRow>(
    `
      SELECT
        u.id,
        u.github_id,
        u.login,
        u.name,
        u.avatar_url,
        u.profile_url,
        u.github_created_at,
        s.all_time_commits,
        s.last_checked_at,
        s.last_updated_at,
        t.access_token_encrypted
      FROM users u
      JOIN scores s ON s.user_id = u.id
      JOIN tokens t ON t.user_id = u.id
      WHERE u.needs_reconnect = FALSE
      ORDER BY u.github_id ASC
    `,
  );

  return result.rows.map(
    (row) =>
      ({
        userId: row.id,
        githubId: Number(row.github_id),
        login: row.login,
        name: row.name,
        avatarUrl: row.avatar_url,
        profileUrl: row.profile_url,
        githubCreatedAt: row.github_created_at.toISOString(),
        allTimeCommits: row.all_time_commits,
        lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
        lastUpdatedAt: row.last_updated_at?.toISOString() ?? null,
        accessTokenEncrypted: row.access_token_encrypted,
      }) satisfies StoredLeaderboardUser,
  );
}

async function markNeedsReconnect(client: Queryable, userId: string) {
  await client.query(
    `
      UPDATE users
      SET needs_reconnect = TRUE, updated_at = NOW()
      WHERE id = $1
    `,
    [userId],
  );
}

async function updateUserScore(
  client: Queryable,
  userId: string,
  allTimeCommits: number,
  checkedAt: string,
) {
  await client.query(
    `
      UPDATE scores
      SET
        all_time_commits = $2,
        last_checked_at = $3,
        last_updated_at = $3
      WHERE user_id = $1
    `,
    [userId, allTimeCommits, checkedAt],
  );
}

export async function refreshSingleUser(
  userId: string,
  overrides?: Partial<RuntimeEnv>,
  now = new Date(),
) {
  return withDb(async (client, env) => {
    if (!env.TOKEN_ENCRYPTION_KEY) {
      throw new Error("TOKEN_ENCRYPTION_KEY is required to refresh scores");
    }

    const userResult = await client.query<StoredUserRow>(
      `
        SELECT
          u.id,
          u.github_id,
          u.login,
          u.name,
          u.avatar_url,
          u.profile_url,
          u.github_created_at,
          s.all_time_commits,
          s.last_checked_at,
          s.last_updated_at,
          t.access_token_encrypted
        FROM users u
        JOIN scores s ON s.user_id = u.id
        JOIN tokens t ON t.user_id = u.id
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId],
    );

    const row = userResult.rows[0];

    if (!row) {
      throw new Error(`User ${userId} not found for refresh`);
    }

    const accessToken = await decryptText(env.TOKEN_ENCRYPTION_KEY, row.access_token_encrypted);

    if (row.last_checked_at) {
      const nextScore = await computeIncrementalCommits(
        accessToken,
        row.last_checked_at.toISOString(),
        now,
      );
      const allTimeCommits = row.all_time_commits + nextScore.delta;

      await updateUserScore(client, userId, allTimeCommits, nextScore.checkedAt);
      await bumpLeaderboardVersion(client);

      return {
        allTimeCommits,
        checkedAt: nextScore.checkedAt,
      };
    }

    const nextScore = await computeAllTimeCommits(accessToken, row.github_created_at.toISOString(), now);
    await updateUserScore(client, userId, nextScore.total, nextScore.checkedAt);
    await bumpLeaderboardVersion(client);

    return {
      allTimeCommits: nextScore.total,
      checkedAt: nextScore.checkedAt,
    };
  }, overrides);
}

export async function refreshAllUsers(
  overrides?: Partial<RuntimeEnv>,
  source = "manual",
  now = new Date(),
): Promise<RefreshSummary> {
  return withDb(async (client, env) => {
    if (!env.TOKEN_ENCRYPTION_KEY) {
      throw new Error("TOKEN_ENCRYPTION_KEY is required to refresh scores");
    }

    const users = await listUsersForRefresh(client);
    let updated = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const accessToken = await decryptText(env.TOKEN_ENCRYPTION_KEY, user.accessTokenEncrypted);

        if (user.lastCheckedAt) {
          const nextScore = await computeIncrementalCommits(accessToken, user.lastCheckedAt, now);
          const allTimeCommits = user.allTimeCommits + nextScore.delta;

          await updateUserScore(client, user.userId, allTimeCommits, nextScore.checkedAt);
        } else {
          const nextScore = await computeAllTimeCommits(accessToken, user.githubCreatedAt, now);
          await updateUserScore(client, user.userId, nextScore.total, nextScore.checkedAt);
        }

        updated += 1;
      } catch (error) {
        failed += 1;

        if (
          error instanceof Error &&
          (error.message.includes("401") ||
            error.message.toLowerCase().includes("bad credentials") ||
            error.message.toLowerCase().includes("resource not accessible"))
        ) {
          await markNeedsReconnect(client, user.userId);
        }
      }
    }

    if (updated > 0) {
      await bumpLeaderboardVersion(client);
    }

    return {
      processed: users.length,
      updated,
      failed,
      source,
      completedAt: now.toISOString(),
    } satisfies RefreshSummary;
  }, overrides);
}
