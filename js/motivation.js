import { BOOSTS, AFTER_SESSION, REPEAT } from './data/motivation.js';
import { dayKey } from './engine.js';

// Who the runner is right now, for picking the right tone.
export function audience(s) {
  if (s.rebuild.active) return 'rebuild';
  if (s.refresher || s.run.reclaim) return 'comeback';
  if (s.run.level === 1 && (s.answers?.runsLast4w ?? 0) === 0) return 'starter';
  if (s.run.level <= 3) return 'beginner';
  return 'general';
}

const pick = (list, seed) => list[Math.abs(seed) % list.length];
const hash = str => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

// The same boost all day; a new one tomorrow.
export function dailyBoost(s, now) {
  return pick(BOOSTS[audience(s)], hash(dayKey(now)));
}

export function afterSession(s) {
  return pick(AFTER_SESSION[audience(s)], s.history.length);
}

export function repeatLine(s) {
  return pick(REPEAT, s.history.length);
}

// A progress fact to show how far they have come.
export function progressLine(s) {
  const sessions = s.history.filter(h => h.kind === 'session').length;
  if (!sessions) return null;
  const cleared = Object.keys(s.run.stars).length;
  if (cleared) return `${sessions} sessions logged and ${cleared} level${cleared > 1 ? 's' : ''} cleared since you started.`;
  return `${sessions} session${sessions > 1 ? 's' : ''} logged since you started. Every one counts.`;
}
