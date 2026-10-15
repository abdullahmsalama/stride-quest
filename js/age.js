// Age modes. Under 13: Family mode (play missions, with a grown-up). 13-17: Teen mode (the normal plan,
// with guard rails: no max-weight lifting gates, race distance limits, food as portions, never a deficit).
export const ageOf = s => (s.profile?.birthYear ? new Date().getFullYear() - s.profile.birthYear : s.profile?.age ?? null);
export const isKid = s => !!s.profile?.kid || (ageOf(s) != null && ageOf(s) < 13);
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
