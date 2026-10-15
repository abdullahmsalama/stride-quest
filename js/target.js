// Competition mode: a target race with a date, checked honestly against where the athlete is.
// The plan stays the athlete's levels; this adds a deadline, a verdict, phases and race day.
// Pure functions (no DOM): the app shows the words, the tests check the maths.
import { RUN_LEVELS } from './data/tracks.js';
import { TRI_WORLDS } from './data/tri.js';
import { HYBRID_WORLDS } from './data/hybrid.js';
import { bestFor } from './background.js';
import { lanesReady as triReady } from './tri.js';
import { lanesReady as hybReady } from './hybrid.js';
import { raceAgeBlock } from './age.js';

const DAY = 864e5;

// Run Track level where a distance becomes realistic: to run it at an easy pace (finish), to race it
// for a time (time), and to get round with walk breaks at a much slower pace (runwalk: the Galloway
// run-walk method, possible from the Walk-Jogger level for a 5K).
export const NEEDS = {
  '5k': { finish: 4, time: 5, runwalk: 2, km: 5, label: '5K' },
  '10k': { finish: 7, time: 8, runwalk: 5, km: 10, label: '10K' },
  half: { finish: 9, time: 10, runwalk: 7, km: 21.1, label: 'half marathon' },
  marathon: { finish: 12, time: 12, runwalk: 10, km: 42.2, label: 'marathon' },
};
// Shorter options to suggest, longest first.
// Taper before the race, by distance (weeks): a few easy days for a 5K, two weeks for a marathon.
export const TAPER = { '5k': 0.5, '10k': 1, half: 1.5, marathon: 2 };
const SHORTER = { marathon: ['half', '10k', '5k'], half: ['10k', '5k'], '10k': ['5k'], '5k': [] };

// Weeks to work through a level: its sessions spread over the training days, but never faster than
// the body adapts (tendons and bones lag behind fitness, more so at the start). The beginner floor
// matches the evidence-based NHS Couch to 5K: about 9 weeks from zero to a continuous 5K at 3 runs a week.
const minWeeks = n => (n <= 3 ? 3 : n <= 8 ? 1.5 : 2);
const levelWeeks = (n, days, left = null) => {
  const sessions = RUN_LEVELS[n - 1].steps.filter(s => s.type !== 'rest').length;
  const todo = left == null ? sessions : left;
  return Math.max(left == null ? minWeeks(n) : minWeeks(n) * (todo / sessions), todo / Math.max(2, days));
};
// Months of steady running a body needs before a distance, whatever the sessions say (common coaching
// guidance: a continuous 5K after ~2 months from zero, 10K ~4-5 months, half ~6 months, a first
// marathon after about a year). As weeks of running "history" each level stands for.
const HISTORY = [[1, 0], [4, 9], [7, 20], [9, 26], [12, 52], [13, 70]];
export const historyAt = level => {
  for (let i = 1; i < HISTORY.length; i++) {
    const [l0, w0] = HISTORY[i - 1], [l1, w1] = HISTORY[i];
    if (level <= l1) return w0 + ((Math.max(level, l0) - l0) / (l1 - l0)) * (w1 - w0);
  }
  return HISTORY.at(-1)[1];
};
// Weeks from where the athlete is to being *at* level `goal`: the level path (sessions over training
// days, never faster than the body adapts) or the running history that distance needs, whichever is longer.
export function weeksToLevel(s, goal) {
  return breakdown(s, goal).weeks;
}
// Everything that moves the date, in one place:
//   - levels: sessions spread over the training days, never faster than the body adapts;
//   - running history the distance needs, minus credit for having run seriously before (the body
//     re-adapts faster: more for higher levels and more years, less the longer ago it was);
//   - an easier (deload) week about every 4th week: the level path takes ~15% longer;
//   - a buffer for sickness and missed days: ~10%, at least a week, on anything over 6 weeks.
// `best` is the optimistic case (no deloads, no buffer); `weeks` is the realistic one used for verdicts.
const RANK = { rec: 1, club: 2, comp: 3, subelite: 4, elite: 5 };
const AGO = { now: 1, lt1: 1, '1to3': 0.8, '3to10': 0.6, '10plus': 0.4 };
export function backgroundCredit(s) {
  const b = bestFor(s.background || [], 'run');
  if (!b) return 0;
  const lvl = RANK[b.level] || 0, yrs = +b.years || 1;
  const base = lvl >= 3 ? 0.6 : lvl === 2 ? 0.45 : 0.25; // share of the history requirement already "banked"
  return Math.min(0.75, base * (yrs >= 6 ? 1.15 : yrs >= 3 ? 1 : 0.8) * (AGO[b.since] ?? 0.6));
}
export function breakdown(s, goal) {
  const days = Math.max(2, s.profile?.days?.length || s.profile?.daysPerWeek || 3);
  const cur = s.run?.level || 1;
  const credit = backgroundCredit(s);
  if (cur >= goal) return { weeks: 0, best: 0, path: 0, history: 0, days, cur, goal, credit };
  const left = RUN_LEVELS[cur - 1].steps.filter((st, i) => st.type !== 'rest' && !s.run.done?.[i]).length;
  let path = levelWeeks(cur, days, left);
  for (let n = cur + 1; n < goal; n++) path += levelWeeks(n, days);
  const history = (historyAt(goal) - historyAt(cur)) * (1 - credit);
  const best = Math.max(path, history);
  const withDeload = Math.max(path * 1.15, history);
  const buffer = withDeload > 6 ? Math.max(1, withDeload * 0.1) : 0;
  const half = w => Math.ceil(w * 2) / 2;
  return { weeks: half(withDeload + buffer), best: half(best), path: Math.round(path), history: Math.round(history), deload: Math.round(withDeload - best), buffer: Math.round(buffer), days, cur, goal, credit, limit: history > path * 1.15 ? 'history' : 'path' };
}

// Finish-time range: from a real best (Riegel's formula, exponent 1.06) when there is one, else a
// typical easy-pace range for that kind of finish.
const BASE = { '5k': [35, 45], '10k': [70, 85], half: [150, 180], marathon: [300, 360] };
export function finishRange(distance, best5kMin, mode = 'finish') {
  const n = NEEDS[distance];
  if (!n) return null;
  if (best5kMin > 0) { const t = best5kMin * Math.pow(n.km / 5, 1.06); return mode === 'runwalk' ? [Math.round(t * 1.1), Math.round(t * 1.25)] : [Math.round(t * 1.03), Math.round(t * 1.12)]; }
  const [a, b] = BASE[distance];
  return mode === 'runwalk' ? [Math.round(a * 1.25), Math.round(b * 1.3)] : [a, b];
}

// A goal time against what the athlete's bests predict (Riegel from the best 5K, or the 10K converted).
// stretch: up to ~4% faster than predicted (possible on a great day); unrealistic beyond that.
export function judgeTime(distance, goalMin, bests = {}) {
  const n = NEEDS[distance];
  if (!n || !(goalMin > 0)) return null;
  const from5 = bests.run5k > 0 ? bests.run5k : bests.run10k > 0 ? bests.run10k / Math.pow(2, 1.06) : null;
  const pace = goalMin / n.km;
  if (!from5) return { kind: 'unknown', pace };
  const predicted = from5 * Math.pow(n.km / 5, 1.06);
  const r = goalMin / predicted;
  const kind = r > 1.06 ? 'easy' : r >= 1.0 ? 'realistic' : r >= 0.96 ? 'stretch' : 'too-fast';
  return { kind, pace, predicted, realistic: predicted, stretch: predicted * 0.96 };
}

const ymdPlus = (ymd, days) => new Date(new Date(`${ymd}T12:00:00`).getTime() + days * DAY).toISOString().slice(0, 10);
export const daysUntil = (ymd, now) => Math.floor((new Date(`${ymd}T12:00:00`) - new Date(new Date(now).toDateString())) / DAY); // whole days, local time

// The honest verdict. Every answer ends with something the athlete CAN do, and when.
//   ok:    ready with a week to spare for the taper
//   tight: only at a much slower pace (with walk breaks), or ready without a proper taper
//   no:    not safely by this date -> a shorter distance, or a later race (with its date)
export function verdict(s, race, now, events = []) {
  const days = daysUntil(race.date, now), weeksLeft = days / 7;
  const n = NEEDS[race.distance];
  const best5k = s.bests?.run5k || s.answers?.best5k || null;
  const ageNeed = raceAgeBlock(s, race.distance);
  if (ageNeed) return { kind: 'age', need: ageNeed, days, weeksLeft };
  if (!n) return otherVerdict(s, race, weeksLeft);
  // Racing for a time is never judged more harshly than finishing: when finishing isn't comfortable yet
  // (or the time asked is slower than they'd finish anyway), the finish verdict is the answer.
  if (race.goal === 'time') {
    const fin = verdict(s, { ...race, goal: 'finish' }, now, events);
    const t = judgeTime(race.distance, race.goalTime, { run5k: best5k, run10k: s.bests?.run10k });
    if (fin.kind !== 'ok' || t?.kind === 'easy') return { ...fin, time: t, mode: fin.kind === 'ok' ? 'time' : fin.mode };
  }
  // The distance itself needs the running history (finish level); racing it for a time adds the next
  // level's sessions on top, but no extra months: that history is about the distance, not the speed.
  const goal = race.goal === 'time' ? n.time : n.finish;
  const bdFinish = breakdown(s, n.finish);
  const timeExtra = race.goal === 'time' ? Math.max(0, breakdown(s, n.time).path - bdFinish.path) : 0;
  const bd = { ...bdFinish, goal, path: bdFinish.path + timeExtra, weeks: Math.ceil(Math.max(bdFinish.weeks, (bdFinish.path + timeExtra) * 1.25) * 2) / 2, best: Math.ceil(Math.max(bdFinish.best, bdFinish.path + timeExtra) * 2) / 2 };
  const wFull = bd.weeks, wWalk = weeksToLevel(s, n.runwalk);
  const canRunIt = bdFinish.weeks + (TAPER[race.distance] || 1) <= weeksLeft; // ready to run the distance, if not to race it
  const readyOn = ymdPlus(new Date(now).toISOString().slice(0, 10), Math.round(wFull * 7));
  const time = race.goal === 'time' ? judgeTime(race.distance, race.goalTime, { run5k: best5k, run10k: s.bests?.run10k }) : null;
  const base = { days, weeksLeft, need: wFull, readyOn, goalLevel: goal, bd, time };
  const taper = TAPER[race.distance] || 1;
  if (wFull + taper <= weeksLeft) return { ...base, kind: 'ok', mode: race.goal === 'time' ? 'time' : 'finish', range: finishRange(race.distance, best5k, 'finish') };
  if (wFull <= weeksLeft) return { ...base, kind: 'tight', mode: 'finish', why: 'no-taper', range: finishRange(race.distance, best5k, 'finish') };
  if (race.goal === 'time' && canRunIt) return { ...base, kind: 'tight', mode: 'finish', why: 'time-later', range: finishRange(race.distance, best5k, 'finish') };
  if (wWalk + 0.5 <= weeksLeft && (s.run?.level || 1) < n.finish) return { ...base, kind: 'tight', mode: 'runwalk', why: 'slower', range: finishRange(race.distance, best5k, 'runwalk') };
  // Not by this date: the longest shorter distance that fits, and a later race of this distance.
  const fits = (d, lvl) => weeksToLevel(s, lvl) + (TAPER[d] || 1) <= weeksLeft;
  const shorter = SHORTER[race.distance].find(d => fits(d, NEEDS[d].finish)) || SHORTER[race.distance].find(d => fits(d, NEEDS[d].runwalk));
  const later = events.filter(e => e.distance === race.distance && e.date >= ymdPlus(readyOn, 7) && !e.expected)
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  // A 5K can always be walked (with a few jogs) by someone without pain: a real way to take part.
  const walk = !shorter && (race.distance === '5k' || SHORTER[race.distance].includes('5k')) && !s.rebuild?.active ? '5k' : null;
  return { ...base, kind: 'no', shorter: shorter || walk, shorterMode: shorter ? (fits(shorter, NEEDS[shorter].finish) ? 'finish' : 'runwalk') : walk ? 'walk' : null, later };
}

// Triathlon and Hybrid: worlds on their map instead of run levels (about six weeks a world).
function otherVerdict(s, race, weeksLeft) {
  let need = 0, label = '';
  // Ready = in the race's world with all its lanes built (its boss IS the race). Each world to cross
  // takes ~6 weeks, and building the race world's lanes another ~6 (fewer if they're nearly there).
  const worlds = (want, world, ready) => (world > want ? 0 : world === want ? (ready ? 0 : 6) : (want - world + 1) * 6);
  if (['70.3', 'full', 'tri'].includes(race.distance) && s.tri) {
    const want = race.distance === 'full' ? TRI_WORLDS.length - 1 : race.distance === '70.3' ? TRI_WORLDS.findIndex(w => /70\.3|half/i.test(`${w.race} ${w.name}`)) : 1;
    need = worlds(want, s.tri.world || 0, triReady(s)); label = 'triathlon';
  } else if (['hyrox', 'alphax'].includes(race.distance) && s.hybrid) {
    const want = HYBRID_WORLDS.findIndex(w => w.id === 'solo');
    need = worlds(want, s.hybrid.world || 0, hybReady(s)); label = 'hybrid';
  } else return { kind: 'unknown', days: Math.round(weeksLeft * 7), weeksLeft };
  const kind = need + 1 <= weeksLeft ? 'ok' : need <= weeksLeft ? 'tight' : 'no';
  return { kind, mode: kind === 'tight' ? 'finish' : 'finish', days: Math.round(weeksLeft * 7), weeksLeft, need, label, other: true };
}

// Where in the run-up the athlete is, and this week's focus.
export function phase(race, now) {
  const d = daysUntil(race.date, now);
  const tri = ['70.3', 'full', 'tri'].includes(race.distance), hyb = ['hyrox', 'alphax'].includes(race.distance);
  if (d < -7) return { id: 'done', d };
  if (d < 0) return { id: 'recover', d, title: 'Recovery week', focus: ['Easy movement only: walks, an easy spin or swim', 'No hard sessions or heavy lifting until you feel fresh', 'Pick your next goal when you\'re ready'] };
  if (d === 0) return { id: 'race', d, title: 'Race day!', focus: ['Start slower than you want to', 'Eat and drink what you practised', 'Enjoy it: you earned this'] };
  if (d <= 7) return { id: 'raceweek', d, title: 'Race week', focus: [
    tri ? 'Short, easy swim, bike and run, each with a few minutes at race effort' : hyb ? 'Easy runs, plus one light station practice early in the week' : 'Easy runs only, plus a few short strides',
    'No heavy lifting: the last heavy legs were 7-10 days out', 'Sleep, eat well, drink water',
    tri ? 'Check your bike, wetsuit, transition bag and start time' : 'Check your kit, travel and start time'] };
  if (d <= 14) return { id: 'taper', d, title: 'Taper', focus: ['Cut your volume by about a third, keep the intensity', tri ? 'One short race-pace session in each sport' : hyb ? 'One short session at race pace with stations' : 'Keep one short session at race pace',
    'Strength: one session, half the sets, same weight', tri ? 'Your long ride and run are shorter this week' : 'Your long session is shorter this week'] };
  if (d <= 28) return { id: 'peak', d, title: 'Race prep', focus: [tri ? 'A brick (ride then run) at race effort' : hyb ? 'Race-pace runs with stations in between' : 'One session at your race pace',
    tri ? 'Long ride and run close to race effort; practise open water' : 'A long session close to race effort', 'Strength: 2 short, heavy full-body sessions', 'Practise race-day food and kit'] };
  return { id: 'build', d, title: 'Build', focus: ['Follow your level as usual: it builds you towards the race', 'Consistency beats big days'] };
}

// ---------- training days: too many for now, or too few to progress ----------
// What fits depends on who you are: a beginner jumping from 1 run to 4 days risks injury, while 5-6
// days is normal for an advanced runner; and 1-2 days is a fine start for a beginner but too little to
// keep an intermediate or advanced runner progressing.
//   tier: 'beginner' (Levels 1-4), 'intermediate' (5-8), 'advanced' (9+, or a competitive running past)
export function tierOf(level, background = []) {
  const b = bestFor(background, 'run'), strong = b && (RANK[b.level] || 0) >= 3 && (+b.years || 0) >= 3;
  return level >= 9 || (strong && level >= 5) ? 'advanced' : level >= 5 ? 'intermediate' : 'beginner';
}
export const DAYS_FIT = { beginner: [2, 3], intermediate: [3, 4], advanced: [4, 6] };
export function daysAdvice(recentPerWeek, chosenDays, level, background = []) {
  if (!(chosenDays > 0)) return null;
  const tier = tierOf(level, background), [lo, hi] = DAYS_FIT[tier];
  if (chosenDays >= 7) return { kind: 'many', tier, from: recentPerWeek, to: chosenDays, start: 6, lo, hi, noRest: true };
  if (chosenDays < lo && tier !== 'beginner') return { kind: 'few', tier, to: chosenDays, lo, hi };
  if (recentPerWeek == null || tier === 'advanced') return null; // advanced: up to 6 days is normal
  const jump = chosenDays - recentPerWeek;
  if (jump >= (tier === 'beginner' ? 2 : 3)) return { kind: 'many', tier, from: recentPerWeek, to: chosenDays, start: Math.max(2, Math.min(chosenDays, recentPerWeek + 1)), lo, hi };
  return null;
}
// Kept for the existing callers: only the "too many" case.
export function tooManyDays(recentPerWeek, chosenDays, level, background = []) {
  const a = daysAdvice(recentPerWeek, chosenDays, level, background);
  return a?.kind === 'many' && !a.noRest ? { from: a.from, to: a.to, start: a.start } : null;
}
// This week vs the athlete's normal (the 3 weeks before): more than ~1.5x is a spike (acute:chronic load).
export function loadSpike(history, now) {
  const W = 7 * DAY, sessions = h => h.kind === 'session' || h.kind === 'attempt' || h.kind === 'activity';
  const week = history.filter(h => sessions(h) && h.ts > now - W).length;
  const before = history.filter(h => sessions(h) && h.ts <= now - W && h.ts > now - 4 * W).length / 3;
  if (before < 1.5 || week < 3) return null; // too little history to judge, or a light week
  return week >= before * 1.5 + 1 ? { week, usual: Math.round(before * 10) / 10 } : null;
}
