-- Feedback people send from the app. The email is only there if they typed one to get a reply.
CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, device TEXT NOT NULL, kind TEXT, msg TEXT NOT NULL, email TEXT,
  version TEXT, screen TEXT, ua TEXT, plan TEXT, status TEXT NOT NULL DEFAULT 'new', ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS feedback_device_ts ON feedback (device, ts);
