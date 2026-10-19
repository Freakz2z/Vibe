CREATE TABLE IF NOT EXISTS categories (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL, position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tools (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES categories(id),
 pricing TEXT NOT NULL CHECK(pricing IN ('开源免费','免费增值','付费')),
 featured INTEGER NOT NULL DEFAULT 0, demo_id TEXT, search_text TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tools_category ON tools(category_id);
CREATE INDEX IF NOT EXISTS tools_featured ON tools(featured);
CREATE TABLE IF NOT EXISTS demos (id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)), position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
