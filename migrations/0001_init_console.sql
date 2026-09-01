CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, avatar_url TEXT, is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS gameweeks (id INTEGER PRIMARY KEY, season TEXT NOT NULL, deadline TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open');

CREATE TABLE IF NOT EXISTS teams (id INTEGER PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams(id), name TEXT NOT NULL, position TEXT);

CREATE TABLE IF NOT EXISTS picks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id), gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id), category TEXT NOT NULL CHECK (category IN ('player','team')), subject_id INTEGER NOT NULL, xg REAL NOT NULL CHECK (xg >= 0.01), created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (user_id, gameweek_id, category));

CREATE TABLE IF NOT EXISTS results (gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id), category TEXT NOT NULL CHECK (category IN ('player','team')), subject_id INTEGER NOT NULL, actual_xg REAL NOT NULL, PRIMARY KEY (gameweek_id, category, subject_id));

CREATE TABLE IF NOT EXISTS scores (gameweek_id INTEGER NOT NULL, category TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), abs_diff REAL NOT NULL, signed_diff REAL NOT NULL, "rank" INTEGER NOT NULL, points INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (gameweek_id, category, user_id));

CREATE INDEX IF NOT EXISTS idx_picks_gw ON picks(gameweek_id, category);

CREATE INDEX IF NOT EXISTS idx_scores_gw ON scores(gameweek_id, category, "rank");
