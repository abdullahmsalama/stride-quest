// Triathlon world map: three lanes climb side by side (swim water, bike road, run trail).
// Each world is a band; a transition gate (bridge) spans the lanes and opens when all three are ready.
import { TRI_WORLDS, SWIM_STAGES, BIKE_STAGES } from './data/tri.js';
import { RUN_LEVELS } from './data/tracks.js';
import * as T from './tri.js';

export const TW = 400;
const BAND = 340;
export const TH = TRI_WORLDS.length * BAND + 150;
const X = { swim: 80, bike: 200, run: 320 };
const bandBottom = i => TH - 150 - i * BAND;
export const laneY = i => bandBottom(i) - 105;
export const gateY = i => bandBottom(i) - 245;
const START_Y = TH - 60;
const BAND_FILL = ['#b9e4a8', '#f6e0b5', '#b3e5fc', '#ffe9a8', '#d8c983', '#f2b36d'];

// Where a lane's avatar stands: between the targets it has reached.
export function laneAvatarY(lane, value) {
  const req = TRI_WORLDS.map(w => w[lane]);
  if (value >= req.at(-1)) return laneY(TRI_WORLDS.length - 1);
  let prevV = 0, prevY = START_Y;
  for (let i = 0; i < req.length; i++) {
    if (value < req[i]) return prevY + (laneY(i) - prevY) * ((value - prevV) / Math.max(1, req[i] - prevV));
    prevV = req[i]; prevY = laneY(i);
  }
  return laneY(TRI_WORLDS.length - 1);
}

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function lanes() {
  const waves = Array.from({ length: Math.floor(TH / 46) }, (_, i) => `<path d="M${X.swim - 18},${40 + i * 46} q9,-6 18,0 t18,0" stroke="#e1f5fe" stroke-width="2" fill="none" opacity=".8"/>`).join('');
  return `
    <rect x="${X.swim - 30}" y="0" width="60" height="${TH}" fill="#4fc3f7"/>${waves}
    <rect x="${X.bike - 22}" y="0" width="44" height="${TH}" fill="#78909c"/>
    <line x1="${X.bike}" y1="0" x2="${X.bike}" y2="${TH}" stroke="#fff" stroke-width="2.5" stroke-dasharray="14 12"/>
    <rect x="${X.run - 19}" y="0" width="38" height="${TH}" fill="#e2703a"/>
    <line x1="${X.run - 6}" y1="0" x2="${X.run - 6}" y2="${TH}" stroke="#fff" stroke-width="1.2" stroke-dasharray="9 9" opacity=".75"/>
    <line x1="${X.run + 6}" y1="0" x2="${X.run + 6}" y2="${TH}" stroke="#fff" stroke-width="1.2" stroke-dasharray="9 9" opacity=".75"/>`;
}

function bands() {
  return TRI_WORLDS.map((w, i) => {
    const top = i === TRI_WORLDS.length - 1 ? 0 : bandBottom(i + 1);
    return `<rect x="0" y="${top}" width="${TW}" height="${bandBottom(i) - top + (i === 0 ? 150 : 0)}" fill="${BAND_FILL[i]}"/>
      <path d="M0,${bandBottom(i)} ${Array.from({ length: 8 }, (_, k) => `Q${k * 50 + 25},${bandBottom(i) + (k % 2 ? 10 : -10)} ${k * 50 + 50},${bandBottom(i)}`).join(' ')}" stroke="rgba(0,0,0,.12)" stroke-width="4" fill="none"/>`;
  }).join('');
}

function laneNode(s, lane, i) {
  const st = T.laneStatus(s, i).find(l => l.lane === lane);
  const passed = i < s.tri.world || s.tri.finished;
  const current = i === s.tri.world && !s.tri.finished;
  const ok = st.ok;
  const fill = ok ? '#7cb342' : current ? '#ff6b35' : '#bdbdbd';
  const label = lane === 'run' ? `L${st.need}` : T.laneTarget(lane, st.need).replace(' + open water', ' + OW');
  return `<g class="tri-node" data-act="tri-node" data-kind="lane" data-lane="${lane}" data-world="${i}" transform="translate(${X[lane]},${laneY(i)})" role="button" tabindex="0" aria-label="${T.LANE_LABEL[lane]} target ${esc(label)}">
      <circle r="24" fill="transparent"/>
      <circle r="15" fill="${fill}" stroke="#fff" stroke-width="3" opacity="${passed || current || ok ? 1 : .8}"/>
      <text y="5" text-anchor="middle" font-size="13" fill="#fff" font-weight="800">${ok ? '✓' : ''}</text>
      <rect x="-30" y="20" width="60" height="18" rx="9" fill="rgba(20,33,61,.82)"/>
      <text y="33" text-anchor="middle" font-family="Inter, sans-serif" font-size="10.5" font-weight="700" fill="#fff">${esc(label)}</text>
    </g>`;
}

function gateNode(s, i) {
  const w = TRI_WORLDS[i];
  const passed = i < s.tri.world || s.tri.finished && i === s.tri.world;
  const current = i === s.tri.world && !s.tri.finished;
  const open = current && T.lanesReady(s);
  const color = passed ? '#7cb342' : open ? '#ff6b35' : '#8d6e63';
  return `<g class="tri-gate ${open ? 'open' : ''}" data-act="tri-node" data-kind="gate" data-world="${i}" role="button" tabindex="0" aria-label="${esc(w.name)} transition gate">
      <rect x="${X.swim - 34}" y="${gateY(i) - 9}" width="${X.run - X.swim + 68}" height="18" rx="5" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      ${Array.from({ length: 13 }, (_, k) => `<line x1="${X.swim - 30 + k * 23.5}" y1="${gateY(i) - 9}" x2="${X.swim - 30 + k * 23.5}" y2="${gateY(i) + 9}" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/>`).join('')}
      ${open ? `<circle class="halo" cx="${X.bike}" cy="${gateY(i)}" r="26" fill="none" stroke="#fff" stroke-width="3"/>` : ''}
      <circle cx="${X.bike}" cy="${gateY(i)}" r="22" fill="#fff" stroke="${color}" stroke-width="4"/>
      <text x="${X.bike}" y="${gateY(i) + 7}" text-anchor="middle" font-size="20">${passed ? '✅' : open ? '🌉' : w.gate.boss ? '🏆' : '🔒'}</text>
      ${s.profile?.dream?.target?.world === i ? `<g transform="translate(${X.bike + 40},${gateY(i) - 22})"><circle r="15" fill="#fff" stroke="#e91e63" stroke-width="2.5"/><text y="6" text-anchor="middle" font-size="16">🎯</text></g>` : ''}
      <rect x="${X.bike - 92}" y="${gateY(i) - 62}" width="184" height="26" rx="13" fill="rgba(255,255,255,.92)" stroke="rgba(0,0,0,.12)"/>
      <text x="${X.bike}" y="${gateY(i) - 44}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="15" fill="#14213d">${w.emoji} ${esc(w.name.toUpperCase())}</text>
    </g>`;
}

function avatars(s) {
  const lim = T.limiter(s)?.lane;
  return T.LANES.map(lane => {
    const v = lane === 'swim' ? s.tri.swim.stage : lane === 'bike' ? s.tri.bike.stage : s.run.level;
    const y = laneAvatarY(lane, v) - 2;
    return `<g class="tri-avatar ${lim === lane ? 'limiter' : ''}" data-act="tri-node" data-kind="lane" data-lane="${lane}" data-world="${s.tri.world}" transform="translate(${X[lane]},${y})">
        ${lim === lane ? '<circle class="halo lim" r="22" fill="none" stroke="#e53935" stroke-width="3"/>' : ''}
        <g class="bob"><circle r="17" fill="#fff" stroke="#14213d" stroke-width="2"/><text y="7" text-anchor="middle" font-size="19">${T.LANE_ICON[lane]}</text></g>
      </g>`;
  }).join('');
}

export function renderTriMap(s, ui) {
  const popup = ui.triPopup ? popupHtml(s, ui.triPopup) : '';
  return `<div class="worldmap trimap">
      <div class="map-canvas" style="aspect-ratio:${TW}/${TH}">
      <svg viewBox="0 0 ${TW} ${TH}" xmlns="http://www.w3.org/2000/svg" data-act="tri-bg">
        ${bands()}${lanes()}
        <g><rect x="${X.swim - 34}" y="${START_Y - 6}" width="${X.run - X.swim + 68}" height="12" fill="url(#tri-checker)"/>
          <defs><pattern id="tri-checker" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#222"/><rect x="4" y="4" width="4" height="4" fill="#222"/></pattern></defs>
          <text x="${X.bike}" y="${START_Y + 36}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="17" fill="#14213d">START</text></g>
        ${TRI_WORLDS.map((_, i) => gateNode(s, i)).join('')}
        ${TRI_WORLDS.map((_, i) => T.LANES.map(l => laneNode(s, l, i)).join('')).join('')}
        ${avatars(s)}
      </svg>
      ${popup}
      </div>
    </div>`;
}

function popupHtml(s, p) {
  const i = +p.world;
  const w = TRI_WORLDS[i];
  let html, x, y;
  if (p.kind === 'gate') {
    const st = T.laneStatus(s, i);
    const current = i === s.tri.world && !s.tri.finished;
    const open = current && T.lanesReady(s);
    x = X.bike; y = gateY(i);
    html = `<p class="eyebrow">${w.emoji} ${esc(w.name)} · transition gate</p><h3>${esc(w.race)}</h3>
      ${s.profile?.dream?.target?.world === i ? `<p class="pop-dream">🎯 Your dream lives here</p>` : ''}
      <ul class="lane-check">${st.map(l => `<li>${l.ok ? '✅' : '⬜'} ${T.LANE_ICON[l.lane]} ${T.LANE_LABEL[l.lane]}: ${esc(T.laneTarget(l.lane, l.need))}</li>`).join('')}</ul>
      ${i < s.tri.world || (s.tri.finished && i === s.tri.world) ? '<p class="hint">Cleared ✅</p>' : open ? '<button class="btn primary small" data-act="open-step" data-track="triGate" data-idx="0">Start the gate</button>'
        : current ? '<p class="hint">Opens when all three lanes are ticked.</p>' : '<p class="hint">🔒 A world further up the coast.</p>'}`;
  } else {
    const lane = p.lane;
    x = X[lane]; y = laneAvatarY(lane, lane === 'swim' ? s.tri.swim.stage : lane === 'bike' ? s.tri.bike.stage : s.run.level);
    const need = TRI_WORLDS[Math.min(s.tri.world, TRI_WORLDS.length - 1)][lane];
    if (lane === 'run') {
      const lvl = RUN_LEVELS[s.run.level - 1];
      const ok = s.run.level >= need;
      html = `<p class="eyebrow">🏃 Run lane · shared with the Run map</p><h3>Level ${lvl.n} · ${esc(lvl.name)}</h3>
        <p class="hint">${ok ? `Ready for ${esc(T.triWorld(s).name)} ✅` : `${esc(T.triWorld(s).name)} needs Run Level ${need}. Clear it on the Run map and this lane moves too.`}</p>
        <button class="btn primary small" data-act="goto-run-map">Go to Run map</button>`;
    } else {
      const stage = lane === 'swim' ? T.swimStage(s) : T.bikeStage(s);
      const have = lane === 'swim' ? s.tri.swim.stage : s.tri.bike.stage;
      const max = lane === 'swim' ? T.SWIM_MAX : T.BIKE_MAX;
      const ok = have >= need;
      html = `<p class="eyebrow">${T.LANE_ICON[lane]} ${T.LANE_LABEL[lane]} lane</p><h3>${have >= max ? 'Ladder complete' : `${esc(stage.name)} · ${esc(stage.target)}`}</h3>
        <p class="hint">${ok ? `Ready for ${esc(T.triWorld(s).name)} ✅` : `${esc(T.triWorld(s).name)} needs ${esc(T.laneTarget(lane, need))}.`}</p>
        ${have < max ? `<button class="btn primary small" data-act="tri-lane-step" data-lane="${lane}">Next ${lane} session</button>` : ''}`;
    }
  }
  const below = y < 300;
  return `<div class="map-pop ${below ? 'below' : ''}" style="left:${(Math.min(330, Math.max(70, x)) / TW) * 100}%;top:${(y / TH) * 100}%">${html}</div>`;
}

export { SWIM_STAGES, BIKE_STAGES };
