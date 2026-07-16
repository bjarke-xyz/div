-- The cache is the only table, and it is disposable: every row is a copy of
-- something an upstream site will hand out again. Deleting the database file
-- costs one round of re-fetching, so this is deliberately not backed up.
CREATE TABLE IF NOT EXISTS cache(
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS cache_expires_at_index ON cache(expires_at);
