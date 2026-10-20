-- Counts start at first deployment; no historical estimates are imported.
CREATE TABLE site_visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_day TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE site_daily_visitors (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (day, visitor_hash)
) WITHOUT ROWID;
