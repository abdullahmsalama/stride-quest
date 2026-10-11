// Illustrated world map: a winding running track from Base Camp (bottom) up to Ultra Frontier (top),
// scenery per world, a flag per level and a runner avatar that jogs between levels.
import { RUN_LEVELS, WORLDS } from './data/tracks.js';

export const W = 400;
const STEP = 195;
export const H = 170 + (RUN_LEVELS.length - 1) * STEP + 260;
const X = [200, 115, 280, 125, 285, 115, 275, 120, 285, 120, 280, 125, 275, 200];

// Point 0 is the start line; point n is level n.
export const POINTS = X.map((x, i) => ({ x, y: i === 0 ? H - 55 : H - 170 - (i - 1) * STEP }));

// Catmull-Rom through the points -> one cubic bezier per segment (i -> i+1).
function segments() {
  const p = POINTS, out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    out.push({ p1, c1, c2, p2, d: `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}` });
  }
  return out;
}
const SEGS = segments();
const bez = (s, t) => {
  const u = 1 - t;
  return {
    x: u * u * u * s.p1.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p2.x,
    y: u * u * u * s.p1.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p2.y,
  };
};
const SAMPLES = SEGS.flatMap(s => Array.from({ length: 24 }, (_, i) => bez(s, i / 23)));
const distToPath = (x, y) => Math.min(...SAMPLES.map(p => Math.hypot(p.x - x, p.y - y)));
const fullPath = 'M' + POINTS[0].x + ',' + POINTS[0].y + SEGS.map(s => ` C${s.c1.x},${s.c1.y} ${s.c2.x},${s.c2.y} ${s.p2.x},${s.p2.y}`).join('');
const pathTo = n => 'M' + POINTS[0].x + ',' + POINTS[0].y + SEGS.slice(0, n).map(s => ` C${s.c1.x},${s.c1.y} ${s.c2.x},${s.c2.y} ${s.p2.x},${s.p2.y}`).join('');

// ---------- world bands ----------
const WORLD_STYLE = {
  base: { ground: '#9ccc65', deep: '#7cb342', deco: ['pine', 'pine', 'roundTree', 'bush', 'flowers', 'tent'] },
  '5k': { ground: '#b5d97a', deep: '#8fbf4f', deco: ['roundTree', 'bush', 'flowers', 'cone', 'roundTree'] },
  '10k': { ground: '#c9d3cf', deep: '#a9b8b2', deco: ['building', 'building', 'roundTree', 'cone', 'lamp'] },
  half: { ground: '#d8c983', deep: '#bfae62', deco: ['hill', 'rock', 'roundTree', 'bush', 'pine'] },
  full: { ground: '#b8c7cf', deep: '#94a8b3', deco: ['pine', 'rock', 'snowPine', 'rock'] },
  ultra: { ground: '#f2b36d', deep: '#e3964b', deco: ['cactus', 'rock', 'cactus', 'skull', 'mesaSmall'] },
};

function bands() {
  return WORLDS.map(w => {
    const ns = RUN_LEVELS.filter(l => l.world === w.id).map(l => l.n);
    const lo = Math.min(...ns), hi = Math.max(...ns);
    const bottom = lo === 1 ? H : (POINTS[lo].y + POINTS[lo - 1].y) / 2;
    const top = hi === RUN_LEVELS.length ? 0 : (POINTS[hi].y + POINTS[hi + 1].y) / 2;
    return { w, top, bottom };
  });
}

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------- scenery pieces (origin = ground point) ----------
const shadow = (rx = 12) => `<ellipse cx="0" cy="1" rx="${rx}" ry="${rx / 3}" fill="rgba(0,0,0,.14)"/>`;
const G = (x, y, s, body) => `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s.toFixed(2)})">${body}</g>`;
const DECO = {
  pine: (r) => shadow(12) + `<rect x="-2.5" y="-8" width="5" height="9" fill="#6d4c41"/><path d="M0,-30 L17,-6 L-17,-6Z" fill="#2e7d32"/><path d="M0,-44 L13,-20 L-13,-20Z" fill="#388e3c"/>`,
  snowPine: () => shadow(12) + `<rect x="-2.5" y="-8" width="5" height="9" fill="#5d4037"/><path d="M0,-30 L17,-6 L-17,-6Z" fill="#2e6b4f"/><path d="M0,-44 L13,-20 L-13,-20Z" fill="#35795a"/><path d="M0,-44 L6,-33 L-6,-33Z" fill="#fff"/>`,
  roundTree: (r) => shadow(12) + `<rect x="-2.5" y="-12" width="5" height="13" fill="#795548"/><circle cx="0" cy="-22" r="13" fill="${r() > .5 ? '#43a047' : '#558b2f'}"/><circle cx="-5" cy="-26" r="5" fill="rgba(255,255,255,.18)"/>`,
  bush: () => shadow(13) + `<circle cx="-7" cy="-6" r="8" fill="#558b2f"/><circle cx="6" cy="-6" r="9" fill="#689f38"/><circle cx="0" cy="-11" r="8" fill="#7cb342"/>`,
  flowers: (r) => [0, 1, 2, 3].map(i => `<circle cx="${(i * 7 - 10)}" cy="${(i % 2) * -4}" r="2.6" fill="${['#ff8a65', '#fff176', '#f48fb1', '#ffffff'][i]}"/>`).join(''),
  tent: (r) => shadow(18) + `<path d="M-18,0 L0,-26 L18,0Z" fill="${r() > .5 ? '#ff7043' : '#29b6f6'}"/><path d="M0,-26 L-5,0 L5,0Z" fill="rgba(0,0,0,.25)"/>`,
  cone: () => shadow(6) + `<rect x="-7" y="-2" width="14" height="3" fill="#e65100"/><path d="M-5,-2 L0,-16 L5,-2Z" fill="#ff6d00"/><rect x="-3.2" y="-10" width="6.4" height="2.5" fill="#fff"/>`,
  lamp: () => shadow(5) + `<rect x="-1.2" y="-34" width="2.4" height="34" fill="#546e7a"/><circle cx="0" cy="-35" r="4" fill="#fff59d"/>`,
  building: (r) => {
    const w = 26 + Math.floor(r() * 14), h = 40 + Math.floor(r() * 50), c = ['#90caf9', '#ffab91', '#b0bec5', '#a5d6a7', '#ffe082'][Math.floor(r() * 5)];
    let win = '';
    for (let yy = -h + 8; yy < -8; yy += 11) for (let xx = -w / 2 + 5; xx < w / 2 - 6; xx += 8) win += `<rect x="${xx}" y="${yy}" width="4" height="6" fill="rgba(255,255,255,.65)"/>`;
    return shadow(w / 1.6) + `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="${c}"/><rect x="${-w / 2}" y="${-h}" width="${w}" height="5" fill="rgba(0,0,0,.18)"/><rect x="${w / 2 - 6}" y="${-h}" width="6" height="${h}" fill="rgba(0,0,0,.12)"/>${win}`;
  },
  hill: () => `<path d="M-40,0 Q-20,-30 0,-28 Q22,-30 40,0Z" fill="#c2b05a"/><path d="M-20,-18 Q0,-30 18,-20" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"/>`,
  rock: (r) => shadow(11) + `<path d="M-11,0 L-8,-10 L1,-15 L10,-8 L12,0Z" fill="${r() > .5 ? '#8d8d8d' : '#a1887f'}"/><path d="M1,-15 L10,-8 L12,0 L4,0Z" fill="rgba(0,0,0,.15)"/>`,
  cactus: () => shadow(8) + `<rect x="-4" y="-34" width="8" height="34" rx="4" fill="#43a047"/><path d="M-4,-18 h-6 a3,3 0 0 1 -3,-3 v-8" stroke="#43a047" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M4,-22 h6 a3,3 0 0 0 3,-3 v-6" stroke="#43a047" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  skull: () => `<ellipse cx="0" cy="-3" rx="6" ry="4" fill="#fff8e1"/><circle cx="-2" cy="-3.5" r="1" fill="#6d4c41"/><circle cx="2" cy="-3.5" r="1" fill="#6d4c41"/>`,
  mesaSmall: () => `<path d="M-26,0 L-18,-26 L18,-26 L26,0Z" fill="#d9773e"/><rect x="-18" y="-26" width="36" height="5" fill="#ef9a5a"/><rect x="-22" y="-12" width="44" height="3" fill="rgba(0,0,0,.12)"/>`,
};

// Landmarks: one hero piece per world.
const LANDMARK = {
  base: () => `${shadow(40)}<ellipse cx="0" cy="-10" rx="46" ry="20" fill="#4fc3f7"/><ellipse cx="0" cy="-10" rx="46" ry="20" fill="none" stroke="#e1f5fe" stroke-width="3"/><ellipse cx="-12" cy="-14" rx="12" ry="4" fill="rgba(255,255,255,.45)"/>
    <g transform="translate(58,-4)"><path d="M-6,0 L6,0 L4,-3 L-4,-3Z" fill="#6d4c41"/><path d="M0,-16 Q7,-8 3,-3 L-3,-3 Q-7,-8 0,-16Z" fill="#ff7043"/><path d="M0,-10 Q3,-6 1,-3 L-1,-3 Q-3,-6 0,-10Z" fill="#ffd54f"/></g>`,
  '5k': () => `<g><path d="M-82,-58 h164 v14 h-164Z" fill="#78909c"/><path d="M-82,-58 h164 v4 h-164Z" fill="#90a4ae"/>
    ${[-70, -46, -22, 2, 26, 50, 74].map(x => `<rect x="${x}" y="-72" width="2" height="14" fill="#455a64"/><path d="M${x + 2},-72 l10,3 l-10,3Z" fill="${['#ef5350', '#ffca28', '#42a5f5'][Math.abs(x) % 3]}"/>`).join('')}
    <ellipse cx="0" cy="0" rx="86" ry="42" fill="#d9643a"/>
    <ellipse cx="0" cy="0" rx="78" ry="35" fill="none" stroke="#fff" stroke-width="1.4"/>
    <ellipse cx="0" cy="0" rx="70" ry="28" fill="none" stroke="#fff" stroke-width="1.4"/>
    <ellipse cx="0" cy="0" rx="61" ry="21" fill="#66bb6a"/>
    <path d="M-61,0 h122" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
    <rect x="70" y="-3" width="16" height="6" fill="url(#checker)"/></g>`,
  '10k': () => `<g>${[[-60, 90, '#64b5f6'], [-30, 120, '#90a4ae'], [0, 70, '#ffb74d'], [28, 105, '#81c784'], [56, 80, '#ba68c8']].map(([x, h, c]) => {
      let win = ''; for (let yy = -h + 8; yy < -8; yy += 11) for (let xx = x - 9; xx < x + 8; xx += 8) win += `<rect x="${xx}" y="${yy}" width="4" height="6" fill="rgba(255,255,255,.6)"/>`;
      return `<rect x="${x - 13}" y="${-h}" width="26" height="${h}" fill="${c}"/><rect x="${x + 7}" y="${-h}" width="6" height="${h}" fill="rgba(0,0,0,.13)"/>${win}`;
    }).join('')}<rect x="-80" y="0" width="160" height="6" fill="#78909c"/></g>`,
  half: () => `<path d="M-90,0 Q-55,-60 -15,-40 Q20,-75 60,-35 Q80,-20 95,0Z" fill="#b39d4c"/><path d="M-40,-30 Q-10,-50 20,-40" stroke="rgba(255,255,255,.3)" stroke-width="4" fill="none"/>${G(-30, -8, 0.8, DECO.pine(() => .5))}${G(40, -6, 0.9, DECO.pine(() => .5))}`,
  full: () => `<path d="M-100,0 L-40,-110 L0,-50 L35,-130 L100,0Z" fill="#78909c"/><path d="M-40,-110 L-20,-74 L0,-50 L-12,-80Z" fill="rgba(0,0,0,.15)"/><path d="M35,-130 L60,-80 L100,0 L70,0Z" fill="rgba(0,0,0,.14)"/>
    <path d="M-40,-110 L-27,-86 L-35,-82 L-44,-90 L-52,-88Z" fill="#fff"/><path d="M35,-130 L51,-100 L42,-96 L33,-104 L22,-100Z" fill="#fff"/>`,
  ultra: () => `<circle cx="40" cy="-150" r="30" fill="#ffd54f"/><circle cx="40" cy="-150" r="40" fill="#ffd54f" opacity=".25"/>
    <path d="M-100,0 L-80,-70 L-20,-70 L0,0Z" fill="#d9773e"/><rect x="-80" y="-70" width="60" height="7" fill="#ef9a5a"/><rect x="-92" y="-36" width="84" height="4" fill="rgba(0,0,0,.12)"/>
    <path d="M20,0 L34,-46 L80,-46 L98,0Z" fill="#c8662f"/><rect x="34" y="-46" width="46" height="6" fill="#e58a4e"/>`,
};

function placeLandmark(band) {
  const y = band.top + (band.bottom - band.top) * 0.55;
  let best = { x: 200, d: -1 };
  for (let x = 90; x <= 310; x += 10) { const d = distToPath(x, y); if (d > best.d) best = { x, d }; }
  const scale = Math.min(1, Math.max(0.55, (best.d - 20) / 95));
  return { x: best.x, y, scale };
}

function scenery() {
  const out = [];
  const r = rng(42);
  const nodeClear = (x, y) => POINTS.every(p => Math.hypot(p.x - x, p.y - y) > 80);
  for (const b of bands()) {
    const style = WORLD_STYLE[b.w.id];
    const lm = placeLandmark(b);
    out.push({ y: lm.y, svg: G(lm.x, lm.y, lm.scale, LANDMARK[b.w.id]()), lm, band: b });
    for (let y = b.top + 30; y < b.bottom - 8; y += 34) {
      for (let x = 14; x < W; x += 38) {
        const jx = x + (r() - 0.5) * 26, jy = y + (r() - 0.5) * 22;
        if (r() < 0.38) continue;
        if (distToPath(jx, jy) < 40 || !nodeClear(jx, jy)) continue;
        if (Math.hypot((jx - lm.x) / (110 * lm.scale), (jy - lm.y) / (80 * lm.scale)) < 1) continue;
        const kind = style.deco[Math.floor(r() * style.deco.length)];
        out.push({ y: jy, svg: G(jx, jy, 0.75 + r() * 0.45, DECO[kind](r)) });
      }
    }
  }
  return out.sort((a, b) => a.y - b.y).map(o => o.svg).join('');
}

function groundBands() {
  // Top world first, so each lower band's wavy edge sits over the band above it.
  return bands().reverse().map(({ w, top, bottom }) => {
    const s = WORLD_STYLE[w.id];
    let edge = `M0,${top}`;
    for (let x = 0; x < W; x += 50) edge += ` Q${x + 25},${top + (x / 50 % 2 ? 14 : -14)} ${x + 50},${top}`;
    return `<path d="${edge} L${W},${H} L0,${H}Z" fill="${s.ground}"/>
      <path d="${edge}" fill="none" stroke="${s.deep}" stroke-width="6" opacity=".55"/>`;
  }).join('');
}

function worldSigns() {
  return bands().map(({ w, top, bottom }) => {
    const y = bottom - 26;
    const label = w.name.toUpperCase();
    const width = Math.max(96, label.length * 8.6 + 34);
    const left = distToPath(70, y) > distToPath(330, y);
    const x = left ? width / 2 + 8 : W - width / 2 - 8;
    return `<g transform="translate(${x},${y})" class="sign"><rect x="-3" y="-6" width="6" height="22" fill="#6d4c41"/>
      <rect x="${-width / 2}" y="-34" width="${width}" height="28" rx="6" fill="#8d6e63" stroke="#5d4037" stroke-width="2"/>
      <text x="0" y="-15" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="15" fill="#fff8e1">${w.emoji} ${label}</text></g>`;
  }).join('');
}

const STATIC = { svg: null };
function staticLayers() {
  if (STATIC.svg) return STATIC.svg;
  STATIC.svg = `
    <defs>
      <pattern id="checker" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fff"/><rect width="3" height="3" fill="#222"/><rect x="3" y="3" width="3" height="3" fill="#222"/></pattern>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".25"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="#9ccc65"/>
    ${groundBands()}
    ${scenery()}
    ${worldSigns()}
    <path d="${fullPath}" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="30" stroke-linecap="round" transform="translate(0,3)"/>
    <path d="${fullPath}" fill="none" stroke="#c9a27e" stroke-width="26" stroke-linecap="round"/>
    <path d="${fullPath}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 9" opacity=".7"/>
    <g transform="translate(${POINTS[0].x},${POINTS[0].y})"><rect x="-22" y="-5" width="44" height="10" fill="url(#checker)"/>
      <text y="26" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="16" fill="#fff" stroke="#33691e" stroke-width="3" paint-order="stroke">START</text></g>
    ${SEGS.map((s, i) => `<path id="seg-${i + 1}" d="${s.d}" fill="none" stroke="none"/>`).join('')}`;
  return STATIC.svg;
}

// ---------- dynamic layers ----------
const star = (x, y, on) => `<path transform="translate(${x},${y}) scale(.55)" d="M0,-10 L2.9,-3.1 L10,-3.1 L4.3,1.6 L6.4,8.9 L0,4.6 L-6.4,8.9 L-4.3,1.6 L-10,-3.1 L-2.9,-3.1Z" fill="${on ? '#ffd23f' : 'rgba(255,255,255,.35)'}" stroke="${on ? '#e09b00' : 'none'}" stroke-width="1.5"/>`;

function nodeSvg(l, s) {
  const p = POINTS[l.n];
  const cur = s.run.level;
  const state = l.n < cur ? 'done' : l.n === cur ? 'current' : 'locked';
  const stars = s.run.stars[l.n] || 0;
  const skipped = state === 'done' && !stars;
  const boss = l.steps.some(st => st.boss);
  const flagRight = p.x < 200;
  const fx = flagRight ? 14 : -14, dir = flagRight ? 1 : -1;
  const flagW = 52, flagColor = state === 'locked' ? '#9e9e9e' : state === 'current' ? '#ff6b35' : '#29a0e0';
  const flagX = fx + (dir > 0 ? 0 : -flagW);
  const inFlag = state === 'locked'
    ? `<text x="${flagX + flagW / 2}" y="-42" text-anchor="middle" font-size="14">${s.run.reclaim === l.n ? '🔁' : '🔒'}</text>`
    : skipped ? `<text x="${flagX + flagW / 2}" y="-42" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="9" fill="#fff">PLACED</text>`
    : [0, 1, 2].map(i => star(flagX + 12 + i * 14, -46, i < stars)).join('');
  const disc = state === 'done' ? '#7cb342' : state === 'current' ? '#ff6b35' : '#bdbdbd';
  return `<g class="map-node ${state}" data-act="map-node" data-n="${l.n}" transform="translate(${p.x},${p.y})" role="button" tabindex="0" aria-label="Level ${l.n} ${l.name}">
      <circle r="34" fill="transparent"/>
      ${state === 'current' ? '<circle class="halo" r="24" fill="none" stroke="#fff" stroke-width="3"/>' : ''}
      <rect x="${fx - 1.5}" y="-62" width="3" height="58" fill="#5d4037"/>
      <circle cx="${fx}" cy="-63" r="4" fill="#e53935"/>
      <path d="M${flagX},-58 h${flagW} l${dir * -6},11 l${dir * 6},11 h${-flagW}Z" fill="${flagColor}" stroke="rgba(0,0,0,.2)" stroke-width="1" filter="url(#soft)"/>
      ${inFlag}
      <ellipse cy="5" rx="21" ry="8" fill="rgba(0,0,0,.2)"/>
      <circle r="18" fill="${disc}" stroke="#fff" stroke-width="3"/>
      <text y="6" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="19" fill="#fff">${l.n}</text>
      ${boss ? `<text x="${-fx * 1.4}" y="-14" text-anchor="middle" font-size="16">🏆</text>` : ''}
      ${s.profile?.dream?.target?.level === l.n ? `<g class="dream-pin" transform="translate(${-fx * 1.9},-34)"><circle r="15" fill="#fff" stroke="#e91e63" stroke-width="2.5"/><text y="6" text-anchor="middle" font-size="16">🎯</text></g>` : ''}
    </g>`;
}

const RUNNER = `
  <g class="runner-inner">
    <ellipse cx="0" cy="0" rx="11" ry="3.5" fill="rgba(0,0,0,.28)"/>
    <g class="bob">
      <g class="limb leg-b"><path d="M0,-17 L0,-5" stroke="#1e2b4d" stroke-width="4.5" stroke-linecap="round"/><path d="M0,-4 h5" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
      <g class="limb arm-b"><path d="M0,-31 L0,-21" stroke="#e8b48a" stroke-width="3.5" stroke-linecap="round"/></g>
      <rect x="-5.5" y="-33" width="11" height="17" rx="5" fill="#ff6b35"/>
      <rect x="-5.5" y="-20" width="11" height="5" rx="2" fill="#1e2b4d"/>
      <g class="limb leg-f"><path d="M0,-17 L0,-5" stroke="#1e2b4d" stroke-width="4.5" stroke-linecap="round"/><path d="M0,-4 h5" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>
      <g class="limb arm-f"><path d="M0,-31 L0,-21" stroke="#f1c49b" stroke-width="3.5" stroke-linecap="round"/></g>
      <circle cx="1" cy="-39" r="6.5" fill="#f1c49b"/>
      <path d="M-5.8,-42 a6.5,6.5 0 0 1 13,0" fill="#3e2723"/>
      <rect x="-6.5" y="-42" width="13" height="2.6" rx="1.3" fill="#29a0e0"/>
      <circle cx="4" cy="-38.5" r="1" fill="#1e2b4d"/>
    </g>
  </g>`;

export function renderMap(s, ui) {
  const cur = s.run.level;
  const totalStars = Object.values(s.run.stars).reduce((a, b) => a + b, 0);
  const at = ui.avatarAt ?? cur;
  const p = POINTS[at];
  const popup = ui.mapPopup ? popupHtml(s, ui.mapPopup) : '';
  return `<div class="worldmap">
      <div class="map-hud"><div class="star-count">⭐ ${totalStars}</div><button class="btn small" data-act="map-me">📍 Me</button></div>
      <div class="map-canvas" style="aspect-ratio:${W}/${H}">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" data-act="map-bg">
        ${staticLayers()}
        <path d="${pathTo(cur)}" fill="none" stroke="#e2703a" stroke-width="18" stroke-linecap="round"/>
        <path d="${pathTo(cur)}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 9"/>
        ${RUN_LEVELS.map(l => nodeSvg(l, s)).join('')}
        <g id="avatar" transform="translate(${p.x},${p.y - 16}) scale(1.45)">${RUNNER}</g>
      </svg>
      ${popup}
      </div>
    </div>`;
}

function popupHtml(s, n) {
  const l = RUN_LEVELS[n - 1];
  const p = POINTS[n];
  const cur = s.run.level;
  const w = WORLDS.find(x => x.id === l.world);
  const stars = s.run.stars[n] || 0;
  let body;
  if (n === cur) {
    const note = s.rebuild.active ? '<p class="hint">Rebuild Track first, then this level.</p>' : s.refresher ? '<p class="hint">Refresher course first. Prove It can skip it.</p>' : '';
    body = `<p class="pop-stars">${'⭐'.repeat(stars) + '☆'.repeat(3 - stars)}</p>${note}<button class="btn primary small" data-act="open-level">Open level</button>`;
  } else if (n < cur) {
    body = stars ? `<p class="pop-stars">${'⭐'.repeat(stars) + '☆'.repeat(3 - stars)}</p><p class="hint">Cleared</p>` : '<p class="hint">You were placed past this level.</p>';
  } else {
    body = `<p class="hint">🔒 ${s.run.reclaim === n ? 'Reclaim this level soon.' : `Unlocks by clearing Level ${n - 1}`}<br>Needs Prep P${l.needsPrep}</p>`;
  }
  if (s.profile?.dream?.target?.level === n) {
    body += `<p class="pop-dream">🎯 Your dream lives here: ${(s.profile.dream.text || s.profile.dream.event).replace(/</g, '&lt;')}</p>`;
  }
  const below = p.y < 260;
  return `<div class="map-pop ${below ? 'below' : ''}" style="left:${(p.x / W) * 100}%;top:${(p.y / H) * 100}%">
      <p class="eyebrow">${w.emoji} ${w.name} · Level ${n}</p><h3>${l.name}</h3>${body}</div>`;
}

// ---------- avatar movement ----------
let anim = null;
// opts: onDone, follow(y), duration (ms at normal speed), ease ('inOut' | 'blitz'),
//       rate() -> speed multiplier (1 = normal, <1 = slow-mo), onProgress({ seg, frac, pt, dir, k }), skip() -> bool
export function runAvatar(from, to, opts = {}) {
  const { onDone, follow, onProgress, skip } = opts;
  if (anim) cancelAnimationFrame(anim.raf);
  const svg = document.querySelector('.worldmap svg');
  const avatar = document.getElementById('avatar');
  if (!svg || !avatar || from === to) { onDone?.(); return; }
  const dirSign = to > from ? 1 : -1;
  const segIds = [];
  for (let i = from; i !== to; i += dirSign) segIds.push(dirSign > 0 ? i + 1 : i);
  const segs = segIds.map(id => document.getElementById(`seg-${id}`));
  const lens = segs.map(sg => sg.getTotalLength());
  const total = lens.reduce((a, b) => a + b, 0);
  const duration = opts.duration ?? Math.min(4500, 700 + total * 2.2);
  const ease = opts.ease === 'blitz'
    ? k => 1 - Math.pow(1 - k, 1.3)
    : k => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const inner = avatar.querySelector('.runner-inner');
  avatar.classList.add('running');
  if (opts.ease === 'blitz') avatar.classList.add('blitz');
  let lastT = performance.now(), k = 0;
  let lastX = null;
  const frame = t => {
    const dt = Math.min(64, t - lastT);
    lastT = t;
    k = skip?.() ? 1 : Math.min(1, k + (dt / duration) * (opts.rate ? opts.rate() : 1));
    let d = ease(k) * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
    const pt = segs[i].getPointAtLength(dirSign > 0 ? d : lens[i] - d);
    const dir = lastX == null ? 1 : Math.sign(pt.x - lastX) || 1;
    if (lastX != null && Math.abs(pt.x - lastX) > 0.05) inner.setAttribute('transform', pt.x < lastX ? 'scale(-1,1)' : '');
    lastX = pt.x;
    avatar.setAttribute('transform', `translate(${pt.x},${pt.y - 16}) scale(1.45)`);
    follow?.(pt.y);
    onProgress?.({ seg: i, frac: d / lens[i], pt, dir, k });
    if (k < 1) anim = { raf: requestAnimationFrame(frame) };
    else { anim = null; avatar.classList.remove('running', 'blitz'); onDone?.(); }
  };
  anim = { raf: requestAnimationFrame(frame) };
}

// Point halfway along segment n (from point n-1 to point n).
export function segMid(n) {
  const sg = document.getElementById(`seg-${n}`);
  return sg ? sg.getPointAtLength(sg.getTotalLength() / 2) : null;
}

// Add a short-lived SVG piece to the map (speech bubbles, dust, characters).
export function addToMap(markup, ttl, cls = '') {
  const svg = document.querySelector('.worldmap svg');
  if (!svg) return null;
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  if (cls) g.setAttribute('class', cls);
  g.innerHTML = markup;
  svg.appendChild(g);
  if (ttl) setTimeout(() => g.remove(), ttl);
  return g;
}

export function bubble(x, y, text, { ttl = 1500, tone = 'me' } = {}) {
  const w = Math.max(60, [...text].length * 8.4 + 24);
  const bx = Math.min(W - w / 2 - 4, Math.max(w / 2 + 4, x));
  const fill = tone === 'me' ? '#ffffff' : '#fff3c4';
  return addToMap(`<g transform="translate(${bx},${y})"><g class="quip-inner">
      <path d="M${x - bx - 6},-6 L${x - bx},4 L${x - bx + 6},-6Z" fill="${fill}" stroke="#14213d" stroke-width="2" stroke-linejoin="round"/>
      <rect x="${-w / 2}" y="-30" width="${w}" height="25" rx="12.5" fill="${fill}" stroke="#14213d" stroke-width="2"/>
      <rect x="${x - bx - 5}" y="-7" width="10" height="3" fill="${fill}"/>
      <text y="-12.5" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="16" fill="#14213d">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
    </g></g>`, ttl, 'quip');
}

// Page Y (in CSS px) of a map y coordinate.
export function mapPageY(y) {
  const svg = document.querySelector('.worldmap svg');
  if (!svg) return 0;
  const r = svg.getBoundingClientRect();
  return r.top + window.scrollY + (y / H) * r.height;
}
