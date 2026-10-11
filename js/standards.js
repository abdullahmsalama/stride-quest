// Men's and women's expectations, in one place. "Prefer not to say" uses the women's (more forgiving)
// standards. All values are approximate starting points, meant to be tuned.

export const SEX_LABEL = { m: "Men's", f: "Women's", x: 'Prefer not to say' };
const isW = sex => sex === 'f' || sex === 'x';

export const timeFactor = sex => (isW(sex) ? 1.1 : 1);   // run, tri, Alpha X times
export const rowFactor = sex => (isW(sex) ? 1.12 : 1);   // 1000 m row
export const liftFactor = sex => (isW(sex) ? 0.75 : 1);  // bodyweight multiples

const round05 = n => Math.round(n * 20) / 20;

// Rewrites standards in text for the athlete: "{min:30}" -> "33 min" (women), "1.25 x bodyweight" -> "0.95 x bodyweight".
export function sexText(text, sex) {
  if (!text) return text;
  let t = String(text).replace(/\{min:(\d+(?:\.\d+)?)\}/g, (_, m) => `${Math.round(+m * timeFactor(sex))} min`);
  if (!isW(sex)) return t;
  return t.replace(/(\d*\.?\d+)(\s?)x(\s?)(bodyweight|BW)/g, (_, n, a, b, unit) => `${round05(+n * liftFactor(sex))}${a}x${b}${unit}`);
}

// ---------- race time standards (minutes) ----------
// Hyrox: from large result datasets; Pro is harder than Open for the same athlete, so its bar is slower.
const HYROX = {
  open: { m: { solid: 88, fast: 75 }, f: { solid: 96, fast: 85 } },
  pro: { m: { solid: 98, fast: 85 }, f: { solid: 106, fast: 95 } },
};
// Alpha X: Open from the athlete community (solid 1:30, fast 1:15), Base 1:00 / 0:50; women about 10% more.
const ALPHAX = { open: { solid: 90, fast: 75 }, base: { solid: 60, fast: 50 } };
// Triathlon: age-group style tiers; official cut-offs for 70.3 and full distance.
const TRI = {
  supersprint: { solid: 60, fast: 45 },
  sprint: { solid: 90, fast: 75 },
  olympic: { solid: 180, fast: 150 },
  half: { solid: 360, fast: 300, cutoff: 510 },
  full: { solid: 750, fast: 630, cutoff: 1020 },
};
export const TRI_WORLD_RACE = ['mini', 'supersprint', 'sprint', 'olympic', 'half', 'full'];

export function raceStandard(event, division, sex) {
  const s = isW(sex) ? 'f' : 'm';
  if (event === 'hyrox') return HYROX[division === 'pro' ? 'pro' : 'open'][s];
  if (event === 'alphax') { const b = ALPHAX[division === 'base' ? 'base' : 'open']; return { solid: Math.round(b.solid * timeFactor(sex)), fast: Math.round(b.fast * timeFactor(sex)) }; }
  if (TRI[event]) { const b = TRI[event]; return { solid: Math.round(b.solid * timeFactor(sex)), fast: Math.round(b.fast * timeFactor(sex)), cutoff: b.cutoff }; }
  return null;
}

// 'fast' | 'solid' | 'finish' | 'slow' (slow = far beyond solid, or past a cut-off).
export function raceTier(minutes, std) {
  if (!std || !(minutes > 0)) return 'finish';
  if (std.cutoff && minutes > std.cutoff) return 'slow';
  if (minutes <= std.fast) return 'fast';
  if (minutes <= std.solid) return 'solid';
  return minutes > std.solid * 1.35 ? 'slow' : 'finish';
}
export const TIER_STARS = { fast: 3, solid: 2, finish: 1, slow: 1 };
export const TIER_LABEL = { fast: 'Fast', solid: 'Solid', finish: 'Finisher', slow: 'Finisher' };
