// Lane maps (Triathlon, Hybrid): three winding paths climb side by side through themed scenery,
// one node per stage, with animated characters that travel along their path as the athlete progresses.
// Each world ends with a gate (bridge) across all three paths.
import { TRI_WORLDS, SWIM_STAGES, BIKE_STAGES } from './data/tri.js';
import { HYBRID_WORLDS, STRENGTH_STAGES, ENGINE_STAGES } from './data/hybrid.js';
import { RUN_LEVELS } from './data/tracks.js';
import { DECO, G, shadow, RUNNER, rng, addToMap, bubble } from './map.js';
import * as T from './tri.js';
import * as H from './hybrid.js';
import { sexText } from './standards.js';
import { WHY } from './engine.js';
import { fogBands, fogSvg, peekButton, seenFog, saveFog, cropTop, summitText } from './fog.js';

export const TW = 400;
const BAND = 420;
const TOP_PAD = 170; // room above the last gate for the FINISH line
const FINISH_Y = 96;
const LANE_X = [72, 200, 328];
// The map grows with its number of worlds. These are live exports: they follow the map being drawn.
export let TH = 6 * BAND + 220 + TOP_PAD;
let START_Y = TH - 90;
export let START_POINT = { x: TW / 2, y: START_Y };
function geo(cfg) {
  const h = cfg.worlds.length * BAND + 220 + TOP_PAD;
  if (h !== TH) { TH = h; START_Y = TH - 90; START_POINT = { x: TW / 2, y: START_Y }; }
}
const bandBottom = i => TH - 220 - i * BAND;
export const gateY = i => bandBottom(i) - BAND + 78;
// Short labels for the map pills (full text is in the popup).
const SHORT = { 'Bodyweight basics': 'Bodyweight', 'Dumbbell basics': 'Dumbbells', 'Squat 0.75 x bodyweight': 'Squat ¾ BW', 'Squat 1 x bodyweight': 'Squat 1x BW',
  'Carries + lunges': 'Carries', 'Squat 1.25 x bodyweight': 'Squat 1¼ BW', 'Deadlift 1.75 x bodyweight': 'DL 1¾ BW', '20 min cardio': '20 min', '1000 m row': 'Row 1 km',
  '30 min steady mix': '30 min mix', 'Run after stations': 'Run+station', 'Half race simulation': 'Half sim', 'Full simulation': 'Full sim', 'Full sim under goal time': 'Sim < goal',
  'Deadlift 2 x bodyweight': 'DL 2x BW', 'Squat 2 x bodyweight': 'Squat 2x BW', 'Elite-pace simulation': 'Elite sim', 'Championship simulation': 'Champ sim',
  '1500 m + open water': '1500 m + OW' };
const short = t => SHORT[t] || t;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- extra scenery ----------
const MORE = {
  shell: () => `<path d="M-7,0 Q0,-14 7,0Z" fill="#ffccbc" stroke="#e64a19" stroke-width="1"/><path d="M0,-11 V0 M-4,-6 L0,0 M4,-6 L0,0" stroke="#e64a19" stroke-width=".8"/>`,
  boat: () => `<path d="M-14,0 L14,0 L9,6 L-9,6Z" fill="#8d6e63"/><path d="M0,0 V-24 L12,-4Z" fill="#fff" stroke="#90a4ae"/><path d="M0,-22 L-9,-4 H0Z" fill="#ffd54f"/>`,
  palm: () => `${shadow(10)}<path d="M0,0 Q-3,-16 2,-32" stroke="#8d6e63" stroke-width="3.5" fill="none"/><path d="M2,-32 q-14,-2 -18,8 M2,-32 q14,-2 18,8 M2,-32 q-8,-10 -16,-8 M2,-32 q8,-10 16,-8" stroke="#43a047" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  umbrella: () => `${shadow(8)}<line x1="0" y1="0" x2="0" y2="-22" stroke="#6d4c41" stroke-width="2"/><path d="M-14,-20 Q0,-36 14,-20Z" fill="#ef5350"/><path d="M-5,-27 Q0,-34 5,-27" stroke="#fff" stroke-width="3" fill="none"/>`,
  dumbbell: () => `${shadow(10)}<rect x="-9" y="-4" width="18" height="3" rx="1.5" fill="#90a4ae"/><rect x="-13" y="-8" width="5" height="11" rx="1.5" fill="#37474f"/><rect x="8" y="-8" width="5" height="11" rx="1.5" fill="#37474f"/>`,
  kettlebell: () => `${shadow(8)}<circle cx="0" cy="-7" r="7" fill="#263238"/><path d="M-4,-13 Q0,-20 4,-13" stroke="#263238" stroke-width="2.5" fill="none"/><text x="0" y="-5" text-anchor="middle" font-size="5" fill="#fff" font-weight="700">24</text>`,
  plate: () => `${shadow(9)}<circle cx="0" cy="-9" r="9" fill="#37474f"/><circle cx="0" cy="-9" r="6" fill="none" stroke="#546e7a" stroke-width="1.5"/><circle cx="0" cy="-9" r="1.8" fill="#cfd8dc"/>`,
  flagpole: r => `<line x1="0" y1="0" x2="0" y2="-34" stroke="#546e7a" stroke-width="2"/><path d="M0,-34 l14,4 l-14,4Z" fill="${['#ef5350', '#ffca28', '#42a5f5', '#66bb6a'][Math.floor(r() * 4)]}"/>`,
  flame: () => `<path d="M0,0 Q-9,-8 -2,-20 Q-1,-12 4,-14 Q9,-6 0,0Z" fill="#ff7043"/><path d="M0,-2 Q-4,-6 0,-12 Q4,-6 0,-2Z" fill="#ffd54f"/>`,
  trophy: () => `${shadow(8)}<rect x="-6" y="-4" width="12" height="4" fill="#8d6e63"/><path d="M-8,-20 H8 Q8,-8 0,-7 Q-8,-8 -8,-20Z" fill="#ffd23f" stroke="#e09b00"/><rect x="-1.5" y="-7" width="3" height="4" fill="#e09b00"/>`,
};
const deco = (kind, r) => (MORE[kind] || DECO[kind])(r);

// ---------- path styles ----------
const STYLE = {
  swim: { base: '#b3e5fc', bw: 32, prog: '#29b6f6', pw: 22, line: '#ffffff', dash: '4 12' },
  bike: { base: '#b0bec5', bw: 26, prog: '#546e7a', pw: 18, line: '#ffffff', dash: '12 10' },
  run: { base: '#efc6ae', bw: 22, prog: '#e2703a', pw: 16, line: '#ffffff', dash: '10 9' },
  strength: { base: '#90a4ae', bw: 26, prog: '#37474f', pw: 18, line: '#ffd54f', dash: '8 8' },
  engine: { base: '#90caf9', bw: 24, prog: '#1e88e5', pw: 16, line: '#ffffff', dash: '3 9' },
};

// ---------- characters (feet at 0,0) ----------
const TOP = sex => (sex === 'f' ? '#ec407a' : '#ff6b35');
const PONY = (sex, x, y, dir = -1) => (sex === 'f' ? `<path class="pony" d="M${x},${y} q${dir * 9},1 ${dir * 10},10" stroke="#3e2723" stroke-width="4" fill="none" stroke-linecap="round"/>` : '');
// The Engine character's sled: empty at the start, one plate per Engine stage cleared (bumper colours).
export const PLATE_COLORS = ['#43a047', '#fdd835', '#1e88e5', '#e53935'];
const plateColor = i => PLATE_COLORS[i % PLATE_COLORS.length];
const SLED_MAX = 8; // plates shown; more than that adds a "+"
function sled(plates) {
  const n = Math.min(plates, SLED_MAX);
  return `<g class="sled"><path d="M9,-1 L31,-1 Q36,-1 36,-5" stroke="#455a64" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <rect x="10" y="-7" width="22" height="4" rx="1.5" fill="#37474f"/><rect x="11" y="-25" width="3" height="19" rx="1.2" fill="#546e7a"/>
      <rect x="24.5" y="${-10 - n * 3.4}" width="2" height="${4 + n * 3.4}" fill="#78909c"/>
      <g class="plates">${platesSvg(n)}</g>${plates > SLED_MAX ? `<text x="32" y="${-12 - n * 3.4}" font-size="8" font-weight="800" fill="#fff" stroke="#14213d" stroke-width="2" paint-order="stroke">+</text>` : ''}</g>`;
}
const platesSvg = n => Array.from({ length: n }, (_, i) => `<rect x="17" y="${-10.5 - i * 3.4}" width="17" height="3.2" rx="1.4" fill="${plateColor(i)}" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>`).join('');
// A plate lying on the ground (next to an Engine level, waiting to be picked up).
const groundPlate = i => `<ellipse rx="8" ry="3.2" fill="${plateColor(i)}" stroke="rgba(0,0,0,.3)" stroke-width="1"/><ellipse rx="2" ry=".9" fill="rgba(0,0,0,.35)"/>`;

const CHAR = {
  swim: sex => `<g class="ch-swim"><ellipse class="ripple" rx="18" ry="5" fill="rgba(255,255,255,.75)"/><g class="bob">
      <ellipse cx="0" cy="-5" rx="14" ry="4.8" fill="${TOP(sex)}"/>${PONY(sex, 9, -9)}<circle cx="13" cy="-8" r="5.2" fill="#f1c49b"/><path d="M8.5,-11 a5.2,5.2 0 0 1 9.2,0" fill="#ffd23f"/>
      <g class="arm-stroke"><path d="M4,-7 L4,-22" stroke="#f1c49b" stroke-width="3.6" stroke-linecap="round"/></g>
      <g class="kick"><circle cx="-17" cy="-4" r="2.2" fill="#fff"/><circle cx="-20" cy="-7" r="1.6" fill="#fff"/></g></g></g>`,
  bike: sex => `<g class="ch-bike"><ellipse cy="1" rx="19" ry="3.5" fill="rgba(0,0,0,.25)"/><g class="bob"><g class="wheelie">
      <g transform="translate(-11,-7)"><g class="wheel"><circle r="7.5" fill="none" stroke="#263238" stroke-width="2.4"/><path d="M-7,0H7M0,-7V7" stroke="#90a4ae" stroke-width="1.2"/></g></g>
      <g transform="translate(11,-7)"><g class="wheel"><circle r="7.5" fill="none" stroke="#263238" stroke-width="2.4"/><path d="M-7,0H7M0,-7V7" stroke="#90a4ae" stroke-width="1.2"/></g></g>
      <path d="M-11,-7 L-2,-7 L5,-17 L11,-7 M-2,-7 L-5,-18 M5,-17 L8,-21" stroke="#ff6b35" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M-5,-19 L4,-28" stroke="${sex === 'f' ? '#ab47bc' : '#29a0e0'}" stroke-width="5.5" stroke-linecap="round"/><path d="M3,-27 L8,-21" stroke="#f1c49b" stroke-width="3" stroke-linecap="round"/>
      <path d="M-5,-19 L-1,-11 L-2,-7" stroke="#1e2b4d" stroke-width="3.6" fill="none" stroke-linecap="round" class="leg"/>
      ${PONY(sex, 3, -31)}<circle cx="7" cy="-32" r="4.8" fill="#f1c49b"/><path d="M2,-33 a5,5 0 0 1 10,0Z" fill="#e53935"/></g></g></g>`,
  run: sex => `<g class="ch-run">${sex === 'f' ? RUNNER.replace('fill="#ff6b35"', `fill="${TOP(sex)}"`).replace('<circle cx="1" cy="-39"', `${PONY(sex, -4, -42)}<circle cx="1" cy="-39"`) : RUNNER}</g>`,
  strength: sex => `<g class="ch-lift"><ellipse rx="13" ry="3.6" fill="rgba(0,0,0,.28)"/><g class="bob">
      <path d="M-5,0 L-5,-14 M5,0 L5,-14" stroke="#1e2b4d" stroke-width="4.8" stroke-linecap="round"/>
      <rect x="-6.5" y="-31" width="13" height="18" rx="5" fill="${TOP(sex)}"/>${PONY(sex, -5, -40)}<circle cx="0" cy="-37" r="6.3" fill="#f1c49b"/><path d="M-6,-40 a6.3,6.3 0 0 1 12,0" fill="#3e2723"/>
      <g class="press"><path d="M-6,-29 L-10,-44 M6,-29 L10,-44" stroke="#f1c49b" stroke-width="3.6" stroke-linecap="round"/>
        <rect x="-22" y="-46.5" width="44" height="3" rx="1.5" fill="#546e7a"/><rect x="-24" y="-51" width="5" height="12" rx="1.5" fill="#263238"/><rect x="19" y="-51" width="5" height="12" rx="1.5" fill="#263238"/></g></g></g>`,
  engine: (sex, plates = 0) => `<g class="ch-sled"><ellipse cx="6" rx="22" ry="3.6" fill="rgba(0,0,0,.28)"/>
      ${sled(plates)}<g class="bob">
      <g class="lg-d d1"><path d="M-6,-15 L-15,-1" stroke="#1e2b4d" stroke-width="4.6" stroke-linecap="round"/></g>
      <g class="lg-d d2"><path d="M-6,-15 L-1,-1" stroke="#1e2b4d" stroke-width="4.6" stroke-linecap="round"/></g>
      <path d="M-6,-15 L5,-25" stroke="${sex === 'f' ? '#ab47bc' : '#29a0e0'}" stroke-width="9" stroke-linecap="round"/>
      <path d="M5,-25 L12,-21" stroke="#f1c49b" stroke-width="3.4" stroke-linecap="round"/>
      ${PONY(sex, 6, -32)}<circle cx="9.5" cy="-30" r="5.6" fill="#f1c49b"/><rect x="4" y="-34" width="11" height="2.6" rx="1.3" fill="#ff6b35" transform="rotate(20 9.5 -33)"/></g></g>`,
};

// While travelling, characters face where they're going: seen from behind going up the path (from
// above for the swimmer), side-on when the path turns sideways. Standing still, they're side-on as above.
const HAIR = '#3e2723', SKIN = '#f1c49b';
const BACK_PONY = sex => (sex === 'f' ? `<path class="pony" d="M0,-36 q3,6 0,11" stroke="${HAIR}" stroke-width="4" fill="none" stroke-linecap="round"/>` : '');
const walker = (sex, { top, band, wide = 0, arms = true, extra = '' }) => `<g class="ch-back"><ellipse rx="${11 + wide}" ry="3.5" fill="rgba(0,0,0,.28)"/><g class="bob">
      <path class="lg l1" d="M${-3 - wide / 2},-17 L${-3 - wide / 2},-3" stroke="#1e2b4d" stroke-width="${4.5 + wide / 2}" stroke-linecap="round"/>
      <path class="lg l2" d="M${3 + wide / 2},-17 L${3 + wide / 2},-3" stroke="#1e2b4d" stroke-width="${4.5 + wide / 2}" stroke-linecap="round"/>
      ${arms ? `<path class="lg l2" d="M${-6 - wide},-30 L${-9 - wide},-20" stroke="${SKIN}" stroke-width="3.4" stroke-linecap="round"/>
      <path class="lg l1" d="M${6 + wide},-30 L${9 + wide},-20" stroke="${SKIN}" stroke-width="3.4" stroke-linecap="round"/>` : ''}
      <rect x="${-6 - wide}" y="-33" width="${12 + wide * 2}" height="17" rx="5" fill="${top}"/>
      <rect x="${-6 - wide}" y="-20" width="${12 + wide * 2}" height="5" rx="2" fill="#1e2b4d"/>
      <circle cy="-39" r="6.5" fill="${HAIR}"/>${band ? `<rect x="-6.5" y="-42" width="13" height="2.6" rx="1.3" fill="${band}"/>` : ''}${BACK_PONY(sex)}${extra}</g></g>`;
const BACK = {
  swim: sex => `<g class="ch-top" transform="translate(0,-8)"><ellipse class="ripple" rx="12" ry="20" fill="rgba(255,255,255,.55)"/>
      <path d="M-5,14 L0,6 L5,14" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>
      <g class="kick"><circle cx="-2" cy="13" r="2" fill="#fff"/><circle cx="2.5" cy="15" r="1.5" fill="#fff"/></g>
      <ellipse cy="1" rx="4.6" ry="11" fill="${TOP(sex)}"/>
      <path class="arm-a" d="M-4.5,-6 L-6,-19" stroke="${SKIN}" stroke-width="3.2" stroke-linecap="round"/>
      <path class="arm-b" d="M4.5,-6 L6,7" stroke="${SKIN}" stroke-width="3.2" stroke-linecap="round"/>
      <circle cy="-9" r="4.6" fill="#ffd23f"/></g>`,
  bike: sex => `<g class="ch-back"><ellipse rx="9" ry="3" fill="rgba(0,0,0,.28)"/><g class="bob">
      <rect x="-2.3" y="-16" width="4.6" height="16" rx="2.3" fill="#263238"/><rect x="-3.5" y="-20" width="7" height="2.4" rx="1.2" fill="#ff6b35"/>
      <path class="lg l1" d="M-4,-20 L-5,-11" stroke="#1e2b4d" stroke-width="3.6" stroke-linecap="round"/>
      <path class="lg l2" d="M4,-20 L5,-11" stroke="#1e2b4d" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M-6,-27 L-10,-31 M6,-27 L10,-31" stroke="${SKIN}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cy="-25" rx="7" ry="8" fill="${sex === 'f' ? '#ab47bc' : '#29a0e0'}"/>${BACK_PONY(sex).replace('-36', '-31')}
      <circle cy="-33" r="5" fill="#e53935"/><path d="M-3,-35 h6" stroke="#fff" stroke-width="1.2"/></g></g>`,
  run: sex => walker(sex, { top: TOP(sex), band: '#29a0e0' }),
  // Seen from behind: the bar rides on the shoulders (a walking back squat), hands out wide on it.
  strength: sex => walker(sex, { top: TOP(sex), band: null, wide: 1.5, arms: false, extra: `
      <path d="M-7.5,-31 L-13,-33 M7.5,-31 L13,-33" stroke="${SKIN}" stroke-width="3.4" stroke-linecap="round"/>
      <rect x="-24" y="-35" width="48" height="3" rx="1.5" fill="#546e7a"/>
      <rect x="-27" y="-40" width="5" height="13" rx="1.5" fill="#263238"/><rect x="22" y="-40" width="5" height="13" rx="1.5" fill="#263238"/>` }),
  engine: (sex, plates = 0) => `<g class="sled-back"><rect x="-12" y="-47" width="24" height="5" rx="2" fill="#37474f"/><path d="M-7,-42 L-7,-31 M7,-42 L7,-31" stroke="#546e7a" stroke-width="2.4"/>
      ${Array.from({ length: Math.min(plates, SLED_MAX) }, (_, i) => `<rect x="-8" y="${-50 - i * 3}" width="16" height="2.8" rx="1.2" fill="${plateColor(i)}"/>`).join('')}</g>${walker(sex, { top: sex === 'f' ? '#ab47bc' : '#29a0e0', band: '#ff6b35' })}`,
};
// Heading from the direction of travel (dx, dy in map units): which view, and how to turn it.
export function facing(lane, dx, dy) {
  const ang = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = straight up the map, + = to the right
  if (lane === 'swim') return { view: 'up', face: `rotate(${ang.toFixed(1)} 0 -8)` };
  if (Math.abs(ang) <= 55) return { view: 'up', face: `rotate(${(ang * 0.35).toFixed(1)})` };
  return { view: 'side', face: ang < 0 ? 'scale(-1,1)' : '' };
}

// ---------- the two maps ----------
const TRI = {
  id: 'tri', worlds: TRI_WORLDS, lanes: T.LANES, icon: T.LANE_ICON, label: T.LANE_LABEL, gateTrack: 'triGate', gateWord: 'transition gate', openIcon: '🌉',
  bandFill: ['#c5e8b0', '#f7e3b8', '#c2e9fb', '#fff0b8', '#ddcd8c', '#f5bd80'],
  themes: [['pine', 'tent', 'roundTree', 'flowers', 'bush'], ['shell', 'rock', 'flowers', 'bush', 'umbrella'], ['boat', 'rock', 'shell', 'flowers'], ['palm', 'umbrella', 'palm', 'shell', 'rock'], ['hill', 'rock', 'pine', 'roundTree'], ['rock', 'mesaSmall', 'cactus', 'skull']],
  further: 'A world further up the coast.',
  world: s => s.tri.world, finished: s => s.tri.finished, status: T.laneStatus, ready: T.lanesReady, limiter: T.limiter, target: T.laneTarget,
  value: (s, l) => (l === 'swim' ? s.tri.swim.stage : l === 'bike' ? s.tri.bike.stage : s.run.level),
  stage: (s, l) => (l === 'swim' ? T.swimStage(s) : T.bikeStage(s)), max: l => (l === 'swim' ? T.SWIM_MAX : T.BIKE_MAX), current: T.triWorld,
  stageAt: (l, v) => (l === 'swim' ? SWIM_STAGES[v - 1] : l === 'bike' ? BIKE_STAGES[v - 1] : null),
  resting: () => false,
};
const HYB = {
  id: 'hyb', worlds: HYBRID_WORLDS, lanes: H.LANES, icon: H.LANE_ICON, label: H.LANE_LABEL, gateTrack: 'hyGate', gateWord: 'race gate', openIcon: '🏁',
  bandFill: ['#d6dee2', '#e8dccf', '#ffe2b8', '#cfe9d0', '#ffd2c2', '#ffe48f', '#d9d2f5', '#c9e4f7'],
  themes: [['dumbbell', 'kettlebell', 'plate', 'dumbbell'], ['cone', 'lamp', 'kettlebell', 'roundTree'], ['flagpole', 'cone', 'dumbbell', 'flagpole'], ['flagpole', 'lamp', 'roundTree', 'cone'], ['flame', 'kettlebell', 'plate', 'flame'], ['trophy', 'flagpole', 'flame', 'trophy'], ['flame', 'trophy', 'lamp', 'plate'], ['flagpole', 'trophy', 'flagpole', 'flame']],
  further: 'A bigger arena further up.',
  world: s => s.hybrid.world, finished: s => s.hybrid.finished, status: H.laneStatus, ready: H.lanesReady, limiter: H.limiter, target: H.laneTarget,
  value: (s, l) => (l === 'strength' ? s.hybrid.strength.stage : l === 'engine' ? s.hybrid.engine.stage : s.run.level),
  stage: (s, l) => (l === 'strength' ? H.strengthStage(s) : H.engineStage(s)), max: l => (l === 'strength' ? H.STR_MAX : H.ENG_MAX), current: H.hybWorld,
  stageAt: (l, v) => (l === 'strength' ? STRENGTH_STAGES[v - 1] : l === 'engine' ? ENGINE_STAGES[v - 1] : null),
  resting: (s, l) => l !== 'run' && !H.inFocus(s, l),
};
export const MAPS = { tri: TRI, hyb: HYB };

// ---------- geometry ----------
const reqs = (cfg, lane) => cfg.worlds.map(w => w[lane]);
const maxVal = (cfg, lane) => reqs(cfg, lane).at(-1);

// Node for "value v reached" in a lane (v = stages cleared, or the Run level).
export function nodePoint(cfg, lane, v) {
  geo(cfg);
  const li = cfg.lanes.indexOf(lane);
  if (v <= 0) return { x: LANE_X[li], y: START_Y };
  const r = reqs(cfg, lane);
  let i = r.findIndex(x => v <= x);
  if (i < 0) i = r.length - 1;
  const prev = i === 0 ? 0 : r[i - 1];
  const count = Math.max(1, r[i] - prev);
  const k = Math.min(count, v - prev);
  const lo = bandBottom(i) - 70, hi = gateY(i) + 130; // keep clear of the gate bar
  return { x: LANE_X[li] + 26 * Math.sin(v * 1.3 + li * 1.9), y: lo - (k / count) * (lo - hi) };
}

function lanePoints(cfg, lane) {
  const pts = [];
  for (let v = 0; v <= maxVal(cfg, lane); v++) pts.push(nodePoint(cfg, lane, v));
  pts.push({ x: pts.at(-1).x, y: FINISH_Y });
  return pts;
}
function segs(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    out.push(`M${p1.x.toFixed(1)},${p1.y.toFixed(1)} C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
  }
  return out;
}
const join = list => list.map((d, i) => (i ? d.replace(/^M[^C]+/, '') : d)).join(' ');

// ---------- layers ----------
function bands(cfg) {
  return cfg.worlds.map((w, i) => {
    const top = i === cfg.worlds.length - 1 ? 0 : bandBottom(i + 1);
    const edge = `M0,${bandBottom(i)} ${Array.from({ length: 8 }, (_, k) => `Q${k * 50 + 25},${bandBottom(i) + (k % 2 ? 12 : -12)} ${k * 50 + 50},${bandBottom(i)}`).join(' ')}`;
    return `<rect x="0" y="${top}" width="${TW}" height="${bandBottom(i) - top + (i === 0 ? 220 : 0)}" fill="${cfg.bandFill[i]}"/>
      <path d="${edge}" stroke="rgba(0,0,0,.10)" stroke-width="6" fill="none"/>`;
  }).join('');
}

function scenery(cfg, allPts) {
  const r = rng(cfg.id === 'tri' ? 7 : 11);
  const samples = allPts.flatMap(pts => pts.flatMap((p, i) => (i ? [0.25, 0.5, 0.75, 1].map(t => ({ x: pts[i - 1].x + (p.x - pts[i - 1].x) * t, y: pts[i - 1].y + (p.y - pts[i - 1].y) * t })) : [p])));
  const near = (x, y) => samples.some(p => Math.abs(p.x - x) < 32 && Math.abs(p.y - y) < 40);
  const out = [];
  cfg.worlds.forEach((w, i) => {
    const top = gateY(i) + 40, bottom = bandBottom(i) - 10;
    for (let y = top; y < bottom; y += 30) for (let x = 10; x < TW; x += 30) {
      const jx = x + (r() - 0.5) * 18, jy = y + (r() - 0.5) * 16;
      if (r() < 0.55 || near(jx, jy)) continue;
      const theme = cfg.themes[i];
      out.push({ y: jy, svg: G(jx, jy, 0.62 + r() * 0.3, deco(theme[Math.floor(r() * theme.length)], r)) });
    }
  });
  return out.sort((a, b) => a.y - b.y).map(o => o.svg).join('');
}

function pathLayer(s, cfg, lane, pts) {
  const st = STYLE[lane];
  const all = segs(pts);
  const v = Math.min(cfg.value(s, lane), maxVal(cfg, lane));
  const done = all.slice(0, v);
  return `<g class="lane-path">
      <path d="${join(all)}" fill="none" stroke="rgba(0,0,0,.10)" stroke-width="${st.bw + 6}" stroke-linecap="round" transform="translate(0,3)"/>
      <path d="${join(all)}" fill="none" stroke="${st.base}" stroke-width="${st.bw}" stroke-linecap="round"/>
      ${done.length ? `<path d="${join(done)}" fill="none" stroke="${st.prog}" stroke-width="${st.pw}" stroke-linecap="round"/>` : ''}
      <path d="${join(all)}" fill="none" stroke="${st.line}" stroke-width="2" stroke-dasharray="${st.dash}" opacity=".8"/>
      ${all.map((d, i) => `<path id="ln-${cfg.id}-${lane}-${i + 1}" d="${d}" fill="none" stroke="none"/>`).join('')}
    </g>`;
}

function nodes(s, cfg, lane) {
  const v = cfg.value(s, lane), r = reqs(cfg, lane), max = maxVal(cfg, lane);
  const out = [];
  for (let n = 1; n <= max; n++) {
    const p = nodePoint(cfg, lane, n);
    const done = n <= v, current = n === v + 1;
    const isTarget = r.includes(n);
    const label = lane === 'run' ? `L${n}` : sexText(short(cfg.target(lane, n)), s.profile.sex);
    const fill = done ? '#7cb342' : current ? '#ff6b35' : '#bdbdbd';
    const rad = current ? 13 : isTarget ? 12 : 9;
    const pill = isTarget || current;
    const w = Math.max(30, label.length * 3.1 + 10);
    out.push(`<g class="tri-node" data-act="lane-node" data-map="${cfg.id}" data-kind="node" data-lane="${lane}" data-v="${n}" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})" role="button" tabindex="0" aria-label="${cfg.label[lane]} ${esc(label)}">
        <circle r="20" fill="transparent"/>
        ${current ? `<circle class="halo" r="${rad}" fill="none" stroke="#fff" stroke-width="3"/>` : ''}
        <circle r="${rad}" fill="${fill}" stroke="#fff" stroke-width="2.5"/>
        <text y="4" text-anchor="middle" font-size="${done ? 11 : 10}" fill="#fff" font-weight="800" font-family="Inter, sans-serif">${done ? '✓' : lane === 'run' ? n : ''}</text>
        ${pill ? `<rect x="${-w}" y="${rad + 4}" width="${2 * w}" height="17" rx="8.5" fill="${isTarget ? 'rgba(20,33,61,.86)' : 'rgba(255,107,53,.92)'}"/>
          <text y="${rad + 16}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="#fff">${esc(label)}</text>` : ''}
      </g>`);
  }
  return out.join('');
}

// The real races behind a Hybrid gate, the athlete's own race first and highlighted.
export function myRace(s) {
  const a = s.answers || {}, d = `${s.profile?.dream?.text || ''} ${s.profile?.dream?.event || ''}`;
  if (s.hybrid?.race?.event) return s.hybrid.race.event;
  if (a.hx_alphax || /alpha\s*x/i.test(d)) return 'alphax';
  if (a.hx_hyrox || /hyrox/i.test(d)) return 'hyrox';
  return null;
}
function raceBadge(s, w, y) {
  if (!w.races?.length) return '';
  const mine = myRace(s);
  const lead = mine || 'alphax'; // the athlete's own race first; Alpha X leads otherwise
  const list = [...w.races].sort((a, b) => (b[0] === lead) - (a[0] === lead));
  const chip = ([k, label]) => ({ k, label, w: label.length * 6.1 + 26 });
  const chips = list.map(chip), total = chips.reduce((a, c) => a + c.w, 0) + (chips.length - 1) * 6;
  let x = TW / 2 - total / 2;
  return `<g class="race-badge">${chips.map(c => {
    const on = c.k === lead, out = `<g transform="translate(${x.toFixed(1)},${y - 132})">
      <rect width="${c.w.toFixed(1)}" height="24" rx="12" fill="${on ? (c.k === 'alphax' ? '#7b2ff7' : '#ffd23f') : 'rgba(20,33,61,.82)'}" stroke="#fff" stroke-width="2"/>
      <text x="${(c.w / 2).toFixed(1)}" y="16.5" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="11" fill="${on && c.k === 'hyrox' ? '#14213d' : '#fff'}">${c.k === 'alphax' ? '⚡' : '🏁'} ${esc(c.label)}</text></g>`;
    x += c.w + 6; return out;
  }).join('')}</g>`;
}

function gateNode(s, cfg, i) {
  const w = cfg.worlds[i];
  const passed = i < cfg.world(s) || (cfg.finished(s) && i === cfg.world(s));
  const current = i === cfg.world(s) && !cfg.finished(s);
  const open = current && cfg.ready(s) && !s.rebuild?.active; // a ready gate stays shut during Rebuild
  const color = passed ? '#7cb342' : open ? '#ff6b35' : '#8d6e63';
  const dream = s.profile?.dream?.target?.track === (cfg.id === 'tri' ? 'tri' : 'hybrid') && s.profile.dream.target.world === i;
  const y = gateY(i);
  return `<g class="tri-gate ${open ? 'open' : ''}" data-act="lane-node" data-map="${cfg.id}" data-kind="gate" data-world="${i}" role="button" tabindex="0" aria-label="${esc(w.name)} ${cfg.gateWord}">
      <rect x="14" y="${y - 70}" width="8" height="82" rx="3" fill="#6d4c41"/><rect x="${TW - 22}" y="${y - 70}" width="8" height="82" rx="3" fill="#6d4c41"/>
      <rect x="10" y="${y - 10}" width="${TW - 20}" height="20" rx="6" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      ${Array.from({ length: 16 }, (_, k) => `<line x1="${16 + k * 23.5}" y1="${y - 10}" x2="${16 + k * 23.5}" y2="${y + 10}" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>`).join('')}
      <path d="M18,${y - 66} Q${TW / 2},${y - 104} ${TW - 18},${y - 66}" fill="none" stroke="#6d4c41" stroke-width="5"/>
      <rect x="${TW / 2 - 104}" y="${y - 98}" width="208" height="30" rx="15" fill="#fff" stroke="${color}" stroke-width="3"/>
      <text x="${TW / 2}" y="${y - 77}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="17" fill="#14213d">${w.emoji} ${esc(w.name.toUpperCase())}</text>
      ${open ? `<circle class="halo" cx="${TW / 2}" cy="${y}" r="27" fill="none" stroke="#fff" stroke-width="3"/>` : ''}
      <circle cx="${TW / 2}" cy="${y}" r="23" fill="#fff" stroke="${color}" stroke-width="4"/>
      <text x="${TW / 2}" y="${y + 7}" text-anchor="middle" font-size="20">${passed ? '✅' : open ? cfg.openIcon : w.gate.boss ? '🏆' : '🔒'}</text>
      ${raceBadge(s, w, y)}
      ${dream ? `<g transform="translate(${TW / 2 + 44},${y - 24})"><circle r="15" fill="#fff" stroke="#e91e63" stroke-width="2.5"/><text y="6" text-anchor="middle" font-size="16">🎯</text></g>` : ''}
    </g>`;
}

// Plates waiting on the ground beside each Engine level not reached yet (one per stage).
function groundPlates(cfg, shownAt) {
  if (!cfg.lanes.includes('engine')) return '';
  const out = [];
  for (let n = shownAt + 1; n <= maxVal(cfg, 'engine'); n++) {
    const p = nodePoint(cfg, 'engine', n);
    out.push(`<g id="gp-${cfg.id}-${n}" class="ground-plate" transform="translate(${(p.x + 24).toFixed(1)},${(p.y + 8).toFixed(1)})">${groundPlate(n - 1)}</g>`);
  }
  return out.join('');
}

function avatar(s, cfg, lane, at) {
  const p = nodePoint(cfg, lane, Math.min(at, maxVal(cfg, lane)));
  const lim = cfg.limiter(s)?.lane === lane;
  const rest = cfg.resting(s, lane);
  return `<g id="ln-av-${cfg.id}-${lane}" class="lane-ch ${lim ? 'limiter' : ''} ${rest ? 'resting' : ''}" data-act="lane-node" data-map="${cfg.id}" data-kind="lane" data-lane="${lane}" transform="translate(${p.x.toFixed(1)},${(p.y - 6).toFixed(1)}) scale(1.25)">
      ${lim ? '<circle class="halo lim" cy="-18" r="26" fill="none" stroke="#e53935" stroke-width="2.5"/>' : ''}
      <g class="face"><g class="v-side">${CHAR[lane](s.profile.sex, at)}</g><g class="v-back">${BACK[lane](s.profile.sex, at)}</g></g>
      ${rest ? '<g transform="translate(14,-48)"><circle r="8" fill="#fff" stroke="#90a4ae"/><text y="4" text-anchor="middle" font-size="9">🔒</text></g>' : ''}
    </g>`;
}

// ---------- fog of war ----------
const bandTop = (cfg, i) => (i >= cfg.worlds.length - 1 ? 0 : bandBottom(i + 1));
const bandOf = (cfg, lane, v) => { if (v <= 0) return 0; const i = reqs(cfg, lane).findIndex(x => v <= x); return i < 0 ? cfg.worlds.length - 1 : i; };
// `pos`: where each character is shown (during an animation the fog lifts as they climb).
export function laneFog(s, cfg, pos = {}, reached = 0) {
  const at = l => pos[l] ?? cfg.value(s, l);
  const pending = cfg.lanes.some(l => at(l) < cfg.value(s, l));
  const frontier = Math.max(pending ? 0 : cfg.world(s), reached, ...cfg.lanes.map(l => bandOf(cfg, l, at(l))));
  return { frontier, ...fogBands(cfg.worlds.length, frontier) };
}
// The world band at map height y (for lifting the fog while a character is still walking).
export function bandAtY(id, y) {
  const cfg = MAPS[id];
  geo(cfg);
  for (let i = cfg.worlds.length - 1; i >= 0; i--) if (y <= bandBottom(i)) return i;
  return 0;
}
export function laneFogParts(s, ui, id, shown = {}, reached = 0) {
  const cfg = MAPS[id];
  geo(cfg);
  const f = laneFog(s, cfg, shown, reached);
  const cloudBottom = f.cloud != null ? bandBottom(f.cloud) : null;
  const d = s.profile?.dream?.target;
  const dw = d?.track === (cfg.id === 'tri' ? 'tri' : 'hybrid') ? d.world : null;
  const summitLabel = summitText(s.profile?.dream, cfg.id === 'tri' ? 'tri' : 'hybrid', dw != null && f.cloud != null && dw >= f.cloud);
  // Clouds that were there last time roll back once.
  const was = seenFog(cfg.id);
  let reveal = null, revealDim = null;
  if (was != null && was < f.clear) {
    const old = was + 2 < cfg.worlds.length ? bandBottom(was + 2) : null;
    if (old != null) reveal = { from: cloudBottom ?? 0, to: old };
    if (was + 1 < cfg.worlds.length) revealDim = { from: bandTop(cfg, was + 1), to: bandBottom(was + 1) };
  }
  if (was !== f.clear) saveFog(cfg.id, f.clear);
  if (reveal) ui.fogRevealed = cfg.id;
  return {
    svg: fogSvg({ W: TW, dimTop: f.dim != null ? bandTop(cfg, f.dim) : null, dimBottom: f.dim != null ? bandBottom(f.dim) : null, cloudBottom, hint: 'Keep climbing to clear the clouds', summitLabel, top: cropTop(cloudBottom), reveal, revealDim }),
    crop: cropTop(cloudBottom),
    clear: f.clear, edgeY: f.dim != null ? bandBottom(f.dim) : null, // where the fog starts
    peek: f.dim != null ? peekButton(cloudBottom ?? bandBottom(f.dim), TH) : '',
  };
}

// `ui.laneShown` lets the app draw avatars at their last-seen spot, then animate to the new one.
export function renderLaneMap(s, ui, id) {
  const cfg = MAPS[id];
  geo(cfg);
  const pts = Object.fromEntries(cfg.lanes.map(l => [l, lanePoints(cfg, l)]));
  const shown = ui.laneShown?.[id] || {};
  const popup = ui.lanePopup?.map === id ? popupHtml(s, cfg, ui.lanePopup) : '';
  const lim = cfg.limiter(s)?.lane;
  const fog = laneFogParts(s, ui, id, shown);
  const hud = `<div class="map-hud lane-hud">${cfg.lanes.map(l => {
    const v = cfg.value(s, l);
    const txt = l === 'run' ? `L${v}` : v >= cfg.max(l) ? 'done' : `Next: ${sexText(short(cfg.stage(s, l).target), s.profile.sex)}`;
    return `<button class="lane-chip ${lim === l ? 'lim' : ''}" data-act="lane-focus" data-map="${id}" data-lane="${l}"><span>${cfg.icon[l]}</span>${esc(txt)}</button>`;
  }).join('')}</div>`;
  return `<div class="worldmap trimap" style="background:${cfg.bandFill[0]}">
      ${hud}
      <div class="map-canvas" style="aspect-ratio:${TW}/${TH};margin-top:-${((fog.crop / TW) * 100).toFixed(3)}%">
      <svg viewBox="0 0 ${TW} ${TH}" xmlns="http://www.w3.org/2000/svg" data-act="lane-bg">
        ${bands(cfg)}
        ${scenery(cfg, Object.values(pts))}
        ${cfg.lanes.map(l => pathLayer(s, cfg, l, pts[l])).join('')}
        <g><rect x="20" y="${START_Y - 7}" width="${TW - 40}" height="14" fill="url(#lane-checker)"/>
          <defs><pattern id="lane-checker" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#222"/><rect x="4" y="4" width="4" height="4" fill="#222"/></pattern></defs>
          <text x="${TW / 2}" y="${START_Y + 40}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="20" fill="#14213d">START</text></g>
        <g><rect x="20" y="${FINISH_Y - 7}" width="${TW - 40}" height="14" fill="url(#lane-checker)"/>
          <rect x="${TW / 2 - 70}" y="${FINISH_Y - 62}" width="140" height="36" rx="18" fill="#14213d"/>
          <text x="${TW / 2}" y="${FINISH_Y - 37}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="21" fill="#fff">🏁 FINISH</text></g>
        ${cfg.worlds.map((_, i) => gateNode(s, cfg, i)).join('')}
        ${cfg.lanes.map(l => nodes(s, cfg, l)).join('')}
        ${groundPlates(cfg, shown.engine ?? cfg.value(s, 'engine'))}
        ${fog.svg}
        ${cfg.lanes.map(l => avatar(s, cfg, l, shown[l] ?? cfg.value(s, l))).join('')}
      </svg>
      ${fog.peek}
      ${popup}
      </div>
    </div>`;
}

// Animate one lane's character from value `from` to `to` along its path.
// gate(y) -> ms: pause there (e.g. at the fog's edge while the clouds clear), 0 to keep going.
export function moveCharacter(id, lane, from, to, { onDone, follow, skip, gate, onNode } = {}) {
  const el = document.getElementById(`ln-av-${id}-${lane}`);
  if (!el || to <= from) { onDone?.(); return; }
  const segEls = [];
  for (let v = from + 1; v <= to; v++) { const p = document.getElementById(`ln-${id}-${lane}-${v}`); if (p) segEls.push(p); }
  if (!segEls.length) { onDone?.(); return; }
  const lens = segEls.map(p => p.getTotalLength()), total = lens.reduce((a, b) => a + b, 0);
  const dur = Math.min(12000, 600 + segEls.length * 800); // about 0.8 s per node
  el.classList.add('moving');
  const face = el.querySelector('.face');
  let hx = 0, hy = -1; // start heading up the map
  let t0 = performance.now(), holdUntil = 0, lastNode = from, finished = false;
  // onNode(v) -> ms: something happens at each level passed (the sled picks up a plate); the walk waits.
  const hold = (t, ms) => { holdUntil = t + ms; t0 += ms; el.classList.remove('moving'); };
  const frame = t => {
    if (t < holdUntil && !skip?.()) { requestAnimationFrame(frame); return; }
    if (holdUntil) { el.classList.add('moving'); holdUntil = 0; }
    const k = skip?.() ? 1 : Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    let d = e * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
    const pt = segEls[i].getPointAtLength(d);
    el.setAttribute('transform', `translate(${pt.x.toFixed(1)},${(pt.y - 6).toFixed(1)}) scale(1.25)`);
    // Face the way we're going (a few units ahead on the path), smoothed so turns don't flicker.
    const ahead = segEls[i].getPointAtLength(Math.min(lens[i], d + 6));
    const dx = ahead.x - pt.x, dy = ahead.y - pt.y;
    if (Math.hypot(dx, dy) > 0.5) {
      hx = hx * 0.8 + dx * 0.2; hy = hy * 0.8 + dy * 0.2;
      const f = facing(lane, hx, hy);
      el.classList.toggle('up', f.view === 'up');
      face?.setAttribute('transform', f.face);
    }
    follow?.(pt.y);
    if (k < 1 && !skip?.()) {
      const node = from + i; // levels fully passed so far
      if (node > lastNode) { lastNode = node; const ms = onNode?.(node, pt) || 0; if (ms) hold(t, ms); }
      const g = gate?.(pt.y) || 0;
      if (g) hold(t, g);
    }
    if (k >= 1 && !finished && !skip?.()) {
      finished = true; lastNode = to;
      const ms = onNode?.(to, pt) || 0;
      if (ms) { hold(t, ms); requestAnimationFrame(frame); return; }
    }
    if (k < 1) requestAnimationFrame(frame);
    else { el.classList.remove('moving', 'up'); face?.removeAttribute('transform'); onDone?.(pt); } // side-on again on arrival
  };
  requestAnimationFrame(frame);
}

// Plate count on the Engine sled (both views), during the climb.
export function setPlates(id, n, sex) {
  const el = document.getElementById(`ln-av-${id}-engine`);
  if (!el) return;
  const side = el.querySelector('.v-side'), back = el.querySelector('.v-back');
  if (side) side.innerHTML = CHAR.engine(sex, n);
  if (back) back.innerHTML = BACK.engine(sex, n);
}

export const celebrate = (x, y, text) => bubble(x, y, text, { ttl: 2600 });
const BURST = { swim: '💦', bike: '💨', run: '✨', strength: '💪', engine: '🔥' };
// Each character's signature move on arrival + a little emoji burst.
export function signature(id, lane) {
  const el = document.getElementById(`ln-av-${id}-${lane}`);
  if (!el) return;
  el.classList.add('celebrate');
  setTimeout(() => el.classList.remove('celebrate'), 1900);
  const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(el.getAttribute('transform') || '');
  if (!m) return;
  const x = +m[1], y = +m[2];
  for (let i = 0; i < 6; i++) {
    const dx = (i - 2.5) * 12, delay = i * 70;
    setTimeout(() => addToMap(`<text class="burst-emoji" x="${x + dx}" y="${y - 30}" text-anchor="middle" font-size="16">${BURST[lane] || '✨'}</text>`, 1300), delay);
  }
}
export const valueOf = (s, id, lane) => MAPS[id].value(s, lane);
export const worldOf = (s, id) => MAPS[id].world(s);

function popupHtml(s, cfg, p) {
  const cur = cfg.current(s);
  let html, x, y;
  if (p.kind === 'gate') {
    const i = +p.world, w = cfg.worlds[i];
    const st = cfg.status(s, i);
    const current = i === cfg.world(s) && !cfg.finished(s);
    const rb = s.rebuild?.active, open = current && cfg.ready(s) && !rb;
    x = TW / 2; y = gateY(i);
    html = `<p class="eyebrow">${w.emoji} ${esc(w.name)} · ${cfg.gateWord}</p><h3>${esc(w.race)}</h3>
      <ul class="lane-check">${st.map(l => `<li>${l.ok ? '✅' : '⬜'} ${cfg.icon[l.lane]} ${cfg.label[l.lane]}: ${esc(sexText(cfg.target(l.lane, l.need), s.profile.sex))}</li>`).join('')}</ul>
      ${i < cfg.world(s) || (cfg.finished(s) && i === cfg.world(s)) ? '<p class="hint">Cleared ✅</p>' : open ? `<button class="btn primary small" data-act="open-step" data-track="${cfg.gateTrack}" data-idx="0">Start the ${cfg.gateWord}</button>`
        : current && rb ? `<p class="hint">🔒 ${esc(s.rebuild.redFlag ? WHY.redFlag : WHY.rebuild)}</p><button class="btn primary small" data-act="${s.rebuild.redFlag ? 'cleared' : 'painfree'}">${s.rebuild.redFlag ? "I've been cleared" : "I'm pain-free now"}</button>`
        : current ? '<p class="hint">Opens when all three lanes reach their flags.</p>' : `<p class="hint">🔒 ${cfg.further}</p>`}`;
  } else if (p.kind === 'node' && +p.v !== cfg.value(s, p.lane) + 1) {
    const lane = p.lane, v = +p.v, pt = nodePoint(cfg, lane, v);
    x = pt.x; y = pt.y;
    const done = v <= cfg.value(s, lane);
    const name = lane === 'run' ? `Level ${v} · ${RUN_LEVELS[v - 1]?.name}` : `${cfg.stageAt(lane, v)?.name} · ${sexText(cfg.stageAt(lane, v)?.target, s.profile.sex)}`;
    html = `<p class="eyebrow">${cfg.icon[lane]} ${cfg.label[lane]}</p><h3>${esc(name)}</h3><p class="hint">${done ? 'Cleared ✅' : '🔒 Coming up on this path'}</p>`;
  } else {
    const lane = p.lane, v = cfg.value(s, lane), pt = nodePoint(cfg, lane, Math.min(v + 1, maxVal(cfg, lane)));
    x = pt.x; y = pt.y;
    const need = cur[lane];
    if (lane === 'run') {
      const lvl = RUN_LEVELS[s.run.level - 1];
      html = `<p class="eyebrow">🏃 Run · shared with the Run map</p><h3>Level ${lvl.n} · ${esc(lvl.name)}</h3>
        <p class="hint">${s.run.level >= need ? `Ready for ${esc(cur.name)} ✅` : `${esc(cur.name)} needs Run Level ${need}. Clear it on the Run map and this runner moves too.`}</p>
        <button class="btn primary small" data-act="goto-run-map">Go to Run map</button>`;
    } else {
      const stage = cfg.stage(s, lane), max = cfg.max(lane);
      const rest = cfg.resting(s, lane);
      const prevStage = cfg.stageAt(lane, v);
      const why = lane === 'strength' && s.answers ? H.readLifts(s.answers, s.profile.sex) : null;
      const read = why?.level ? `<p class="hint">📏 Placed from your answers: ${[why.sqRatio ? `squat ${why.sqRatio.toFixed(2)}× bodyweight` : '', why.dlRatio ? `deadlift ${why.dlRatio.toFixed(2)}×` : ''].filter(Boolean).join(', ')} (5-rep weights, bodyweight ${Math.round(why.bwKg)} kg). Wrong? Tell the coach your real numbers.</p>` : '';
      html = `<p class="eyebrow">${cfg.icon[lane]} ${cfg.label[lane]}</p><h3>${v >= max ? 'Path complete' : `Working on: ${esc(stage.name)} · ${esc(sexText(stage.target, s.profile.sex))}`}</h3>
        ${prevStage ? `<p class="hint">✓ Cleared: ${esc(prevStage.name)} (${esc(sexText(prevStage.target, s.profile.sex))})</p>` : ''}${read}
        <p class="hint">${v >= need ? `Ready for ${esc(cur.name)} ✅` : `${esc(cur.name)} needs ${esc(sexText(cfg.target(lane, need), s.profile.sex))}.`}</p>
        ${s.rebuild?.redFlag ? `<p class="hint">🔒 ${esc(WHY.redFlag)}</p><button class="btn primary small" data-act="cleared">I've been cleared</button>` : rest ? `<p class="hint">🔒 Maintaining this block: it builds again in a ${esc(cfg.label[lane])} block.</p>` : v < max ? `<button class="btn primary small" data-act="lane-step" data-lane="${lane}">Next ${esc(cfg.label[lane].toLowerCase())} session</button>` : ''}`;
    }
  }
  const below = y < 380;
  return `<div class="map-pop ${below ? 'below' : ''}" style="left:${(Math.min(320, Math.max(80, x)) / TW) * 100}%;top:${(y / TH) * 100}%">${html}</div>`;
}

export { addToMap };

// The Hybrid lifter, for the Gym map: side view, and seen from behind when walking up the map.
export const liftFigure = sex => `<g class="face"><g class="v-side">${CHAR.strength(sex)}</g><g class="v-back">${BACK.strength(sex)}</g></g>`;
