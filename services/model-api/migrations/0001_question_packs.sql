-- Separate game database. This migration never modifies the public tool catalog.
CREATE TABLE IF NOT EXISTS question_packs (
 id TEXT PRIMARY KEY,
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 expires INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS question_packs_expiry ON question_packs(expires);
