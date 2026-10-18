// Illustrated Gym map: a winding path from the Garage Gym (bottom) up to Mount Olympus (top), gym
// scenery per world (plates, dumbbells, kettlebells, racks, columns), a flag per stage, a trophy per
// Test Day, and the lifter where the athlete is now. Pure SVG markup; tap a flag for its details.
import { GYM_WORLDS, GYM_STAGES } from './data/gym.js';

export const W = 400;
const STEP = 150;
// Nodes in climbing order: each world's stages, then its Test Day.
export const NODES = GYM_WORLDS.flatMap((w, wi) => [...w.stages.map(n => ({ kind: 'stage', n, world: wi })), { kind: 'test', n: w.stages.at(-1), world: wi }]);
export const H = 190 + NODES.length * STEP;
const XS = [200, 110, 290, 120, 280, 110, 290, 125, 275, 110, 290, 120, 280, 115, 200];
const POINTS = [{ x: 200, y: H - 60 }, ...NODES.map((_, i) => ({ x: XS[i % XS.length], y: H - 190 - i * STEP }))];

function pathD() {
  const p = POINTS;
  let d = `M${p[0].x},${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
}
const STYLE = [
  { ground: '#cfd8dc', deep: '#b0bec5', deco: ['plate', 'dumbbell', 'box', 'kettlebell'] },
  { ground: '#c5e1a5', deep: '#9ccc65', deco: ['plate', 'pine', 'dumbbell', 'rock'] },
  { ground: '#d7ccc8', deep: '#bcaaa4', deco: ['rack', 'tower', 'plate', 'kettlebell'] },
  { ground: '#ffe0b2', deep: '#ffb74d', deco: ['bolt', 'rack', 'dumbbell', 'plate'] },
  { ground: '#e1f5fe', deep: '#b3e5fc', deco: ['column', 'cloud', 'column', 'laurel'] },
];
function bandOf(wi) {
  const idx = NODES.map((x, i) => (x.world === wi ? i + 1 : -1)).filter(i => i > 0);
  const lo = Math.min(...idx), hi = Math.max(...idx);
  const bottom = wi === 0 ? H : (POINTS[lo].y + POINTS[lo - 1].y) / 2;
  const top = hi === POINTS.length - 1 ? 0 : (POINTS[hi].y + POINTS[hi + 1].y) / 2;
  return { top, bottom };
}
function rng(seed) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
const DECO = {
  plate: (x, y, c) => `<g transform="translate(${x},${y})"><circle r="15" fill="#37474f"/><circle r="11" fill="none" stroke="#546e7a" stroke-width="2"/><circle r="3" fill="${c}"/></g>`,
  dumbbell: (x, y) => `<g transform="translate(${x},${y})"><rect x="-16" y="-2" width="32" height="4" rx="2" fill="#78909c"/><rect x="-20" y="-9" width="7" height="18" rx="2" fill="#263238"/><rect x="13" y="-9" width="7" height="18" rx="2" fill="#263238"/></g>`,
  kettlebell: (x, y) => `<g transform="translate(${x},${y})"><path d="M-7,-10 a7,6 0 0 1 14,0" fill="none" stroke="#263238" stroke-width="3"/><circle cy="2" r="11" fill="#37474f"/></g>`,
  box: (x, y) => `<g transform="translate(${x},${y})"><rect x="-14" y="-12" width="28" height="22" rx="2" fill="#a1887f"/><rect x="-14" y="-12" width="28" height="22" rx="2" fill="none" stroke="#6d4c41"/></g>`,
  rack: (x, y) => `<g transform="translate(${x},${y})" stroke="#455a64" stroke-width="3"><line x1="-14" y1="14" x2="-14" y2="-20"/><line x1="14" y1="14" x2="14" y2="-20"/><line x1="-22" y1="-10" x2="22" y2="-10" stroke="#90a4ae"/><circle cx="-22" cy="-10" r="5" fill="#263238" stroke="none"/><circle cx="22" cy="-10" r="5" fill="#263238" stroke="none"/></g>`,
  tower: (x, y) => `<g transform="translate(${x},${y})"><rect x="-10" y="-28" width="20" height="40" fill="#8d6e63"/><path d="M-12,-28 h4 v-5 h4 v5 h4 v-5 h4 v5 h4 v-5 h4 v5" fill="#8d6e63"/></g>`,
  bolt: (x, y) => `<path transform="translate(${x},${y})" d="M2,-16 L-8,2 H0 L-3,16 L9,-3 H1 Z" fill="#ffca28" stroke="#f57f17"/>`,
  column: (x, y) => `<g transform="translate(${x},${y})" fill="#eceff1" stroke="#b0bec5"><rect x="-12" y="-30" width="24" height="5"/><rect x="-8" y="-25" width="16" height="34"/><rect x="-12" y="9" width="24" height="5"/></g>`,
  cloud: (x, y) => `<g transform="translate(${x},${y})" fill="#fff" opacity="0.9"><circle r="10"/><circle cx="12" cy="2" r="8"/><circle cx="-12" cy="3" r="7"/></g>`,
  laurel: (x, y) => `<text x="${x}" y="${y}" font-size="22" text-anchor="middle">🏛️</text>`,
  pine: (x, y) => `<path transform="translate(${x},${y})" d="M0,-20 L12,6 H-12 Z" fill="#558b2f"/>`,
  rock: (x, y) => `<path transform="translate(${x},${y})" d="M-12,8 L-6,-6 L4,-9 L12,8 Z" fill="#90a4ae"/>`,
};
function scenery() {
  return GYM_WORLDS.map((w, wi) => {
    const b = bandOf(wi), st = STYLE[wi], r = rng(wi * 77 + 5), out = [];
    for (let k = 0; k < 9; k++) {
      const y = b.top + 30 + r() * Math.max(20, b.bottom - b.top - 60), side = k % 2 ? r() * 60 + 20 : W - 20 - r() * 60;
      out.push(DECO[st.deco[k % st.deco.length]](Math.round(side), Math.round(y), st.deep));
    }
    return `<rect x="0" y="${b.top}" width="${W}" height="${b.bottom - b.top}" fill="${st.ground}"/>
      <path d="M0,${b.top + 24} Q${W / 2},${b.top - 6} ${W},${b.top + 24} V${b.top} H0 Z" fill="${st.deep}" opacity="0.5"/>${out.join('')}
      <g transform="translate(${W / 2},${b.bottom - 26})"><rect x="-92" y="-17" width="184" height="30" rx="15" fill="#fff" opacity="0.92"/><text y="4" text-anchor="middle" font-size="15" font-weight="800" fill="#263238">${w.emoji} ${w.name}</text></g>`;
  }).join('');
}

// status per node: done, here, open (next), locked.
function statusOf(g, node) {
  if (g.finished) return 'done';
  if (node.kind === 'stage') return node.n < g.stage ? 'done' : node.n === g.stage ? 'here' : 'locked';
  return g.world > node.world ? 'done' : g.stage === node.n ? 'open' : 'locked';
}
export function renderGymMap(s) {
  const g = s.gym;
  const nodes = NODES.map((node, i) => {
    const p = POINTS[i + 1], st = statusOf(g, node), boss = node.kind === 'test';
    const fill = st === 'done' ? '#9ccc65' : st === 'here' || st === 'open' ? '#ff7043' : '#cfd8dc';
    const label = boss ? GYM_WORLDS[node.world].test : `${node.n} · ${GYM_STAGES[node.n].name}`;
    const right = p.x < W / 2;
    return `<g class="gnode ${st}" ${st === 'here' ? 'id="gym-here"' : ''} data-act="gym-node" data-i="${i}" role="button" tabindex="0" transform="translate(${p.x},${p.y})">
      ${st === 'here' ? '<circle r="30" fill="#ff7043" opacity="0.25"><animate attributeName="r" values="24;32;24" dur="2.4s" repeatCount="indefinite"/></circle>' : ''}
      <circle r="${boss ? 23 : 19}" fill="${fill}" stroke="#fff" stroke-width="4"/>
      <text y="${boss ? 8 : 6}" text-anchor="middle" font-size="${boss ? 22 : 16}" font-weight="800" fill="#fff">${boss ? '🏆' : st === 'done' ? '✓' : node.n}</text>
      <g transform="translate(${right ? 30 : -30},4)"><text text-anchor="${right ? 'start' : 'end'}" font-size="13" font-weight="700" fill="#263238" paint-order="stroke" stroke="#fff" stroke-width="4">${label}</text></g>
      ${st === 'here' ? `<text y="-34" text-anchor="middle" font-size="30">🏋️</text>` : ''}</g>`;
  }).join('');
  const reached = Math.max(0, NODES.findIndex(n => statusOf(g, n) === 'here'));
  const sub = pathD();
  return `<div class="gym-svg card"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Gym map">
    ${scenery()}
    <path d="${sub}" fill="none" stroke="#5d4037" stroke-width="22" stroke-linecap="round" opacity="0.35"/>
    <path d="${sub}" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/>
    <g transform="translate(${POINTS[0].x},${POINTS[0].y})"><rect x="-44" y="-16" width="88" height="30" rx="8" fill="#263238"/><text y="5" text-anchor="middle" fill="#fff" font-size="13" font-weight="800">START</text></g>
    ${nodes}</svg></div>`.replace('data-reached', String(reached));
}
