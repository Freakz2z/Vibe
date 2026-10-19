-- Distinguish no-charge proprietary tools from open-source tools and freemium services.
CREATE TABLE tools_updated (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES categories(id),
 pricing TEXT NOT NULL CHECK(pricing IN ('开源免费','免费使用','免费增值','付费')),
 featured INTEGER NOT NULL DEFAULT 0, demo_id TEXT, search_text TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), position INTEGER NOT NULL
);
INSERT INTO tools_updated SELECT * FROM tools;
DROP TABLE tools;
ALTER TABLE tools_updated RENAME TO tools;
CREATE INDEX tools_category ON tools(category_id);
CREATE INDEX tools_featured ON tools(featured);
