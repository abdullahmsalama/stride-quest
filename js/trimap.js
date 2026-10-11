// Lane maps: three lanes climb side by side through world bands, and a gate (bridge) spans them.
// Used by the Triathlon map (swim water, bike road, run trail) and the Hybrid map (strength, engine, run).
import { TRI_WORLDS } from './data/tri.js';
import { HYBRID_WORLDS } from './data/hybrid.js';
import { RUN_LEVELS } from './data/tracks.js';
import * as T from './tri.js';
import * as H from './hybrid.js';

export const TW = 400;
const BAND = 340;
export const TH = 6 * BAND + 150; // both maps have six worlds
const XS = [80, 200, 320];
const bandBottom = i => TH - 150 - i * BAND;
export const laneY = i => bandBottom(i) - 105;
export const gateY = i => bandBottom(i) - 245;
const START_Y = TH - 60;
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- the two maps ----------
const TRI = {
  id: 'tri', worlds: TRI_WORLDS, lanes: T.LANES, icon: T.LANE_ICON, label: T.LANE_LABEL, gateTrack: 'triGate', gateWord: 'transition gate', openIcon: '🌉',
  bandFill: ['#b9e4a8', '#f6e0b5', '#b3e5fc', '#ffe9a8', '#d8c983', '#f2b36d'], bg: '#b9e4a8', further: 'A world further up the coast.',
  world: s => s.tri.world, finished: s => s.tri.finished, status: T.laneStatus, ready: T.lanesReady, limiter: T.limiter, target: T.laneTarget,
  value: (s, l) => (l === 'swim' ? s.tri.swim.stage : l === 'bike' ? s.tri.bike.stage : s.run.level),
  stage: (s, l) => (l === 'swim' ? T.swimStage(s) : T.bikeStage(s)), max: l => (l === 'swim' ? T.SWIM_MAX : T.BIKE_MAX), current: T.triWorld,
  art: () => {
    const [a, b, c] = XS;
    const waves = Array.from({ length: Math.floor(TH / 46) }, (_, i) => `<path d="M${a - 18},${40 + i * 46} q9,-6 18,0 t18,0" stroke="#e1f5fe" stroke-width="2" fill="none" opacity=".8"/>`).join('');
    return `<rect x="${a - 30}" y="0" width="60" height="${TH}" fill="#4fc3f7"/>${waves}
      <rect x="${b - 22}" y="0" width="44" height="${TH}" fill="#78909c"/><line x1="${b}" y1="0" x2="${b}" y2="${TH}" stroke="#fff" stroke-width="2.5" stroke-dasharray="14 12"/>${runTrail(c)}`;
  },
};
const HYB = {
  id: 'hyb', worlds: HYBRID_WORLDS, lanes: H.LANES, icon: H.LANE_ICON, label: H.LANE_LABEL, gateTrack: 'hyGate', gateWord: 'race gate', openIcon: '🏁',
  bandFill: ['#cfd8dc', '#d7ccc8', '#ffe0b2', '#ffccbc', '#f8bbd0', '#ffe082'], bg: '#cfd8dc', further: 'A bigger arena further up.',
  world: s => s.hybrid.world, finished: s => s.hybrid.finished, status: H.laneStatus, ready: H.lanesReady, limiter: H.limiter, target: H.laneTarget,
  value: (s, l) => (l === 'strength' ? s.hybrid.strength.stage : l === 'engine' ? s.hybrid.engine.stage : s.run.level),
  stage: (s, l) => (l === 'strength' ? H.strengthStage(s) : H.engineStage(s)), max: l => (l === 'strength' ? H.STR_MAX : H.ENG_MAX), current: H.hybWorld,
  art: () => {
    const [a, b, c] = XS;
    // Strength: rubber gym floor with plates; Engine: blue erg lane with chevrons.
    const plates = Array.from({ length: Math.floor(TH / 90) }, (_, i) => `<g transform="translate(${a},${50 + i * 90})"><rect x="-17" y="-2" width="34" height="4" rx="2" fill="#cfd8dc"/><rect x="-14" y="-8" width="5" height="16" rx="1.5" fill="#455a64"/><rect x="9" y="-8" width="5" height="16" rx="1.5" fill="#455a64"/></g>`).join('');
    const chev = Array.from({ length: Math.floor(TH / 40) }, (_, i) => `<path d="M${b - 9},${30 + i * 40} l9,-7 l9,7" stroke="#e3f2fd" stroke-width="2.5" fill="none" opacity=".75"/>`).join('');
    return `<rect x="${a - 28}" y="0" width="56" height="${TH}" fill="#37474f"/>${plates}
      <rect x="${b - 22}" y="0" width="44" height="${TH}" fill="#1e88e5"/>${chev}${runTrail(c)}`;
  },
};
function runTrail(c) {
  return `<rect x="${c - 19}" y="0" width="38" height="${TH}" fill="#e2703a"/>
    <line x1="${c - 6}" y1="0" x2="${c - 6}" y2="${TH}" stroke="#fff" stroke-width="1.2" stroke-dasharray="9 9" opacity=".75"/>
    <line x1="${c + 6}" y1="0" x2="${c + 6}" y2="${TH}" stroke="#fff" stroke-width="1.2" stroke-dasharray="9 9" opacity=".75"/>`;
}
export const MAPS = { tri: TRI, hyb: HYB };

// Where a lane's avatar stands: between the targets it has reached.
export function laneAvatarY(cfg, lane, value) {
  const req = cfg.worlds.map(w => w[lane]);
  if (value >= req.at(-1)) return laneY(cfg.worlds.length - 1);
  let prevV = 0, prevY = START_Y;
  for (let i = 0; i < req.length; i++) {
    if (value < req[i]) return prevY + (laneY(i) - prevY) * ((value - prevV) / Math.max(1, req[i] - prevV));
    prevV = req[i]; prevY = laneY(i);
  }
  return laneY(cfg.worlds.length - 1);
}
const X = (cfg, lane) => XS[cfg.lanes.indexOf(lane)];

function bands(cfg) {
  return cfg.worlds.map((w, i) => {
    const top = i === cfg.worlds.length - 1 ? 0 : bandBottom(i + 1);
    return `<rect x="0" y="${top}" width="${TW}" height="${bandBottom(i) - top + (i === 0 ? 150 : 0)}" fill="${cfg.bandFill[i]}"/>
      <path d="M0,${bandBottom(i)} ${Array.from({ length: 8 }, (_, k) => `Q${k * 50 + 25},${bandBottom(i) + (k % 2 ? 10 : -10)} ${k * 50 + 50},${bandBottom(i)}`).join(' ')}" stroke="rgba(0,0,0,.12)" stroke-width="4" fill="none"/>`;
  }).join('');
}

function laneNode(s, cfg, lane, i) {
  const st = cfg.status(s, i).find(l => l.lane === lane);
  const current = i === cfg.world(s) && !cfg.finished(s);
  const fill = st.ok ? '#7cb342' : current ? '#ff6b35' : '#bdbdbd';
  const label = lane === 'run' ? `L${st.need}` : cfg.target(lane, st.need).replace(' + open water', ' + OW').replace(' x bodyweight', 'x BW');
  return `<g class="tri-node" data-act="lane-node" data-map="${cfg.id}" data-kind="lane" data-lane="${lane}" data-world="${i}" transform="translate(${X(cfg, lane)},${laneY(i)})" role="button" tabindex="0" aria-label="${cfg.label[lane]} target ${esc(label)}">
      <circle r="24" fill="transparent"/>
      <circle r="15" fill="${fill}" stroke="#fff" stroke-width="3"/>
      <text y="5" text-anchor="middle" font-size="13" fill="#fff" font-weight="800">${st.ok ? '✓' : ''}</text>
      <rect x="${-Math.max(30, label.length * 3.1 + 10)}" y="20" width="${2 * Math.max(30, label.length * 3.1 + 10)}" height="18" rx="9" fill="rgba(20,33,61,.82)"/>
      <text y="33" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="#fff">${esc(label)}</text>
    </g>`;
}

function gateNode(s, cfg, i) {
  const w = cfg.worlds[i];
  const passed = i < cfg.world(s) || (cfg.finished(s) && i === cfg.world(s));
  const current = i === cfg.world(s) && !cfg.finished(s);
  const open = current && cfg.ready(s);
  const color = passed ? '#7cb342' : open ? '#ff6b35' : '#8d6e63';
  const dream = cfg.id === 'tri' ? s.profile?.dream?.target?.world === i : s.profile?.dream?.target?.track === 'hybrid' && s.profile?.dream?.target?.world === i;
  return `<g class="tri-gate ${open ? 'open' : ''}" data-act="lane-node" data-map="${cfg.id}" data-kind="gate" data-world="${i}" role="button" tabindex="0" aria-label="${esc(w.name)} ${cfg.gateWord}">
      <rect x="${XS[0] - 34}" y="${gateY(i) - 9}" width="${XS[2] - XS[0] + 68}" height="18" rx="5" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      ${Array.from({ length: 13 }, (_, k) => `<line x1="${XS[0] - 30 + k * 23.5}" y1="${gateY(i) - 9}" x2="${XS[0] - 30 + k * 23.5}" y2="${gateY(i) + 9}" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>`).join('')}
      ${open ? `<circle class="halo" cx="${XS[1]}" cy="${gateY(i)}" r="26" fill="none" stroke="#fff" stroke-width="3"/>` : ''}
      <circle cx="${XS[1]}" cy="${gateY(i)}" r="22" fill="#fff" stroke="${color}" stroke-width="4"/>
      <text x="${XS[1]}" y="${gateY(i) + 7}" text-anchor="middle" font-size="20">${passed ? '✅' : open ? cfg.openIcon : w.gate.boss ? '🏆' : '🔒'}</text>
      ${dream ? `<g transform="translate(${XS[1] + 40},${gateY(i) - 22})"><circle r="15" fill="#fff" stroke="#e91e63" stroke-width="2.5"/><text y="6" text-anchor="middle" font-size="16">🎯</text></g>` : ''}
      <rect x="${XS[1] - 92}" y="${gateY(i) - 62}" width="184" height="26" rx="13" fill="rgba(255,255,255,.92)" stroke="rgba(0,0,0,.12)"/>
      <text x="${XS[1]}" y="${gateY(i) - 44}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="15" fill="#14213d">${w.emoji} ${esc(w.name.toUpperCase())}</text>
    </g>`;
}

function avatars(s, cfg) {
  const lim = cfg.limiter(s)?.lane;
  return cfg.lanes.map(lane => {
    const y = laneAvatarY(cfg, lane, cfg.value(s, lane)) - 2;
    const resting = cfg.id === 'hyb' && lane !== 'run' && !H.inFocus(s, lane);
    return `<g class="tri-avatar ${lim === lane ? 'limiter' : ''} ${resting ? 'resting' : ''}" data-act="lane-node" data-map="${cfg.id}" data-kind="lane" data-lane="${lane}" data-world="${cfg.world(s)}" transform="translate(${X(cfg, lane)},${y})">
        ${lim === lane ? '<circle class="halo lim" r="22" fill="none" stroke="#e53935" stroke-width="3"/>' : ''}
        <g class="bob"><circle r="17" fill="#fff" stroke="#14213d" stroke-width="2"/><text y="7" text-anchor="middle" font-size="19">${cfg.icon[lane]}</text></g>
        ${resting ? '<text x="17" y="-12" font-size="13">🔒</text>' : ''}
      </g>`;
  }).join('');
}

export function renderLaneMap(s, ui, id) {
  const cfg = MAPS[id];
  const popup = ui.lanePopup?.map === id ? popupHtml(s, cfg, ui.lanePopup) : '';
  return `<div class="worldmap trimap" style="background:${cfg.bg}">
      <div class="map-canvas" style="aspect-ratio:${TW}/${TH}">
      <svg viewBox="0 0 ${TW} ${TH}" xmlns="http://www.w3.org/2000/svg" data-act="lane-bg">
        ${bands(cfg)}${cfg.art()}
        <g><rect x="${XS[0] - 34}" y="${START_Y - 6}" width="${XS[2] - XS[0] + 68}" height="12" fill="url(#lane-checker)"/>
          <defs><pattern id="lane-checker" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#222"/><rect x="4" y="4" width="4" height="4" fill="#222"/></pattern></defs>
          <text x="${XS[1]}" y="${START_Y + 36}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="17" fill="#14213d">START</text></g>
        ${cfg.worlds.map((_, i) => gateNode(s, cfg, i)).join('')}
        ${cfg.worlds.map((_, i) => cfg.lanes.map(l => laneNode(s, cfg, l, i)).join('')).join('')}
        ${avatars(s, cfg)}
      </svg>
      ${popup}
      </div>
    </div>`;
}

function popupHtml(s, cfg, p) {
  const i = +p.world;
  const w = cfg.worlds[i];
  const cur = cfg.current(s);
  let html, x, y;
  if (p.kind === 'gate') {
    const st = cfg.status(s, i);
    const current = i === cfg.world(s) && !cfg.finished(s);
    const open = current && cfg.ready(s);
    x = XS[1]; y = gateY(i);
    html = `<p class="eyebrow">${w.emoji} ${esc(w.name)} · ${cfg.gateWord}</p><h3>${esc(w.race)}</h3>
      <ul class="lane-check">${st.map(l => `<li>${l.ok ? '✅' : '⬜'} ${cfg.icon[l.lane]} ${cfg.label[l.lane]}: ${esc(cfg.target(l.lane, l.need))}</li>`).join('')}</ul>
      ${i < cfg.world(s) || (cfg.finished(s) && i === cfg.world(s)) ? '<p class="hint">Cleared ✅</p>' : open ? `<button class="btn primary small" data-act="open-step" data-track="${cfg.gateTrack}" data-idx="0">Start the ${cfg.gateWord}</button>`
        : current ? '<p class="hint">Opens when all three lanes are ticked.</p>' : `<p class="hint">🔒 ${cfg.further}</p>`}`;
  } else {
    const lane = p.lane;
    x = X(cfg, lane); y = laneAvatarY(cfg, lane, cfg.value(s, lane));
    const need = cur[lane];
    if (lane === 'run') {
      const lvl = RUN_LEVELS[s.run.level - 1];
      const ok = s.run.level >= need;
      html = `<p class="eyebrow">🏃 Run lane · shared with the Run map</p><h3>Level ${lvl.n} · ${esc(lvl.name)}</h3>
        <p class="hint">${ok ? `Ready for ${esc(cur.name)} ✅` : `${esc(cur.name)} needs Run Level ${need}. Clear it on the Run map and this lane moves too.`}</p>
        <button class="btn primary small" data-act="goto-run-map">Go to Run map</button>`;
    } else {
      const stage = cfg.stage(s, lane), have = cfg.value(s, lane), max = cfg.max(lane);
      const ok = have >= need;
      const resting = cfg.id === 'hyb' && !H.inFocus(s, lane);
      html = `<p class="eyebrow">${cfg.icon[lane]} ${cfg.label[lane]} lane</p><h3>${have >= max ? 'Ladder complete' : `${esc(stage.name)} · ${esc(stage.target)}`}</h3>
        <p class="hint">${ok ? `Ready for ${esc(cur.name)} ✅` : `${esc(cur.name)} needs ${esc(cfg.target(lane, need))}.`}</p>
        ${resting ? `<p class="hint">🔒 Maintaining this block: it builds again in a ${esc(cfg.label[lane])} block.</p>` : have < max ? `<button class="btn primary small" data-act="lane-step" data-lane="${lane}">Next ${esc(cfg.label[lane].toLowerCase())} session</button>` : ''}`;
    }
  }
  const below = y < 300;
  return `<div class="map-pop ${below ? 'below' : ''}" style="left:${(Math.min(330, Math.max(70, x)) / TW) * 100}%;top:${(y / TH) * 100}%">${html}</div>`;
}
