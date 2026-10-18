// Age modes. Under 13: Family mode (play missions, with a grown-up). 13-17: Teen mode (the normal plan,
// with guard rails: no max-weight lifting gates, race distance limits, food as portions, never a deficit).
// Age from the birth date (it goes up on the birthday itself); older saves only have a birth year.
export function ageFromDate(ymd, now = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!m) return null;
  const d = new Date(now), y = d.getFullYear() - +m[1];
  const before = d.getMonth() + 1 < +m[2] || (d.getMonth() + 1 === +m[2] && d.getDate() < +m[3]);
  return y - (before ? 1 : 0);
}
export const ageOf = s => (s.profile?.birthDate ? ageFromDate(s.profile.birthDate) : s.profile?.birthYear ? new Date().getFullYear() - s.profile.birthYear : s.profile?.age ?? null);
// With a birth date the age decides (a child moves on to Teen mode at 13); else the Family mode flag.
export const isKid = s => (s.profile?.birthDate ? ageOf(s) < 13 : !!s.profile?.kid || (ageOf(s) != null && ageOf(s) < 13));
export const isTeen = s => { const a = ageOf(s); return a != null && a >= 13 && a < 18; };
// Highest Run level for teens (10K under 16, half marathon at 16-17): most races set these limits.
export const runCap = s => { const a = ageOf(s); return a == null || a >= 18 ? null : a < 16 ? 8 : 10; };
// Strength: teens build technique and reps; heavy stages (and their max-weight gates) wait until 18.
export const strengthCap = s => (isTeen(s) ? 4 : null);
// Races a teen can't enter yet, with the usual minimum age.
export function raceAgeBlock(s, distance) {
  const a = ageOf(s);
  if (a == null || a >= 18) return null;
  const need = { marathon: 18, full: 18, '70.3': 18, half: 16 }[distance];
  return need && a < need ? need : null;
}
export const ageGroupOf = a => (a == null || a < 18 ? null : a < 30 ? '18-29' : a < 40 ? '30-39' : a < 50 ? '40-49' : a < 60 ? '50-59' : '60+');
// Age group for Stats: from the birthday when known (it moves up by itself), else what they picked.
export const ageGroupNow = s => (s.profile?.birthDate ? ageGroupOf(ageOf(s)) : s.profile?.ageGroup || null);
