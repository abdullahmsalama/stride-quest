// Coach suggestions. The AI (or the offline coach) proposes actions; this module checks each one
// against the app's rules and turns it into a card the athlete can Apply. Nothing changes without Apply.
import * as E from './engine.js';
import * as K from './calendar.js';
import { dreamTarget } from './goal.js';
import * as H from './hybrid.js';
import * as T from './tri.js';
import { RUN_LEVELS } from './data/tracks.js';

const LANE_NAMES = { run: '🏃 Run', strength: '🏋️ Strength', engine: '⚙️ Engine', swim: '🏊 Swim', bike: '🚴 Bike', prep: '🧱 Prep' };
const stageName = (s, lane) => (lane === 'run' ? `Level ${s.run.level} ${RUN_LEVELS[s.run.level - 1].name}`
  : lane === 'strength' ? H.strengthStage(s).name : lane === 'engine' ? H.engineStage(s).name
  : lane === 'swim' ? T.swimStage(s).name : lane === 'bike' ? T.bikeStage(s).name : `P${s.prep.level}`);

// New numbers -> run them through the same placement rules as the questionnaire.
function withNumbers(s, a, now) {
  const st = JSON.parse(JSON.stringify(s));
  const ans = { ...(st.answers || {}) };
  const set = (k, v) => { if (v != null && v !== '' && isFinite(+v) && +v > 0) ans[k] = +v; };
  set('bodyweight', a.bodyweightKg); set('squat5', a.squat5Kg); set('deadlift5', a.deadlift5Kg); set('pullups', a.pullups);
  set('row1000', a.row1000Min); set('best5k', a.best5kMin); set('best10k', a.best10kMin); set('longestKm', a.longestRunKm);
  set('swimM', a.swimM); set('rideKm', a.rideKm); set('weeklyKm', a.weeklyKm);
  if (a.squat5Kg || a.deadlift5Kg || a.bodyweightKg) { ans.liftUnit = 'kg'; ans.liftMode = '5'; }
  const changes = [];
  const run0 = st.run.level;
  if (a.best5kMin || a.best10kMin || a.longestRunKm || a.weeklyKm) {
    const runLevel = Math.max(1, E.qualifyingLevel({ ...ans, sex: st.profile.sex }) - 1);
    if (runLevel !== run0) { st.run = { ...st.run, level: runLevel, done: {}, startedAt: now, gatePassed: false }; changes.push(['run', run0]); }
  }
  if (H.hasHybrid(st) && (a.squat5Kg || a.deadlift5Kg || a.bodyweightKg || a.pullups || a.row1000Min)) {
    const fresh = H.placeHybrid(st, { ...ans, liftExp: ans.liftExp || 'lt1' }, now);
    for (const lane of ['strength', 'engine']) {
      if (fresh[lane].stage !== st.hybrid[lane].stage && (lane === 'strength' ? a.squat5Kg || a.deadlift5Kg || a.bodyweightKg || a.pullups : a.row1000Min)) {
        changes.push([lane, st.hybrid[lane].stage]);
        st.hybrid[lane] = { stage: fresh[lane].stage, done: {} };
      }
    }
  }
  if (T.hasTri(st) && (a.swimM || a.rideKm)) {
    const fresh = T.placeTri(st, { ...ans, freestyle: ans.freestyle || 'yes', openWater: ans.openWater || 'yes', bikeAccess: ans.bikeAccess || 'road' });
    for (const lane of ['swim', 'bike']) {
      if ((lane === 'swim' ? a.swimM : a.rideKm) && fresh[lane].stage !== st.tri[lane].stage) { changes.push([lane, st.tri[lane].stage]); st.tri[lane] = { stage: fresh[lane].stage, done: {} }; }
    }
  }
  st.answers = ans;
  return { st, changes };
}

function oneBack(s, track) {
  const st = JSON.parse(JSON.stringify(s));
  if (track === 'run' && st.run.level > 1) { st.run = { ...st.run, level: st.run.level - 1, done: {}, gatePassed: false }; return st; }
  if ((track === 'strength' || track === 'engine') && H.hasHybrid(st) && st.hybrid[track].stage > 0) { st.hybrid[track] = { stage: st.hybrid[track].stage - 1, done: {} }; return st; }
  if ((track === 'swim' || track === 'bike') && T.hasTri(st) && st.tri[track].stage > 0) { st.tri[track] = { stage: st.tri[track].stage - 1, done: {} }; return st; }
  if (track === 'prep' && st.prep.level > 0) { st.prep = { ...st.prep, level: st.prep.level - 1, done: {} }; return st; }
  return null;
}

const DAY = K.DAY_NAMES;
// Rough length of a session from its words: "2 x 8 min" = 16, "10 min easy, 10 min hard" = 20, "8 km" ≈ 52.
export function minutesOf(text) {
  let t = String(text || ''), m = 0, any = false;
  t = t.replace(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*min/gi, (_, a, b) => { m += a * b; any = true; return ''; });
  t = t.replace(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*km/gi, (_, a, b) => { m += a * b * 6.5; any = true; return ''; });
  for (const x of t.matchAll(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b(?:\s*(\d+)\s*min)?/gi)) { m += x[1] * 60 + (+x[2] || 0); any = true; }
  t = t.replace(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\b(?:\s*(\d+)\s*min)?/gi, '');
  for (const x of t.matchAll(/(\d+(?:\.\d+)?)\s*min/gi)) { m += +x[1]; any = true; }
  for (const x of t.matchAll(/(\d+(?:\.\d+)?)\s*km/gi)) { m += x[1] * 6.5; any = true; }
  return any ? Math.round(m) : null;
}
const QUALITY = /interval|tempo|threshold|hill|fartlek|race pace|sprint|hard|vo2|×|\d\s*x\s*\d/i;
const TEST = it => it.type === 'gate' || it.type === 'proveit' || it.boss || it.test || it.track === 'triGate' || it.track === 'hyGate';
// Is the new version harder than the plan? Longer (by more than 5%) or adds hard efforts.
function harder(from, to) {
  const a = minutesOf(from), b = minutesOf(to);
  return (a && b && b > a * 1.05) || (QUALITY.test(to) && !QUALITY.test(from));
}
// How much harder the coach may make a session: up to +25% (at least 10 min), never while hurt or sick.
const tooMuch = (from, to) => { const a = minutesOf(from), b = minutesOf(to); return a && b && b > Math.max(a * 1.25, a + 10); };
const findItem = (s, key, now) => K.buildWeek(s, now).days.flatMap(d => d.items.map(it => ({ ...it, day: d.i }))).find(x => x.key === key && !x.done);
const clean = (v, n) => String(v ?? '').replace(/[<>]/g, '').trim().slice(0, n);

// Returns { label, detail, warnings } for a valid action, or null when it can't or shouldn't apply.
export function describe(s, a, now) {
  if (!a || typeof a.type !== 'string') return null;
  switch (a.type) {
    case 'start_sick': {
      if (s.mode?.type === 'sick') return null;
      const where = a.where === 'above' ? 'above' : 'below';
      return { label: `🤒 Turn on sick mode`, detail: where === 'above' ? 'Symptoms above the neck: easy movement only, if you feel like it.' : 'Fever or below the neck: full rest. Your streak is frozen.' };
    }
    case 'start_busy':
      if (s.mode) return null;
      return { label: '🧳 Busy mode this week', detail: 'Only Key sessions are planned. Short versions count.' };
    case 'end_mode':
      if (!s.mode) return null;
      return { label: s.mode.type === 'sick' ? '💛 I feel better: start my recovery plan' : '✅ Back to normal training', detail: '' };
    case 'report_pain':
      if (s.rebuild.active && !(a.redFlag && !s.rebuild.redFlag)) return null;
      return { label: '🩹 Switch to the Rebuild Track', detail: a.redFlag ? 'Running pauses until a physio or doctor clears you. Your level is saved.' : 'Isometrics, strength and landing first. Your level is saved.' };
    case 'move_session': {
      const day = Number.isInteger(a.day) ? a.day : null;
      if (day == null || day < 0 || day > 6) return null;
      const w = K.buildWeek(s, now);
      if (day < w.today) return null;
      const item = w.days.flatMap(d => d.items).find(x => x.key === a.key && !x.done);
      if (!item) return null;
      const warnings = K.previewMove(s, a.key, day, now).map(x => x.text);
      return { label: `📅 Move “${clean(item.title, 60)}” to ${DAY[day]}`, detail: '', warnings };
    }
    case 'change_session': {
      const item = findItem(s, a.key, now), title = clean(a.title, 90), detail = clean(a.detail, 220);
      if (!item || !title || TEST(item) || title === item.title && detail === (item.detail || '')) return null;
      const up = harder(item.title, `${title} ${detail}`);
      if (up && (s.rebuild?.active || s.mode?.type === 'sick' || tooMuch(item.title, `${title} ${detail}`))) return null;
      return { label: `✏️ ${DAY[item.day]}: “${clean(item.title, 50)}” → “${title}”`, detail: detail || 'This week only.', warnings: up ? ['A step up from the plan: keep the effort as planned and stop if anything hurts.'] : [] };
    }
    case 'skip_session': {
      const item = findItem(s, a.key, now);
      if (!item) return null;
      return { label: `😴 Rest instead of “${clean(item.title, 60)}” (${DAY[item.day]})`, detail: 'It comes back next week. Rest days are when your body adapts.', warnings: item.keySession ? ['This is a key session this week.'] : [] };
    }
    case 'set_days': {
      const days = [...new Set((a.days || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((x, y) => x - y);
      if (days.length < 2) return null;
      const longDay = days.includes(a.longDay) ? a.longDay : days.includes(5) ? 5 : days.at(-1);
      return { label: `📅 Train on ${days.map(d => DAY[d]).join(', ')}`, detail: `Longest session on ${DAY[longDay]}.` };
    }
    case 'update_numbers': {
      const { st, changes } = withNumbers(s, a, now);
      if (!changes.length) return null;
      return { label: `🔄 Update your placement`, detail: changes.map(([lane]) => `${LANE_NAMES[lane]}: ${stageName(s, lane)} → ${stageName(st, lane)}`).join(' · ') };
    }
    case 'level_down': {
      const st = oneBack(s, a.track);
      if (!st) return null;
      return { label: `⬇️ One step back on ${LANE_NAMES[a.track] || a.track}`, detail: `${stageName(s, a.track)} → ${stageName(st, a.track)}. No shame: building a base is how you go faster later.` };
    }
    case 'set_dream': {
      const text = clean(a.text, 160);
      if (!text) return null;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : '';
      return { label: `🎯 Set your dream: ${text}`, detail: [clean(a.event, 60), date].filter(Boolean).join(' · ') };
    }
    default:
      return null;
  }
}

// A suggestion that no longer applies because it has already happened (e.g. the athlete started the
// Rebuild Track from the pain pop-up before tapping Apply). Returns a short confirmation, or null.
export function alreadyDone(s, a, now) {
  if (!a || typeof a.type !== 'string') return null;
  switch (a.type) {
    case 'report_pain': return s.rebuild.active ? (s.rebuild.redFlag ? 'Already on the Rebuild Track (running paused) ✓' : 'Already on the Rebuild Track ✓') : null;
    case 'start_sick': return s.mode?.type === 'sick' ? 'Sick mode is already on ✓' : null;
    case 'start_busy': return s.mode?.type === 'busy' ? 'Busy mode is already on ✓' : null;
    case 'end_mode': return !s.mode ? 'Already back to normal training ✓' : null;
    case 'update_numbers': return withNumbers(s, a, now).changes.length ? null : 'Your placement already matches these numbers ✓';
    default: return null;
  }
}

// Apply a (valid) action. Returns { state, message, open } where `open` asks the UI to show a modal.
export function apply(s, a, now) {
  switch (a.type) {
    case 'start_sick': return { state: E.startMode(s, { type: 'sick', where: a.where === 'above' ? 'above' : 'below' }, now), message: 'Sick mode on. Rest is training too 💤' };
    case 'start_busy': return { state: E.startMode(s, { type: 'busy' }, now), message: 'Busy mode on: only Key sessions this week.' };
    case 'end_mode': {
      const { state, summary } = E.endMode(s, now);
      return { state, message: 'Welcome back! Easy does it 💪', open: summary ? { type: 'return', summary } : null };
    }
    case 'report_pain': return { state: E.enterRebuild(s, { redFlag: !!a.redFlag, now }), message: a.redFlag ? 'Running paused. Please see a professional.' : 'Rebuild Track started. Your level is saved.' };
    case 'move_session': return { state: K.moveItem(s, a.key, a.day, now), message: `Moved to ${DAY[a.day]}.` };
    case 'change_session': { const it = findItem(s, a.key, now); return { state: K.editItem(s, a.key, { title: clean(a.title, 90), detail: clean(a.detail, 220), from: it?.title }, now), message: 'Session changed for this week ✏️' }; }
    case 'skip_session': return { state: K.skipItem(s, a.key, now), message: 'Rest it is 😴 It comes back next week.' };
    case 'set_days': {
      const days = [...new Set(a.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
      return { state: K.setSchedule(s, days, a.longDay), message: 'Training days updated.' };
    }
    case 'update_numbers': {
      const { st, changes } = withNumbers(s, a, now);
      return { state: st, message: changes.length ? 'Placement updated. Your maps show the new spots.' : 'Nothing to change.' };
    }
    case 'level_down': return { state: oneBack(s, a.track) || s, message: 'One step back. Strong foundations first 💪' };
    case 'set_dream': {
      const st = JSON.parse(JSON.stringify(s));
      const text = clean(a.text, 160), event = clean(a.event, 60);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : '';
      st.profile.dream = { text, event, date, target: dreamTarget(`${text} ${event}`) };
      return { state: st, message: '🎯 Dream saved. Your map shows where it lives.' };
    }
  }
  return { state: s, message: '' };
}

// The week as the coach sees it: one line per planned session, with keys it can refer to.
export function weekContext(s, now) {
  const w = K.buildWeek(s, now);
  const lines = w.days.flatMap(d => d.items.filter(i => !i.done && i.key).map(i => `${i.key} | ${d.name}(${d.i}) | ${i.title}${i.keySession ? ' [key]' : ''}`));
  return `WEEK PLAN (key | day | session):\n${lines.join('\n') || '(nothing planned)'}\nToday is ${w.days[w.today].name}(${w.today}). Training days: ${K.schedule(s).days.map(d => DAY[d]).join(', ')}.${s.mode ? ` Mode on: ${s.mode.type}.` : ''}`;
}

// Offline coach: simple keyword reading that proposes the same actions.
export function offlineActions(text, s) {
  const t = text.toLowerCase();
  const out = [];
  if (/(fever|flu|covid|cold|sick|ill\b|chills|stomach bug|vomit)/.test(t) && !s.mode) out.push({ type: 'start_sick', where: /(fever|flu|chills|chest|stomach|vomit|aches)/.test(t) ? 'below' : 'above' });
  else if (/(better now|feel better|recovered|back to normal|i'?m back)/.test(t) && s.mode) out.push({ type: 'end_mode' });
  else if (/(busy|travel|trip|vacation|holiday|work crunch|exams)/.test(t) && !s.mode) out.push({ type: 'start_busy' });
  // Tired: today's session becomes an easy 20-30 min (a hard one), or a rest (an easy one). Never a test.
  if (/(tired|exhausted|knackered|no energy|drained|wiped)/.test(t) && !s.mode) {
    const w = K.buildWeek(s, Date.now()), it = w.days[w.today].items.find(x => !x.done && x.key && !TEST(x));
    if (it) out.push(QUALITY.test(it.title) || it.cls === 'long' ? { type: 'change_session', key: it.key, title: it.cls === 'long' ? 'Easy run 30 min' : 'Easy run 25 min', detail: 'Tired today: easy and short instead. The plan picks up again tomorrow.' } : { type: 'skip_session', key: it.key });
  }
  if (/(hurt|pain|injur|sprain|strain|swollen|swelling)/.test(t) && !s.rebuild.active) out.push({ type: 'report_pain', redFlag: /(sharp|swollen|swelling|night|can'?t walk|cannot walk|fracture|surgery)/.test(t) });
  return out;
}
