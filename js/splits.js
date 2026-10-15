// Strength splits: how the week's lifting is grouped, from the number of strength days and the time
// of the season. Evidence used: training each muscle about twice a week beats once (Schoenfeld 2016),
// and for athletes who also run or race, full-body / upper-lower splits interfere least (concurrent
// training: Wilson 2012; Murlasits 2018). In race prep strength is kept heavy but short; the taper
// halves the sets and keeps the weight; race week drops heavy lifting (last heavy legs 7-10 days out).
import { STRENGTH_STAGES } from './data/hybrid.js';

export const SPLITS = {
  full: { label: 'Full body', short: 'Full body', days: [1, 3], why: 'Every session trains legs, push and pull. With 1-3 lifting days each muscle still gets trained often, and no day leaves your legs wrecked for running.' },
  ulf: { label: 'Lower / Upper / Full', short: 'Lower · Upper · Full', days: [3, 3], why: 'For 3 days and some lifting experience: one heavy leg day, one upper day, and a lighter full-body day. Legs get two hits a week.' },
  ul: { label: 'Upper / Lower', short: 'Upper · Lower ×2', days: [4, 4], why: 'For 4 days: each muscle twice a week, with heavy legs on only two days you can place away from key runs.' },
  ulppl: { label: 'Upper / Lower / Push / Pull / Legs', short: 'U · L · Push · Pull · Legs', days: [5, 5], why: 'For 5 days when strength is a big goal: twice a week for every muscle. It leaves less room for running and engine work.' },
  ppl: { label: 'Push / Pull / Legs ×2', short: 'Push · Pull · Legs ×2', days: [6, 6], why: 'For 6 lifting days, when strength or muscle is the main goal. Hard to combine with serious running: expect heavier legs.' },
  bro: { label: 'Bro split (one muscle group a day)', short: 'Bro split', days: [5, 5], why: 'Chest day, back day, leg day… Each muscle is trained once a week and leg day leaves you very sore, which clashes with running. Fine for bodybuilding; not what we\'d pick for a hybrid athlete.' },
};

// The best split for a number of strength days (1-6), the athlete's lifting stage and the season.
//   season: 'normal' | 'peak' (race prep) | 'taper' | 'raceweek' | 'recover'
export function recommend(days, stage = 3, season = 'normal') {
  if (season === 'raceweek') return { id: null, label: 'No heavy lifting', why: 'Race week: the last heavy legs were 7-10 days out. At most a light activation (bodyweight, or 2 x 5 at about half weight) 3+ days before the race.' };
  if (season === 'recover') return { id: null, label: 'Mobility, then ease back in', why: 'The week after a race: mobility and easy movement. Lift again when the soreness is gone.' };
  if (season === 'taper') return { id: 'full', label: 'Full body ×1, half the sets', why: 'Taper: one full-body session, same weights, about half the sets. Keeps you strong without tired legs.' };
  if (season === 'peak') return { id: 'full', label: `Full body ×${Math.min(2, days)}, heavy but short`, why: 'Race prep: 1-2 full-body sessions, 2-3 sets of 3-5 reps, leaving 2 reps in the tank, plus race-specific station work. Strength is kept, freshness comes first.' };
  if (stage < 2) return { id: 'full', label: 'Full body', why: 'While you learn the movements, full body is best: more practice of each lift, less soreness.' };
  const id = days <= 2 ? 'full' : days === 3 ? (stage >= 3 ? 'ulf' : 'full') : days === 4 ? 'ul' : days === 5 ? 'ulppl' : 'ppl';
  return { id, label: SPLITS[id].label, why: SPLITS[id].why };
}

// The sessions of one rotation of a split, built from a stage's main lifts (title + exercise ids).
const T = (name, ...ps) => ({ type: 'lift', title: `${name}: ${ps.map(p => p[0]).join(' · ')}`, ex: [...new Set(ps.map(p => p[1]))] });
export function splitSessions(id, p, days = 3) {
  const light = [p.hingeLight[0], p.hingeLight[1]];
  switch (id) {
    case 'ulf': return [T('Lower', p.squat, light), T('Upper', p.push, p.pull, p.row), T('Full body', p.single, p.bench, p.carry)];
    case 'ul': return [T('Lower A', p.squat, p.single), T('Upper A', p.push, p.pull), T('Lower B', p.hinge, p.carry), T('Upper B', p.bench, p.row)];
    case 'ulppl': return [T('Upper', p.bench, p.row), T('Lower', p.squat, light), T('Push', p.push, ['Push-ups 3 x max', 'pushup']), T('Pull', p.pull, p.row), T('Legs', p.hinge, p.single)];
    case 'ppl': return [T('Push A', p.bench, p.push), T('Pull A', p.pull, p.row), T('Legs A', p.squat, light), T('Push B', p.push, ['Push-ups 3 x max', 'pushup']), T('Pull B', p.row, p.pull), T('Legs B', p.hinge, p.single, p.carry)];
    case 'bro': return [T('Chest', p.bench, ['Push-ups 3 x max', 'pushup']), T('Back', p.pull, p.row), T('Legs', p.squat, p.hinge), T('Shoulders', p.push, p.carry), T('Arms', ['Curls + triceps 3 x 10-12', 'arms'])];
    default: { // full body A / B / C: as many as there are days (2-3)
      const all = [T('Full body A', p.squat, p.push, p.pull), T('Full body B', p.hinge, p.bench, p.row), T('Full body C', p.single, p.pull, p.carry)];
      return all.slice(0, Math.max(2, Math.min(3, days)));
    }
  }
}

// Strength days a week: the athlete's choice, else what the hybrid week gives at this many training days.
export const strengthDays = (s, trainingDays) => s.hybrid?.split?.days || ({ 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3 })[trainingDays] || 2;

// The split in use: the athlete's pick when it fits their days, else the recommendation.
export function activeSplit(s, trainingDays) {
  const n = strengthDays(s, trainingDays), stage = s.hybrid?.strength?.stage ?? 0, pick = s.hybrid?.split?.id;
  if (stage < 2 || !STRENGTH_STAGES[Math.min(stage, STRENGTH_STAGES.length - 1)].parts) return { id: 'full', days: n, auto: true, stageDefault: true };
  if (pick && pick !== 'auto') return { id: pick, days: n, auto: false };
  return { id: recommend(n, stage).id, days: n, auto: true };
}
