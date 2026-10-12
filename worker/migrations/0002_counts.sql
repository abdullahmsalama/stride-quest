-- Anonymous daily tallies per key (no IDs): e.g. prep:alphax, site:hyrox.
CREATE TABLE IF NOT EXISTS counts (key TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (key, day));
