-- Who may use the shared Strava app (Abdullah approves), the admin's devices, and "bring your own
-- Strava app" connections (their client id is kept; their secret never is: it's only held for the
-- few minutes of connecting, then deleted).
CREATE TABLE IF NOT EXISTS strava_access (device TEXT PRIMARY KEY, name TEXT, msg TEXT, status TEXT NOT NULL, ts INTEGER NOT NULL, decided INTEGER);
CREATE TABLE IF NOT EXISTS strava_admins (device TEXT PRIMARY KEY, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS strava_byo (device TEXT PRIMARY KEY, cid TEXT NOT NULL, secret TEXT NOT NULL, ts INTEGER NOT NULL);
ALTER TABLE strava ADD COLUMN cid TEXT;
