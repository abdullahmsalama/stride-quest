-- Anonymous, opt-in numbers for "compare with Stride Quest athletes".
-- No names, emails or IP addresses: a random device id, sex, age group and the numbers themselves.
CREATE TABLE IF NOT EXISTS athletes (id TEXT PRIMARY KEY, sex TEXT NOT NULL, age TEXT, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS vals (id TEXT NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL, PRIMARY KEY (id, metric));
CREATE INDEX IF NOT EXISTS vals_metric ON vals (metric, value);
-- Write limit per (hashed, salted) network address per day; rows older than a day are pruned.
CREATE TABLE IF NOT EXISTS writes (who TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (who, day));
