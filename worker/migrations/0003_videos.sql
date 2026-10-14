-- Exercise demo videos: YouTube search results cached for a week, shared ratings, athlete suggestions.
CREATE TABLE IF NOT EXISTS video_cache (q TEXT PRIMARY KEY, ts INTEGER NOT NULL, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS video_votes (q TEXT NOT NULL, id TEXT NOT NULL, up INTEGER NOT NULL DEFAULT 0, down INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (q, id));
CREATE TABLE IF NOT EXISTS video_suggest (q TEXT NOT NULL, id TEXT NOT NULL, title TEXT, channel TEXT, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (q, id));
