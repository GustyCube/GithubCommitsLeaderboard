import { Client } from "pg";

import { decryptText } from "../src/lib/crypto";
import { computeAllTimeCommits } from "../src/lib/github";
import { requireEnv } from "../src/lib/runtime-env";

async function refreshUserByLogin(login: string) {
  const env = await requireEnv(["DATABASE_URL", "TOKEN_ENCRYPTION_KEY"]);
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    // Find user by login
    const userResult = await client.query<{
      id: string;
      github_id: string;
      login: string;
      github_created_at: Date;
    }>(
      `SELECT u.id, u.github_id, u.login, u.github_created_at
       FROM users u
       WHERE u.login_lc = $1 AND u.needs_reconnect = FALSE`,
      [login.toLowerCase()],
    );

    const user = userResult.rows[0];
    if (!user) {
      console.error(`User "${login}" not found or needs reconnect`);
      process.exit(1);
    }

    console.log(`Found user: ${user.login} (ID: ${user.id}, GitHub ID: ${user.github_id})`);

    // Get token
    const tokenResult = await client.query<{ access_token_encrypted: string }>(
      `SELECT access_token_encrypted FROM tokens WHERE user_id = $1`,
      [user.id],
    );

    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      console.error(`No token found for user "${login}"`);
      process.exit(1);
    }

    const accessToken = await decryptText(env.TOKEN_ENCRYPTION_KEY!, tokenRow.access_token_encrypted);
    console.log(`Decrypted access token, computing all-time commits...`);

    // Recompute from scratch (full backfill)
    const now = new Date();
    const result = await computeAllTimeCommits(accessToken, user.github_created_at.toISOString(), now);

    console.log(`Computed all-time commits: ${result.total}`);

    // Update score
    await client.query(
      `UPDATE scores
       SET all_time_commits = $2, last_checked_at = $3, last_updated_at = $3
       WHERE user_id = $1`,
      [user.id, result.total, result.checkedAt],
    );

    // Bump leaderboard version
    await client.query(`
      INSERT INTO app_meta (key, value, updated_at)
      VALUES ('leaderboard_version', '2', NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        value = ((app_meta.value)::integer + 1)::text,
        updated_at = NOW()
    `);

    console.log(`✓ Updated ${user.login} to ${result.total} all-time commits`);
  } finally {
    await client.end();
  }
}

const login = process.argv[2];
if (!login) {
  console.error("Usage: npx tsx scripts/refresh-user.ts <github-login>");
  process.exit(1);
}

refreshUserByLogin(login).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
