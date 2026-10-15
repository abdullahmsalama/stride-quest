-- Strava connections: one row per device that tapped "Connect with Strava". The device id is a random
-- secret held only by that device; tokens never leave the Worker.
CREATE TABLE IF NOT EXISTS strava (device TEXT PRIMARY KEY, athlete INTEGER, name TEXT, access TEXT NOT NULL, refresh TEXT NOT NULL, expires INTEGER NOT NULL, scope TEXT, ts INTEGER NOT NULL);
