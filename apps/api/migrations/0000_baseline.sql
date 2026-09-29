-- Baseline migration — add domain tables in subsequent migrations
-- Convention: CREATE TABLE IF NOT EXISTS for idempotency
-- D1 is SQLite: TEXT (not VARCHAR), INTEGER (not BOOLEAN), no ENUM
--
-- Every migration that adds a table or column MUST declare it for post-merge verification:
--   -- verify: table=<table_name> column=<column_name>
-- verify: table=_migrations_applied column=name

CREATE TABLE IF NOT EXISTS _migrations_applied (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
