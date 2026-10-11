// Coach suggestions. The AI (or the offline coach) proposes actions; this module checks each one
// against the app's rules and turns it into a card the athlete can Apply. Nothing changes without Apply.
import * as E from './engine.js';
import * as K from './calendar.js';
import { dreamTarget } from './goal.js';

const DAY = K.DAY_NAMES;
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
    case 'set_days': {
      const days = [...new Set((a.days || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((x, y) => x - y);
      if (days.length < 2) return null;
      const longDay = days.includes(a.longDay) ? a.longDay : days.includes(5) ? 5 : days.at(-1);
      return { label: `📅 Train on ${days.map(d => DAY[d]).join(', ')}`, detail: `Longest session on ${DAY[longDay]}.` };
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
    case 'set_days': {
      const days = [...new Set(a.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
      return { state: K.setSchedule(s, days, a.longDay), message: 'Training days updated.' };
    }
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
  if (/(hurt|pain|injur|sprain|strain|swollen|swelling)/.test(t) && !s.rebuild.active) out.push({ type: 'report_pain', redFlag: /(sharp|swollen|swelling|night|can'?t walk|cannot walk|fracture|surgery)/.test(t) });
  return out;
}
