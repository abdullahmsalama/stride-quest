// Tiny synthesized sound effects (Web Audio API, no audio files).
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
