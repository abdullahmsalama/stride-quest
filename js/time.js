// Reading and writing times the way runners type them: "27:30", "1:05:20", "27.5" or "27".
// Everything is minutes as a decimal number inside the app.

// Returns minutes, or null when the text can't be read.
export function parseTime(text) {
  const t = String(text ?? '').trim().replace(/\s+/g, '').replace(/,/g, '.');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.\d+)?$/.exec(t);
  if (!m) return null;
  const [h, mm, ss] = [m[1] ? +m[1] : 0, +m[2], +m[3]];
  if (ss >= 60 || (m[1] && mm >= 60)) return null;
  return h * 60 + mm + ss / 60;
}

// minutes -> "27:30" or "1:05:20"
export function formatTime(min) {
  if (min == null || !isFinite(min)) return '';
  const total = Math.round(min * 60);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// A race time from what was typed: total time, or pace per km times the distance.
export function raceMinutes(text, mode, km) {
  const v = parseTime(text);
  if (v == null) return null;
  return mode === 'pace' ? v * km : v;
}

// Distance from a duration, using an easy pace: ~25% slower than 5K race pace, else 7:30/km.
export function estimateKm(minutes, best5kMin) {
  const easyPace = best5kMin ? (best5kMin / 5) * 1.25 : 7.5;
  return Math.round((minutes / easyPace) * 10) / 10;
}
