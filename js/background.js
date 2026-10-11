// Former athletes: skills stay for life, fitness fades. Their technique stages are credited, and a
// comeback fast-track opens gates early until they are back near the level their background suggests.

export const SPORTS = [
  ['running', '🏃 Running / athletics'], ['swimming', '🏊 Swimming'], ['cycling', '🚴 Cycling'], ['triathlon', '🏊🚴🏃 Triathlon'],
  ['strength', '🏋️ Powerlifting / weightlifting / bodybuilding'], ['crossfit', '🔥 CrossFit / hybrid racing'], ['rowing', '🚣 Rowing'], ['team', '⚽ Team sport'],
];
export const LEVELS = [['rec', 'Recreational'], ['club', 'Club'], ['comp', 'Competitive'], ['subelite', 'Sub-elite'], ['elite', 'Elite / pro']];
export const YEARS = [['1', '1-2 years'], ['3', '3-5 years'], ['6', '6-10 years'], ['10', 'More than 10']];
export const SINCE = [['now', 'Still training'], ['lt1', 'Under a year ago'], ['1to3', '1-3 years ago'], ['3to10', '3-10 years ago'], ['10plus', 'More than 10 years ago']];

const RANK = { rec: 1, club: 2, comp: 3, subelite: 4, elite: 5 };
const LANES_OF = { running: ['run'], swimming: ['swim'], cycling: ['bike'], triathlon: ['swim', 'bike', 'run'], strength: ['strength'], crossfit: ['strength', 'engine'], rowing: ['engine'], team: ['run'] };

// Technique that stays (stages cleared, whatever the time away) and the fast-track ceiling, per lane and level.
const SKILL = {
  swim: { rec: 1, club: 2, comp: 3, subelite: 3, elite: 3 },     // water comfort / freestyle / breathing
  bike: { rec: 1, club: 2, comp: 3, subelite: 3, elite: 3 },     // ride ready / hour / mount + clip-in
  strength: { rec: 1, club: 2, comp: 3, subelite: 3, elite: 3 }, // movement / dumbbells / barbell basics
  engine: { rec: 1, club: 1, comp: 2, subelite: 2, elite: 2 },   // aerobic start / erg technique
  run: {},
};
const CEILING = {
  swim: { rec: 3, club: 5, comp: 6, subelite: 7, elite: 8 },
  bike: { rec: 3, club: 4, comp: 5, subelite: 6, elite: 7 },
  strength: { rec: 3, club: 4, comp: 5, subelite: 6, elite: 7 },
  engine: { rec: 3, club: 4, comp: 5, subelite: 6, elite: 7 },
  run: { rec: 5, club: 8, comp: 10, subelite: 11, elite: 12 },
};

// The strongest background entry that touches a lane (team sports only count for running, at most club level).
export function bestFor(background = [], lane) {
  let best = null;
  for (const b of background) {
    if (!(LANES_OF[b.sport] || []).includes(lane) || !RANK[b.level]) continue;
    const level = b.sport === 'team' ? (RANK[b.level] >= 2 ? 'club' : 'rec') : b.level;
    const score = RANK[level] * 10 + (+b.years || 0);
    if (!best || score > best.score) best = { ...b, level, score };
  }
  return best;
}

export const skillFloor = (background, lane) => { const b = bestFor(background, lane); return b ? SKILL[lane][b.level] || 0 : 0; };
export const ceiling = (background, lane) => { const b = bestFor(background, lane); return b && (+b.years || 0) >= 3 ? CEILING[lane][b.level] || 0 : b ? Math.max(0, (CEILING[lane][b.level] || 0) - 1) : 0; };

// Fast-track while a former athlete is still below the level their background suggests.
export function fast(s, lane) {
  const bg = s.background || [];
  const b = bestFor(bg, lane);
  if (!b || b.since === 'now') return false;
  const have = lane === 'run' ? s.run.level : lane === 'swim' || lane === 'bike' ? s.tri?.[lane]?.stage : s.hybrid?.[lane]?.stage;
  return have != null && have < ceiling(bg, lane);
}

export const isFormerAthlete = s => (s.background || []).some(b => RANK[b.level] >= 2 && b.since !== 'now');

export function describe(background = []) {
  return background.filter(b => RANK[b.level]).map(b => {
    const sport = SPORTS.find(([k]) => k === b.sport)?.[1].replace(/^\S+\s/, '') || b.sport;
    const lvl = LEVELS.find(([k]) => k === b.level)?.[1];
    const since = SINCE.find(([k]) => k === b.since)?.[1].toLowerCase();
    const yrs = { 1: '1-2 years', 3: '3-5 years', 6: '6-10 years', 10: '10+ years' }[b.years] || '';
    return `${lvl} ${sport.toLowerCase()} · ${yrs}${yrs ? ' · ' : ''}${b.since === 'now' ? 'still training' : `stopped ${since}`}`;
  });
}
