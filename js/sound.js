// Sound effects: mostly synthesized (Web Audio API); the swimmer uses short public-domain water
// recordings from Wikimedia Commons (sounds/), with the synth as a fallback while they load.
const KEY = 'stride-quest:sound';
let ctx = null, master = null;

export function soundOn() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
export function setSound(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  if (master) master.gain.value = on ? 1 : 0;
}

// Must run inside a user gesture (a click) the first time, or browsers keep audio blocked.
export function unlockAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = soundOn() ? 1 : 0;
    master.connect(ctx.destination);
    loadClips();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

const ready = () => { if (ctx?.state === 'suspended') ctx.resume(); return ctx && master && soundOn(); };

export const audioState = () => (ctx ? ctx.state : 'none');

// Unlock on the first tap anywhere, so sound works however the intro is reached.
if (typeof document !== 'undefined') {
  const first = () => { unlockAudio(); document.removeEventListener('pointerdown', first, true); document.removeEventListener('keydown', first, true); };
  document.addEventListener('pointerdown', first, true);
  document.addEventListener('keydown', first, true);
}

function tone(freq, { type = 'sine', dur = 0.12, vol = 0.2, slideTo = null, delay = 0 } = {}) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

// Recorded clips, decoded once after the first tap.
const CLIP_FILES = { stroke: 'sounds/stroke.mp3', stroke2: 'sounds/stroke2.mp3', splash: 'sounds/splash.mp3', pool: 'sounds/pool.mp3',
  grunt1: 'sounds/grunt1.mp3', grunt2: 'sounds/grunt2.mp3', grunt3: 'sounds/grunt3.mp3', heave: 'sounds/heave.mp3' };
const clips = {};
function loadClips() {
  for (const [k, url] of Object.entries(CLIP_FILES)) {
    fetch(url).then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)))
      .then(buf => { clips[k] = buf; }).catch(() => { /* synth fallback */ });
  }
}
function clip(name, { vol = 0.8, rate = 1, loop = false } = {}) {
  if (!ready() || !clips[name]) return null;
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = clips[name]; src.playbackRate.value = rate; src.loop = loop;
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start();
  return { stop(fade = 0.3) { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, fade / 3); src.stop(t + fade + 0.05); } };
}

// Speech bubble pop.
export const pop = () => tone(520, { type: 'sine', dur: 0.1, vol: 0.3, slideTo: 980 });

// Passing a level: notes climb a pentatonic scale, arcade style.
const SCALE = [0, 2, 4, 7, 9];
export function levelDing(i) {
  const semis = SCALE[i % 5] + 12 * Math.floor(i / 5);
  const f = 523.25 * Math.pow(2, semis / 12);
  tone(f, { type: 'triangle', dur: 0.2, vol: 0.3 });
  tone(f * 2, { type: 'sine', dur: 0.12, vol: 0.08, delay: 0.02 });
}

// Footstep tick.
export const step = () => tone(160, { type: 'sine', dur: 0.06, vol: 0.22, slideTo: 70 });

// Arrival fanfare.
export function fanfare() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { type: 'triangle', dur: i === 3 ? 0.6 : 0.16, vol: 0.32, delay: i * 0.12 }));
  [659.25, 783.99].forEach(f => tone(f, { type: 'sine', dur: 0.6, vol: 0.12, delay: 0.36 }));
}

// Continuous "blitz" whoosh whose loudness and pitch follow the runner's speed (0..1).
export function whoosh() {
  if (!ready()) return { set() {}, stop() {} };
  const src = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(bp).connect(g).connect(master);
  src.start();
  return {
    set(speed) {
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(0.06 + 0.22 * speed, t, 0.08);
      bp.frequency.setTargetAtTime(500 + 2200 * speed, t, 0.1);
    },
    stop() {
      const t = ctx.currentTime;
      g.gain.setTargetAtTime(0, t, 0.12);
      src.stop(t + 0.6);
    },
  };
}

// ---------- character sounds (lane maps) ----------
function burst({ freq = 1200, q = 1, dur = 0.15, vol = 0.25, type = 'bandpass', delay = 0 } = {}) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const src = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}
// One freestyle stroke: a real water recording (alternating arms, slightly varied), or a soft
// low-passed swish while the clips load.
let arm = 0;
const splash = () => {
  arm ^= 1;
  if (clip(arm ? 'stroke' : 'stroke2', { vol: 0.55, rate: 0.92 + Math.random() * 0.16 })) return;
  burst({ freq: 800, q: 0.5, dur: 0.3, vol: 0.3, type: 'lowpass' });
};
const tick = () => tone(4200, { type: 'square', dur: 0.012, vol: 0.06 });
const pull = () => burst({ freq: 700, q: 0.6, dur: 0.38, vol: 0.28, type: 'lowpass' });
const heavyStep = () => tone(110, { type: 'sine', dur: 0.09, vol: 0.3, slideTo: 55 });
export function clank() {
  [523, 1437, 2381, 3301].forEach((f, i) => tone(f, { type: 'sine', dur: 0.5 - i * 0.08, vol: 0.12 }));
  [587, 1611, 2690].forEach((f, i) => tone(f, { type: 'sine', dur: 0.4 - i * 0.08, vol: 0.1, delay: 0.16 }));
}
export function bell() { tone(2093, { type: 'sine', dur: 0.35, vol: 0.18 }); tone(2637, { type: 'sine', dur: 0.35, vol: 0.12, delay: 0.18 }); }
export function bigSplash() { if (clip('splash', { vol: 0.8 })) return; burst({ freq: 900, q: 0.5, dur: 0.5, vol: 0.4 }); burst({ freq: 2200, q: 0.8, dur: 0.3, vol: 0.2, delay: 0.08 }); }

// Sled push: a gritty scrape of the sled on the ground, pulsing with each drive of the legs.
function scrape() {
  const src = noise(), lp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 900; bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.7;
  g.gain.value = 0.12; lfo.frequency.value = 1.6; depth.gain.value = 0.08; // ~ one surge per step
  lfo.connect(depth).connect(g.gain);
  src.connect(lp).connect(bp).connect(g).connect(master);
  src.start(); lfo.start();
  return () => { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.1); src.stop(t + 0.5); lfo.stop(t + 0.5); };
}
// Effort grunts (public-domain recordings); a little higher for women's characters.
let gi = 0;
const grunt = (sex, vol = 0.5) => { gi = (gi + 1) % 3; clip(`grunt${gi + 1}`, { vol, rate: (sex === 'f' ? 1.3 : 1) * (0.94 + Math.random() * 0.1) }); };
// Lifting a plate off the ground and loading the sled: a heave, then the clank.
export function plateLoad(sex) {
  if (!ready()) return;
  if (!clip('heave', { vol: 0.6, rate: sex === 'f' ? 1.3 : 1 })) heavyStep();
  setTimeout(clank, 520);
}

// A sound that loops while a character travels; returns a stop() function.
export function moveLoop(lane, { sex } = {}) {
  if (!ready()) return () => {};
  if (lane === 'engine') {
    // Sled push: scrape all the way, a grunt on every other drive.
    const stopScrape = scrape();
    let n = 0;
    const id = setInterval(() => { heavyStep(); if (n++ % 2 === 0) grunt(sex); }, 620);
    grunt(sex);
    return () => { clearInterval(id); stopScrape(); };
  }
  const every = { swim: 640, bike: 75, run: 270, strength: 330, engine: 560 }[lane] || 300;
  const play = { swim: splash, bike: tick, run: step, strength: heavyStep, engine: pull }[lane] || step;
  const wind = lane === 'bike' ? whoosh() : null;
  wind?.set(0.35);
  const pool = lane === 'swim' ? clip('pool', { vol: 0.35, loop: true }) : null; // pool-hall ambience under the strokes
  const id = setInterval(play, every);
  play();
  return () => { clearInterval(id); wind?.stop(); pool?.stop(0.6); };
}

// The arrival sound for each character.
export function arrive(lane) {
  if (!ready()) return;
  if (lane === 'swim') bigSplash();
  else if (lane === 'bike') bell();
  else if (lane === 'strength') { clank(); setTimeout(playShout, 450); }
  else if (lane === 'engine') { pull(); setTimeout(pull, 180); setTimeout(() => levelDing(4), 380); }
  else levelDing(2);
}

// The athlete's own recorded (or uploaded) lifting shout, stored on this device.
const SHOUT_KEY = 'stride-quest:shout';
export const hasShout = () => { try { return !!localStorage.getItem(SHOUT_KEY); } catch { return false; } };
export function saveShout(dataUrl) { localStorage.setItem(SHOUT_KEY, dataUrl); }
export function clearShout() { try { localStorage.removeItem(SHOUT_KEY); } catch { /* ignore */ } }
export function playShout() {
  if (!soundOn()) return;
  // Your own clip if you added one; otherwise the device's voice says it.
  let url = null;
  try { url = localStorage.getItem(SHOUT_KEY); } catch { /* ignore */ }
  if (url) new Audio(url).play().catch(() => say('Light weight, baby!', { pitch: 0.55, rate: 0.95 }));
  else say('Light weight, baby!', { pitch: 0.55, rate: 0.95 });
}

// Short spoken lines through the device's own voice (no recordings).
export function say(text, { pitch = 1, rate = 1 } = {}) {
  if (!soundOn() || typeof speechSynthesis === 'undefined') return;
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = pitch; u.rate = rate; u.volume = 1;
  speechSynthesis.speak(u);
}
