// First-placement intro: the avatar blitzes from START to the placed level, joking about the
// levels it skips and greeting cheering characters on the way. Ends with confetti.
import { POINTS, runAvatar, segMid, addToMap, bubble } from './map.js';
import { RUN_LEVELS } from './data/tracks.js';
import * as sfx from './sound.js';

const PASS_LINES = [
  'EAAASY 😎', 'Is this the warm-up?', 'Not even sweating 💧', 'Skip! ⏭️', 'Zoom zoom 💨', 'Too easy, next!',
  'Hold my water bottle 🥤', 'Legs feel fresh!', 'Strava or it didn\'t happen 📸', 'Been there, done that',
  'Speedrun mode 🎮', 'Who put a level here?', 'Nap time? Later.', 'Cardio? Never heard of her',
];
const LEVEL_LINES = {
  1: 'Starting line? Already started 🏁',
  3: 'First steps… done ✔️',
  4: '5K? That\'s a warm-up',
  6: 'Sub-30? Cute.',
  7: '10K before breakfast 🥐',
  9: 'Half? Make it whole.',
  11: 'Marathon? Just a long jog',
};
// Friendly race-day characters along the route: they cheer, the runner says hi back.
const CHARACTERS = [
  { e: '🏃', me: 'On your left! 👋', says: 'Go get it! 🔥' },
  { e: '📣', me: 'Thanks! 🙌', says: 'You got this!' },
  { e: '🥤', me: 'Grabbing water 💧', says: 'Stay hydrated!' },
  { e: '🥁', me: 'Love the beat! 🥁', says: 'Boom boom, GO!' },
  { e: '🐕', me: 'Good dog! 🐾', says: 'Woof woof! 🎉' },
  { e: '🙋', me: 'High five! ✋', says: 'Up top! ✋' },
  { e: '🎉', me: 'Party on the course!', says: 'Looking strong!' },
];
const ARRIVE_LINES = [
  'Why did they make me wait so long?',
  'The first levels asked for your autograph.',
  'The early levels never saw you coming.',
  'Your shoes needed that warm-up.',
];

const pick = (list, i) => list[((i % list.length) + list.length) % list.length];

export function playPlacementIntro(placed, { follow, onDone, onLevel, gate }) {
  let skipped = false;
  const levels = placed;
  const seed = Math.floor(Math.random() * 1000);
  const t0 = performance.now();

  // Cheering characters on alternate segments along the route.
  const npcs = [];
  for (let n = 2; n < placed; n += 2) {
    const mid = segMid(n);
    if (!mid) continue;
    const who = pick(CHARACTERS, seed + n);
    const x = mid.x + 18;
    const g = addToMap(`<g transform="translate(${x},${mid.y})"><g class="npc-inner"><ellipse cy="2" rx="9" ry="3" fill="rgba(0,0,0,.2)"/><text y="0" text-anchor="middle" font-size="22">${who.e}</text></g></g>`, 0, 'npc');
    npcs.push({ seg: n, x, y: mid.y, who, g, passed: false, reacted: false });
  }

  // HUD
  const hud = document.createElement('div');
  hud.className = 'speedrun';
  hud.innerHTML = `<span class="sr-label">⚡ SPEEDRUN</span><b class="sr-time">0.0s</b><span class="sr-level">Level 0 / ${placed}</span><button class="sr-mute" type="button" aria-label="Sound">${sfx.soundOn() ? '🔊' : '🔇'}</button><button class="sr-skip" type="button">Skip ⏩</button>`;
  document.body.appendChild(hud);
  hud.querySelector('.sr-skip').addEventListener('click', () => { skipped = true; });
  hud.querySelector('.sr-mute').addEventListener('click', e => { const on = !sfx.soundOn(); sfx.setSound(on); e.currentTarget.textContent = on ? '🔊' : '🔇'; if (on) sfx.unlockAudio(); });

  // Slow-mo: ease down to ~quarter speed while a speech bubble is up, then speed back up.
  let slowUntil = 0, speed = 1;
  const rate = () => {
    const target = performance.now() < slowUntil ? 0.25 : 1;
    speed += (target - speed) * (target < speed ? 0.2 : 0.06);
    return speed;
  };
  const say = (x, y, text, opts = {}) => {
    slowUntil = Math.max(slowUntil, performance.now() + (opts.hold ?? 1250));
    sfx.pop();
    return bubble(x, y, text, { ttl: 3200, ...opts });
  };
  const wind = sfx.whoosh();
  let lastStep = 0;
  const timeEl = hud.querySelector('.sr-time'), levelEl = hud.querySelector('.sr-level');

  let lastSeg = -1, lastDust = 0;
  const duration = Math.min(12000, 1800 + placed * 780);

  runAvatar(0, placed, {
    duration,
    ease: 'blitz',
    follow,
    skip: () => skipped,
    gate,
    rate,
    onProgress: ({ seg, frac, pt, dir }) => {
      const now = performance.now();
      timeEl.textContent = `${((now - t0) / 1000).toFixed(1)}s`;
      // Passing a level node (segment index changed): count it and trash-talk.
      if (seg !== lastSeg) {
        for (let n = lastSeg + 1; n < seg + 1; n++) {
          if (n < 1 || skipped) continue;
          levelEl.textContent = `Level ${n} / ${placed}`;
          onLevel?.(n);
          const node = POINTS[n];
          const flag = addToMap(`<g transform="translate(${node.x},${node.y})"><circle class="burst" r="20" fill="none" stroke="#ffd23f" stroke-width="4"/></g>`, 700);
          if (flag) flag.setAttribute('class', 'pass-burst');
          sfx.levelDing(n - 1);
          say(node.x, node.y - 70, LEVEL_LINES[n] || pick(PASS_LINES, seed + n * 3));
        }
        lastSeg = seg;
      }
      // Saying hi to the characters on the course.
      for (const c of npcs) {
        if (skipped) break;
        const onSeg = seg + 1 === c.seg;
        if (!c.passed && (onSeg && frac > 0.35 || seg + 1 > c.seg)) {
          c.passed = true;
          say(pt.x, pt.y - 82, c.who.me, { hold: 800 });
          c.g.classList.add('spin');
        }
        if (c.passed && !c.reacted && (onSeg && frac > 0.75 || seg + 1 > c.seg)) {
          c.reacted = true;
          setTimeout(() => say(c.x, c.y - 26, c.who.says, { tone: 'npc', hold: 0 }), 250);
        }
      }
      // Sound follows the speed: louder, brighter whoosh and faster steps when blitzing.
      wind.set(skipped ? 0 : speed);
      if (!skipped && now - lastStep > 70 / Math.max(0.3, speed)) { lastStep = now; sfx.step(); }
      // Dust puffs behind the runner.
      if (now - lastDust > 55 && !skipped) {
        lastDust = now;
        addToMap(`<circle class="dust" cx="${pt.x - dir * 8}" cy="${pt.y - 15}" r="4"/>`, 600);
      }
    },
    onDone: () => {
      wind.stop();
      sfx.fanfare();
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      levelEl.textContent = `Level ${placed} / ${placed}`;
      hud.classList.add('done');
      setTimeout(() => hud.remove(), 1600);
      document.querySelectorAll('.worldmap .npc').forEach(n => n.remove());
      const node = POINTS[placed];
      bubble(node.x, node.y - 82, placed > 1 ? 'Made it! 🎉' : 'Every legend starts here 💪', { ttl: 6000 });
      confetti();
      setTimeout(() => onDone({
        secs: skipped ? null : secs,
        skippedLevels: levels - 1,
        line: pick(ARRIVE_LINES, seed),
        level: RUN_LEVELS[placed - 1],
      }), 2200);
    },
  });
}

export function confetti(count = 110) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#ff6b35', '#ffd23f', '#29a0e0', '#7cb342', '#e91e63', '#ffffff'];
  box.innerHTML = Array.from({ length: count }, (_, i) => {
    const left = Math.random() * 100, delay = Math.random() * 0.6, dur = 2.2 + Math.random() * 1.6;
    const size = 6 + Math.random() * 7, rot = Math.random() * 360, drift = (Math.random() - 0.5) * 160;
    return `<i style="left:${left}%;width:${size}px;height:${size * 0.45}px;background:${colors[i % colors.length]};animation-delay:${delay}s;animation-duration:${dur}s;--rot:${rot}deg;--drift:${drift}px"></i>`;
  }).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4500);
}
