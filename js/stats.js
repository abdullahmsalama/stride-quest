// Stats: "better than X% of <group>", from published distributions (js/data/norms.js). Pure maths,
// the same answer every time; the LLM never makes these numbers.
import { NORMS, ACTIVITY, RHO } from './data/norms.js';

// ---------- normal distribution ----------
export function normCdf(z) {
  // Abramowitz-Stegun 7.1.26 via erf, |error| < 1.5e-7.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
export function normInv(p) {
  // Acklam's rational approximation.
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(Math.max(p, 1e-9), 1 - 1e-9);
  if (q < 0.02425) { const r = Math.sqrt(-2 * Math.log(q)); return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  if (q > 1 - 0.02425) return -normInv(1 - q);
  const r = q - 0.5, t = r * r;
  return (((((a[0] * t + a[1]) * t + a[2]) * t + a[3]) * t + a[4]) * t + a[5]) * r / (((((b[0] * t + b[1]) * t + b[2]) * t + b[3]) * t + b[4]) * t + 1);
}
const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);

// Share of people at least as good as you in BOTH of two things, when you beat share p1 and p2 of
// people in each and the two abilities correlate by rho (Gaussian model, Simpson integration).
export function jointTop(p1, p2, rho) {
  const a = normInv(p1), b = normInv(p2), s = Math.sqrt(1 - rho * rho);
  const hi = a + 9, n = 400, hstep = (hi - a) / n;
  let sum = 0;
  for (let i = 0; i <= n; i++) {
    const x = a + i * hstep;
    const f = phi(x) * (1 - normCdf((b - rho * x) / s));
    sum += f * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  }
  return (sum * hstep) / 3;
}

// ---------- percentiles from breakpoints ----------
// table: [[percentile, value], ...] where `percentile` = share of the group you beat at that value
// (already oriented: for times, a lower time beats more people). Linear between points, and a
// normal tail outside them so the numbers stay sensible; capped at 1-99.
export function percentile(table, value) {
  const pts = [...table].sort((x, y) => x[0] - y[0]);
  const up = pts.at(-1)[1] > pts[0][1]; // value grows with percentile (lifts) or shrinks (times)
  const better = (v, w) => (up ? v > w : v < w);
  if (!better(value, pts[0][1]) && value !== pts[0][1]) return tail(pts, value, up, 'low');
  for (let i = 1; i < pts.length; i++) {
    const [p0, v0] = pts[i - 1], [p1, v1] = pts[i];
    if (!better(value, v1)) return clamp(p0 + ((value - v0) / (v1 - v0)) * (p1 - p0));
  }
  return tail(pts, value, up, 'high');
}
function tail(pts, value, up, side) {
  // Extend with the slope (in z units) of the nearest two breakpoints.
  const [[pa, va], [pb, vb]] = side === 'low' ? [pts[0], pts[1]] : [pts.at(-2), pts.at(-1)];
  const za = normInv(pa / 100), zb = normInv(pb / 100);
  const z = zb + ((value - vb) / (vb - va)) * (zb - za);
  return clamp(normCdf(z) * 100);
}
const clamp = p => Math.max(1, Math.min(99, p));

// The value needed to beat share `p` of the group (for "next milestone").
export function valueAt(table, p) {
  const pts = [...table].sort((x, y) => x[0] - y[0]);
  if (p <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [p0, v0] = pts[i - 1], [p1, v1] = pts[i];
    if (p <= p1) return v0 + ((p - p0) / (p1 - p0)) * (v1 - v0);
  }
  return pts.at(-1)[1];
}

// ---------- groups ----------
export const AGE_GROUPS = [['18-29', '18-29'], ['30-39', '30-39'], ['40-49', '40-49'], ['50-59', '50-59'], ['60+', '60+']];
const SEX_WORD = { m: 'men', f: 'women' };

// The most specific table the source has for this athlete: sex + age, then sex, then everyone.
export function tableFor(metric, sex, age, ctx = {}) {
  const m = NORMS[metric];
  if (!m) return null;
  if (m.resolve) return m.resolve(sex, age, ctx);
  const s = sex === 'm' || sex === 'f' ? sex : 'all';
  const pick = (k, a) => m.tables?.[k]?.[a];
  if (age && pick(s, age)) return { table: pick(s, age), who: `${SEX_WORD[s] || 'people'} aged ${age}` };
  if (pick(s, 'all')) return { table: pick(s, 'all'), who: SEX_WORD[s] || 'people' };
  if (pick('all', 'all')) return { table: pick('all', 'all'), who: 'people' };
  return null;
}

// One stat line. Returns null when there is no value or no table.
export function statFor(metric, value, sex, age, ctx = {}) {
  if (!(value > 0)) return null;
  const t = tableFor(metric, sex, age, ctx);
  if (!t) return null;
  const m = NORMS[metric];
  const scale = t.scale || 1; // the table's unit vs ours (lifts: ÷ class limit instead of ÷ bodyweight)
  const table = t.table.map(([p, v]) => [p, v / scale]);
  const group = `${m.group(t.who)}`;
  if (m.median) {
    // Only the middle is published: we can say "faster than half", never more.
    const mid = table[0][1], ahead = value <= mid;
    return { metric, label: m.label, value, p: 50, show: ahead, median: true, group, target: ahead ? null : mid, nextP: ahead ? null : 50, source: m.source, fmt: m.fmt };
  }
  const p = Math.round(percentile(table, value));
  // Below the middle: no percentage, just the next milestone (the middle of the group).
  const target = p < 50 ? valueAt(table, 50) : p < 75 ? valueAt(table, 75) : p < 90 ? valueAt(table, 90) : null;
  const nextP = p < 50 ? 50 : p < 75 ? 75 : p < 90 ? 90 : null;
  return { metric, label: m.label, value, p, show: p >= 50, group, target, nextP, source: m.source, fmt: m.fmt };
}

// Rarity of being good at several sports at once: the best stat of each of the two strongest
// different sports, whatever the percentile (a mid-pack powerlifter is still a strong person) (5K and 10K are one sport; Hyrox is already a combined test, so it is left out).
export function hybridRarity(stats) {
  const bySport = new Map();
  for (const st of stats) {
    const sport = NORMS[st.metric]?.sport;
    if (st.median || !sport || sport === 'hyrox') continue;
    if (!bySport.has(sport) || bySport.get(sport).p < st.p) bySport.set(sport, st);
  }
  const basis = [...bySport.values()].sort((a, b) => b.p - a.p).slice(0, 2);
  if (basis.length < 2) return null;
  const share = jointTop(basis[0].p / 100, basis[1].p / 100, RHO.value);
  const oneIn = Math.round(1 / share);
  return oneIn >= 3 ? { share, oneIn, basis } : null;
}

// "Training like this puts you ahead of most adults": from the athlete's own last 4 weeks.
// (Strength sessions: the hybrid strength lane, or anything lifting in its title.)
export function activityLine(s, now) {
  const since = now - 28 * 86400000;
  const recent = (s.history || []).filter(h => h.kind === 'session' && h.ts >= since);
  if (!recent.length) return null;
  const perWeek = recent.length / 4;
  const strength = recent.some(h => h.track === 'strength' || /squat|deadlift|lift|strength/i.test(h.title || ''));
  const cardio = recent.some(h => h.track !== 'strength');
  if (perWeek >= 2.5 && strength && cardio) return { text: ACTIVITY.both.text, source: ACTIVITY.both.source };
  if (perWeek >= 2.5) return { text: ACTIVITY.aerobic.text, source: ACTIVITY.aerobic.source };
  return { text: ACTIVITY.started.text, source: ACTIVITY.started.source };
}
