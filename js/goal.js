// The athlete's dream, in their own words, mapped to the Run level where it becomes realistic.
// Simple keyword reading for now; the AI can refine it later (the athlete always confirms).
import { parseTime } from './time.js';

// Returns { level, label, track } or null when the dream isn't a running distance or time.
export function dreamTarget(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  if (/hyrox|alpha ?x|crossfit|tough mudder|spartan|deka|hybrid/.test(t)) return { track: 'hybrid', level: null, label: 'Hybrid goal' };
  if (/triathlon|ironman|70\.3|sprint tri|olympic tri|\btri\b/.test(t)) {
    const world = /70\.3|half iron/.test(t) ? 4 : /ironman|full distance|full tri|140\.6/.test(t) ? 5 : /olympic|standard distance/.test(t) ? 3 : /super ?sprint/.test(t) ? 1 : /sprint/.test(t) ? 2 : null;
    return { track: 'tri', level: null, world, label: 'Triathlon goal' };
  }
  const time = timeIn(t);
  if (/ultra|50 ?k|100 ?k|100 ?mile/.test(t)) return { track: 'run', level: 13, label: 'Ultra' };
  if (/marathon/.test(t) && !/half/.test(t)) return { track: 'run', level: 12, label: time ? 'Marathon goal time' : 'Marathon' };
  if (/half|21(\.1)? ?k/.test(t)) return { track: 'run', level: time ? 10 : 9, label: time ? 'Half marathon goal time' : 'Half marathon' };
  if (/10 ?k/.test(t)) {
    if (time && time < 45) return { track: 'run', level: 9, label: 'Fast 10K' };
    return { track: 'run', level: time ? 8 : 7, label: time ? '10K goal time' : '10K' };
  }
  if (/5 ?k|parkrun/.test(t)) {
    if (time && time < 25) return { track: 'run', level: 8, label: 'Fast 5K' };
    if (time && time <= 30) return { track: 'run', level: 6, label: 'Sub-30 5K' };
    return { track: 'run', level: time ? 5 : 4, label: time ? '5K goal time' : 'First 5K' };
  }
  if (/run .*without stopping|first run|start running|couch/.test(t)) return { track: 'run', level: 3, label: 'Run without stopping' };
  return null;
}

// "sub 50", "under 1:45", "in 25 minutes" -> minutes
function timeIn(t) {
  const m = /(?:sub|under|below|in|<)\s*-?\s*(\d{1,2}(?::\d{2}){0,2})\s*(h|hr|hrs|hours?)?/.exec(t);
  if (!m) return null;
  const v = parseTime(m[1]);
  if (v == null) return null;
  return m[2] && !m[1].includes(':') ? v * 60 : v;
}

export function weeksUntil(dateStr, now) {
  if (!dateStr) return null;
  const d = Date.parse(dateStr);
  if (!isFinite(d)) return null;
  return Math.max(0, Math.round((d - now) / (7 * 864e5)));
}
