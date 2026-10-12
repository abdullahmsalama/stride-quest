// Fog of war: the map ahead stays a mystery. The worlds you stand in and the next one are clear,
// the one after is dimmed, everything beyond sits under clouds until you get there.
// Shared by the Run map and the lane maps; pure SVG/HTML strings, no DOM.

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Which world bands are clear, dimmed and clouded, given the furthest band anyone stands in.
// Returns { dim: index | null, cloud: index | null } (cloud = first clouded band, all above it too).
export function fogBands(count, frontier) {
  const clear = Math.min(count - 1, frontier + 1);
  return { clear, dim: clear + 1 < count ? clear + 1 : null, cloud: clear + 2 < count ? clear + 2 : null };
}

// The last-revealed frontier per map, so newly revealed worlds can roll their clouds back once.
const KEY = 'stride-quest:fog';
export function seenFog(id) { try { return JSON.parse(localStorage.getItem(KEY))?.[id] ?? null; } catch { return null; } }
export function saveFog(id, clear) {
  try { const all = JSON.parse(localStorage.getItem(KEY)) || {}; all[id] = clear; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

const puffs = (W, y, seed) => {
  let out = '';
  for (let x = -20, k = seed; x < W + 40; x += 46, k++) {
    const r = 30 + ((k * 37) % 17);
    out += `<circle cx="${x}" cy="${y - 4 + ((k * 13) % 9)}" r="${r}"/>`;
  }
  return out;
};

// The summit: a snowy peak rising out of the clouds, with the athlete's goal planted on top.
// Who decides the label: summitText() below.
export function summitText(dream, track, goalInClouds) {
  const t = String(dream?.event || dream?.text || '').trim();
  const short = t.length > 30 ? `${t.slice(0, 29)}…` : t;
  if (!t) return '🎯 Set your dream';
  // The goal is already in sight on this map: the peak is whatever comes after it.
  if (dream?.target?.track === track && !goalInClouds) return 'Beyond your goal 🚀';
  return `🎯 Your goal: ${short}`;
}
function summit(W, y, label) {
  const cx = W / 2, tip = y + 100, base = tip + 160;
  const w = Math.max(110, label.length * 6.6 + 34);
  return `<g class="fog-summit" data-act="fog-summit" role="button" tabindex="0">
      <path d="M${cx - 150},${base} L${cx - 62},${tip + 70} L${cx - 40},${tip + 82} L${cx},${tip} L${cx + 52},${tip + 58} L${cx + 74},${tip + 50} L${cx + 160},${base}Z" fill="#8a9bb3"/>
      <path d="M${cx},${tip} L${cx + 52},${tip + 58} L${cx + 74},${tip + 50} L${cx + 160},${base} L${cx + 20},${base}Z" fill="#74869f"/>
      <path d="M${cx - 24},${tip + 34} L${cx},${tip} L${cx + 30},${tip + 34} L${cx + 16},${tip + 28} L${cx + 6},${tip + 40} L${cx - 8},${tip + 30}Z" fill="#fff"/>
      <circle class="fog-glow" cx="${cx}" cy="${tip - 26}" r="44" fill="url(#fog-glow)"/>
      <defs><radialGradient id="fog-glow"><stop offset="0" stop-color="#ffe082" stop-opacity=".9"/><stop offset="1" stop-color="#ffe082" stop-opacity="0"/></radialGradient></defs>
      <line x1="${cx}" y1="${tip}" x2="${cx}" y2="${tip - 40}" stroke="#5d4037" stroke-width="3"/>
      <path d="M${cx},${tip - 40} l26,8 l-26,8Z" fill="#e91e63"/>
      <g fill="#f4f6fa">${[-130, -80, -20, 40, 100, 150].map((dx, k) => `<circle cx="${cx + dx}" cy="${base - 8 + (k % 2) * 8}" r="${34 + (k % 3) * 6}"/>`).join('')}</g>
      <rect x="${cx - w / 2}" y="${tip - 84}" width="${w}" height="30" rx="15" fill="#fff" stroke="#e91e63" stroke-width="2.5"/>
      <text x="${cx}" y="${tip - 64}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="12" fill="#14213d">${esc(label)}</text>
    </g>`;
}

// How much of the clouded top to crop off: the map ends a short way above the cloud edge.
export const CLOUD_VIEW = 620;
export const cropTop = cloudBottom => (cloudBottom == null ? 0 : Math.max(0, cloudBottom - CLOUD_VIEW));

// dimTop/dimBottom: y range of the dimmed band. cloudBottom: y where the clouds end (everything above
// is hidden). reveal: { from, to } y range whose clouds roll back now. summitLabel: what the peak carries (the athlete's goal, or an invite to set one).
// top: the first y still shown after cropping (the summit sits just below it).
export function fogSvg({ W, dimTop, dimBottom, cloudBottom, hint, summitLabel, top = 0, reveal = null }) {
  let out = '<g class="fog" data-act="fog">';
  if (dimTop != null) out += `<rect class="fog-dim" x="0" y="${dimTop}" width="${W}" height="${dimBottom - dimTop}"/>`;
  if (cloudBottom != null) {
    out += `<defs><linearGradient id="fog-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd8e6"/><stop offset="1" stop-color="#eef2f7"/></linearGradient></defs>
      <rect x="0" y="0" width="${W}" height="${cloudBottom}" fill="url(#fog-sky)"/>
      <g class="fog-puffs back" fill="#e6ebf2">${[[60, 330], [300, 250], [150, 470]].map(([x, dy]) => `<ellipse cx="${x}" cy="${top + dy}" rx="70" ry="22"/><ellipse cx="${x + 40}" cy="${top + dy - 14}" rx="44" ry="20"/>`).join('')}</g>
      <g class="fog-puffs" fill="#f4f6fa">${puffs(W, cloudBottom, 1)}</g>
      <g class="fog-puffs back" fill="#e3e9f1">${puffs(W, cloudBottom - 60, 4)}</g>`;
    const mid = Math.max(top + 440, cloudBottom - 130);
    out += `<text x="${W / 2}" y="${mid}" text-anchor="middle" class="fog-q">? ? ?</text>
      <text x="${W / 2}" y="${mid + 30}" text-anchor="middle" class="fog-hint">${esc(hint)}</text>`;
    out += summit(W, top + 110, summitLabel);
  }
  out += '</g>';
  // Clouds rolling back over the worlds just revealed (removed by CSS animation end).
  if (reveal) out += `<g class="fog-reveal"><rect x="0" y="${reveal.from}" width="${W}" height="${reveal.to - reveal.from}" fill="#eef2f7"/>
      <g fill="#f4f6fa">${puffs(W, reveal.to, 2)}</g></g>`;
  return out;
}

// The "look ahead" button sits on the cloud edge (y as a share of the map height).
export const peekButton = (y, H) => `<button class="fog-peek" data-act="fog-peek" style="top:${((y / H) * 100).toFixed(2)}%">👀 Look ahead</button>`;
