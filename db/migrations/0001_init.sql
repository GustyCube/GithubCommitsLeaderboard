CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT NOT NULL UNIQUE,
  login TEXT NOT NULL,
  login_lc TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT NOT NULL,
  profile_url TEXT NOT NULL,
  github_created_at TIMESTAMPTZ NOT NULL,
  needs_reconnect BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tokens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  all_time_commits INTEGER NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_meta (key, value)
VALUES ('leaderboard_version', '1')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS scores_leaderboard_idx
  ON scores (all_time_commits DESC, user_id);

CREATE INDEX IF NOT EXISTS users_login_lc_idx
  ON users (login_lc);
