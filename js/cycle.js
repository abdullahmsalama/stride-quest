// Menstrual cycle (optional, women 13+). Everything stays on the device: it is never counted, synced or
// sent to the AI coach unless the athlete switches that on. Pure functions (no DOM). Evidence used:
//   Performance changes across the cycle are trivial and vary between women (McNulty 2020 meta-analysis),
//   so the plan itself stays; period days are a bit lighter by default and she can always go full.
//   Luteal phase: resting energy up ~2.5-11% (Benton 2020), higher core temperature (heat feels harder).
//   Iron losses during the period: iron-deficiency is common in female athletes (Sim 2019).
//   No period for 90+ days (not pregnant, no hormonal contraception) is a REDs warning sign (IOC 2023).
// The cycle is stored as s.cycle = { mode: 'track' | 'hormonal', starts: [ymd], len, periodLen,
//   assumed: ymd | null (expected start she chose not to confirm), asked: ymd, coach, day: { ymd: 'light' | 'full' } }.

const DAY = 864e5;
const t = ymd => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
export const daysBetween = (a, b) => Math.round((t(b) - t(a)) / DAY);
export const addDays = (ymd, n) => new Date(t(ymd) + n * DAY).toISOString().slice(0, 10);

export const canTrack = s => s.profile?.sex === 'f';
export const tracking = c => c?.mode === 'track' && (c.starts || []).length > 0;
export const on = c => c?.mode === 'track' || c?.mode === 'hormonal';

// Her own average once two or more cycles are logged (only plausible ones, 21-45 days), else what she told us.
export function cycleLen(c) {
  const st = [...(c.starts || [])].sort(), gaps = [];
  for (let i = 1; i < st.length; i++) { const g = daysBetween(st[i - 1], st[i]); if (g >= 21 && g <= 45) gaps.push(g); }
  const last = gaps.slice(-6);
  return last.length ? Math.round(last.reduce((a, b) => a + b, 0) / last.length) : +c.len || 28;
}
export const lastStart = c => [...(c.starts || [])].sort().at(-1) || null;
// The day the current cycle is counted from: her last logged start, or the expected one she didn't confirm.
const anchor = c => [lastStart(c), c.assumed].filter(Boolean).sort().at(-1) || null;
export const expected = c => (anchor(c) ? addDays(anchor(c), cycleLen(c)) : null);
export const cycleDay = (c, ymd) => (anchor(c) ? daysBetween(anchor(c), ymd) + 1 : null);

// Phases, counted from the start. Ovulation is about 14 days before the next period.
export function phaseOf(c, ymd) {
  if (!tracking(c)) return null;
  if (c.assumed && c.assumed > lastStart(c)) return null; // she preferred not to say: no guesses about this cycle
  const d = cycleDay(c, ymd), len = cycleLen(c), pl = +c.periodLen || 5, ov = len - 14;
  if (d == null || d < 1) return null;
  if (d <= pl) return 'period';
  if (d > len) return 'late';
  if (d < ov - 1) return 'follicular';
  if (d <= ov + 1) return 'ovulation';
  return d > len - 5 ? 'pms' : 'luteal';
}
export const PHASES = {
  period: { name: 'Period', icon: '🌸', tip: 'Sessions are a bit lighter today. Light movement often eases cramps.' },
  follicular: { name: 'Follicular', icon: '🌱', tip: 'Many women feel their strongest now: a good time to push the weights or a test.' },
  ovulation: { name: 'Ovulation', icon: '✨', tip: 'Warm up well and land softly on jumps and changes of direction.' },
  luteal: { name: 'Luteal', icon: '🌙', tip: 'Your body runs a little warmer: hard sessions and heat can feel tougher. Drink a bit more.' },
  pms: { name: 'Before your period', icon: '🌙', tip: 'Energy can dip before your period. Swapping to an easier session is fine.' },
  late: { name: 'Period due', icon: '📅', tip: 'Your period is due. Log it when it starts so your phases stay right.' },
};

// Period days are lighter by default; she can switch any single day to full, or to lighter (feeling rough).
export function lighter(c, ymd) {
  if (!on(c)) return false;
  const pick = c.day?.[ymd];
  if (pick) return pick === 'light';
  return phaseOf(c, ymd) === 'period';
}

// The daily "did it start?" question: from the expected day on, once a day, until she says yes,
// prefers not to say or closes it (then it waits for the next cycle).
export const shouldAsk = (c, ymd) => tracking(c) && ymd >= expected(c) && c.asked !== ymd;
export const markAsked = (c, ymd) => ({ ...c, asked: ymd });
export const skipCycle = c => ({ ...c, assumed: expected(c) });
export function logStart(c, ymd) {
  const starts = [...new Set([...(c.starts || []), ymd])].sort().slice(-12);
  return { ...c, mode: 'track', starts, assumed: c.assumed && c.assumed > ymd ? c.assumed : null, asked: null };
}

// A gentle health note: no period logged for 90+ days, or cycles that keep running long (35+ days).
// Not for teens (irregular cycles are normal in the first years) or on hormonal contraception.
export function lateNote(c, ymd, teen) {
  if (teen || !tracking(c) || c.assumed > lastStart(c)) return null;
  const since = daysBetween(lastStart(c), ymd);
  if (since >= 90) return { level: 'warn', text: 'No period logged for 3 months. If you\'re not pregnant, missed periods can be a sign of not eating enough for your training (REDs). Worth a chat with a doctor.' };
  if ((c.starts || []).length >= 4 && cycleLen(c) > 35) return { level: 'info', text: 'Your cycles are running long (over 35 days). That can be normal for you, but if it\'s new, a doctor can check it.' };
  return null;
}

// Gym sessions on a lighter day: one set fewer (at least 2), one more rep in the tank, and easy cardio
// instead of intervals. Weights stay the same: it's less work, not a step back.
export function lightGym(items) {
  return (items || []).map(x => ({ ...x, sets: Math.max(Math.min(2, x.sets), x.sets - 1), rir: typeof x.rir === 'number' ? x.rir + 1 : x.rir }));
}
export function lightFinish(f) {
  if (!f || !/interval/i.test(f.text)) return f;
  const machine = /\(([^)]*)\)\s*$/.exec(f.text)?.[1];
  return { min: 10, text: `Cardio finisher, 10 min easy: you could hold a conversation${machine ? ` (${machine})` : ''}` };
}
// Every other session on a lighter day: what to change, by kind. Mobility and prep stay as they are.
const QUALITY = /interval|tempo|hill|fartlek|threshold|progress|x\s*\d|\d\s*x|×|race pace|strides|sprint/i;
export function lightNote(st, track) {
  if (!st) return '';
  if (st.type === 'gate' || st.type === 'proveit' || st.boss || st.test) return 'A test on a period day: do it if you feel good, or move it a few days (tap Move on Today). No need to test on a rough day.';
  if (track === 'prep' || track === 'rebuild' || st.type === 'maint' || st.type === 'prep' || st.type === 'rest') return 'Mobility and prep stay as they are: gentle movement often helps on period days.';
  if (st.type === 'lift' || track === 'strength') return 'One set fewer on each exercise and leave one more rep in the tank. Same weights: less work, not a step back.';
  if (st.type === 'engine' || track === 'engine') return 'About two-thirds of the rounds, at a steady effort rather than all-out.';
  if (QUALITY.test(`${st.title} ${st.detail || ''}`)) return 'Make the hard part about half to two-thirds as long (fewer reps or minutes), at comfortably hard, not all-out. Warm-up and cool-down as normal.';
  return 'About two-thirds of it (e.g. 45 min → 30 min), at an easy effort.';
}

// Nutrition: a little more energy in the luteal phase, iron and fluids on period days.
export const extraKcal = phase => (phase === 'luteal' || phase === 'pms' ? 150 : 0);
export function nutriTip(phase) {
  if (phase === 'period') return 'Period days: top up iron (red meat, lentils, beans, spinach, with some vitamin C like orange or peppers) and drink a bit more.';
  if (phase === 'luteal' || phase === 'pms') return 'You may be hungrier now: that\'s normal, your body burns about 100-200 kcal more a day. Added to today\'s target. Carb-based snacks are fine.';
  return '';
}

// One line for the coach, only if she switched that on.
export function coachLine(c, ymd) {
  if (!c?.coach || !on(c)) return null;
  if (c.mode === 'hormonal') return `CYCLE (shared by the athlete): on hormonal contraception.${lighter(c, ymd) ? ' Chose a lighter session today.' : ''}`;
  const ph = phaseOf(c, ymd);
  return ph ? `CYCLE (shared by the athlete): day ${cycleDay(c, ymd)}, ${PHASES[ph].name.toLowerCase()} phase${lighter(c, ymd) ? '; sessions lighter today' : ''}. Be matter-of-fact and supportive.` : null;
}
