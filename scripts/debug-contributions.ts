import { Client } from "pg";

import { decryptText } from "../src/lib/crypto";
import { buildYearlyContributionWindows, fetchCommitContributionTotal } from "../src/lib/github";
import { requireEnv } from "../src/lib/runtime-env";

async function debugContributions(login: string) {
  const env = await requireEnv(["DATABASE_URL", "TOKEN_ENCRYPTION_KEY"]);
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  try {
    const userResult = await client.query<{
      id: string;
      login: string;
      github_created_at: Date;
    }>(
      `SELECT u.id, u.login, u.github_created_at
       FROM users u
       WHERE u.login_lc = $1`,
      [login.toLowerCase()],
    );

    const user = userResult.rows[0];
    if (!user) {
      console.error(`User "${login}" not found`);
      process.exit(1);
    }

    console.log(`User: ${user.login}`);
    console.log(`GitHub Created At: ${user.github_created_at.toISOString()}`);
    console.log("");

    const tokenResult = await client.query<{ access_token_encrypted: string }>(
      `SELECT access_token_encrypted FROM tokens WHERE user_id = $1`,
      [user.id],
    );

    const accessToken = await decryptText(env.TOKEN_ENCRYPTION_KEY!, tokenResult.rows[0].access_token_encrypted);

    const now = new Date();
    const windows = buildYearlyContributionWindows(user.github_created_at.toISOString(), now);

    console.log(`Windows (${windows.length} total):`);
    console.log("─".repeat(80));

    let grandTotal = 0;
    for (const window of windows) {
      const count = await fetchCommitContributionTotal(accessToken, window.from, window.to);
      grandTotal += count;
      console.log(`${window.from.slice(0, 10)} → ${window.to.slice(0, 10)}: ${count} commits`);
    }

    console.log("─".repeat(80));
    console.log(`GRAND TOTAL: ${grandTotal} commits`);
  } finally {
    await client.end();
  }
}

const login = process.argv[2];
if (!login) {
  console.error("Usage: npx tsx scripts/debug-contributions.ts <github-login>");
  process.exit(1);
}

debugContributions(login).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
