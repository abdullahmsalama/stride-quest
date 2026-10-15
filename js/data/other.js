// Training done outside Stride Quest (gym, team sports, padel…): asked once, used by the week plan,
// nutrition and the coach. MET values are approximate (Compendium of Physical Activities), by effort.
export const OTHER = [
  { k: 'weights', label: '🏋️ Weights / gym', cls: 'strength', met: [3.5, 5, 6], legs: true },
  { k: 'team', label: '⚽ Team sport (football, basketball…)', cls: 'team', met: [5.5, 7, 8], legs: true },
  { k: 'racket', label: '🎾 Padel, tennis, squash', cls: 'racket', met: [5, 7, 8.5], legs: true },
  { k: 'cycling', label: '🚴 Cycling', cls: 'bike', met: [5, 7, 10], legs: true },
  { k: 'swim', label: '🏊 Swimming', cls: 'swim', met: [5, 7, 9.5] },
  { k: 'yoga', label: '🧘 Yoga, Pilates, mobility', cls: 'yoga', met: [2.5, 3, 4] },
  { k: 'other', label: '➕ Something else', cls: 'other', met: [3.5, 5, 7] },
];
export const EFFORT = [['easy', 'Easy'], ['moderate', 'Moderate'], ['hard', 'Hard']];
const E_I = { easy: 0, moderate: 1, hard: 2 };
export const otherOf = k => OTHER.find(o => o.k === k);

// The athlete's other sessions on a weekday (0 = Monday), as plan items the nutrition maths can read.
export function otherItems(list = [], weekday) {
  return list.filter(o => (o.days || []).includes(weekday)).map(o => sessionItem(o));
}
export function sessionItem(o) {
  const d = otherOf(o.kind) || otherOf('other');
  const name = o.kind === 'other' && o.name ? o.name : d.label.replace(/^\S+\s/, '').split(' (')[0];
  return { title: `${name} ${o.minutes || 45} min`, cls: d.cls, met: d.met[E_I[o.effort] ?? 1], minutes: +o.minutes || 45, effort: o.effort || 'moderate', other: true, kind: o.kind };
}
// Weekdays with a hard-on-the-legs outside session: the plan keeps hard runs off them (strongly) and off
// the day after (mildly). Returns a Map weekday -> penalty, used when choosing days for hard runs.
export function legDays(list = []) {
  const out = new Map();
  const add = (d, v) => out.set(d, Math.max(out.get(d) || 0, v));
  for (const o of list) if (otherOf(o.kind)?.legs && o.effort !== 'easy') for (const d of o.days || []) { add(d, o.effort === 'hard' ? 10 : 6); add((d + 1) % 7, o.effort === 'hard' ? 4 : 2); }
  return out;
}

// Strava activity types -> our kinds (runs are handled separately).
export const STRAVA_RUN = new Set(['Run', 'TrailRun', 'VirtualRun']);
const STRAVA_KIND = [
  [/WeightTraining|Crossfit|HighIntensityIntervalTraining|Workout|StairStepper|Elliptical|Rowing|VirtualRow/, 'weights'],
  [/Ride|Velomobile|Handcycle/, 'cycling'], [/Swim/, 'swim'], [/Soccer|Basketball|Volleyball|Rugby|Football|Hockey|Handball/, 'team'],
  [/Tennis|Padel|Squash|Badminton|Pickleball|TableTennis|Racquet/, 'racket'], [/Yoga|Pilates/, 'yoga'],
];
export const kindOfStrava = type => (STRAVA_KIND.find(([re]) => re.test(type || '')) || [])[1] || 'other';
// Effort from average heart rate as a share of an age-estimated max (220 - age), else moderate.
export function effortOf(hr, age) {
  if (!(hr > 0) || !(age > 0)) return 'moderate';
  const pct = hr / (220 - age);
  return pct < 0.7 ? 'easy' : pct < 0.82 ? 'moderate' : 'hard';
}
