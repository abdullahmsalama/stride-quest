import { WORKER_URL } from './config.js';
import { activeTrack, nextStep, runLevel } from './engine.js';
import { offlineActions } from './actions.js';

// Ask the coach. Uses the Worker when configured, falls back to the offline coach otherwise.
// Friendly words for why the AI couldn't answer (never a raw 403 / 429 / 503).
export const AI_TROUBLE = {
  busy: 'The free AI is busy right now (it has a limit on how much it can answer). Try again in a minute.',
  slow: 'The AI took too long to answer. Try again in a moment.',
  down: "The AI can't be reached right now. Check your connection, or try again in a minute.",
};
// "gemini-3.8-flash" -> "Gemini 3.8 Flash", for the "via … · free tier" label.
export const prettyModel = m => String(m || 'AI').split('/').pop().replace(/-latest$/, '').replace(/-versatile$|-instruct(:free)?$/, '').split(/[-/]/)
  .map(w => (/^\d/.test(w) ? w.toUpperCase() : w[0]?.toUpperCase() + w.slice(1))).join(' ').replace(/\bGpt\b/, 'GPT');

// fetch with a time limit, joined to an optional outside signal (the Stop button).
async function timedFetch(url, init, ms, outer) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), ms);
  const onOuter = () => ctrl.abort('stopped');
  outer?.addEventListener('abort', onOuter);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  catch (e) { throw ctrl.signal.reason === 'stopped' ? Object.assign(new Error('stopped'), { name: 'AbortError' }) : ctrl.signal.reason === 'timeout' ? new Error('timeout') : e; }
  finally { clearTimeout(timer); outer?.removeEventListener('abort', onOuter); }
}

// Ask the coach. Uses the Worker when configured, falls back to the offline coach otherwise.
// `signal` lets the athlete stop a reply mid-way: it then resolves to { aborted: true }.
export async function askCoach(messages, context, state, smart = false, app = '', signal = null) {
  let reason = null;
  if (WORKER_URL) {
    try {
      const res = await timedFetch(`${WORKER_URL.replace(/\/$/, '')}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context, smart, app }),
      }, smart ? 75000 : 45000, signal);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) return { reply: data.reply, actions: Array.isArray(data.actions) ? data.actions : [], provider: data.provider, model: data.model, tier: data.tier };
      reason = res.status === 429 ? 'busy' : data.reason || 'down';
    } catch (e) { if (e?.name === 'AbortError') return { aborted: true }; reason = e?.message === 'timeout' ? 'slow' : 'down'; }
  }
  const last = messages.at(-1)?.content || '';
  return { reply: offlineReply(last, state), actions: offlineActions(last, state), provider: 'offline', reason };
}

// Ask the AI to read free text (e.g. the dream). Resolves to null when offline or unsure.
export async function understand(task, text) {
  if (!WORKER_URL || !String(text || '').trim()) return null;
  try {
    const res = await timedFetch(`${WORKER_URL.replace(/\/$/, '')}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'understand', task, text }),
    }, 45000);
    const data = await res.json().catch(() => ({}));
    return res.ok ? data.result || null : null;
  } catch { return null; }
}

// A conversation with the AI about the questionnaire answers (the answer check).
// Resolves to { result, model, tier } or { result: null, reason } (busy / slow / down).
export async function understandChat(task, messages) {
  if (!WORKER_URL || !messages?.length) return { result: null, reason: 'down' };
  try {
    const res = await timedFetch(`${WORKER_URL.replace(/\/$/, '')}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'understand', task, messages }),
    }, 75000);
    const data = await res.json().catch(() => ({}));
    return res.ok && data.result ? { result: data.result, model: data.model, tier: data.tier } : { result: null, reason: res.status === 429 ? 'busy' : data.reason || 'down' };
  } catch (e) { return { result: null, reason: e?.message === 'timeout' ? 'slow' : 'down' }; }
}

// Rule-based answers so the app is useful with no LLM at all.
function offlineReply(text, s) {
  const t = text.toLowerCase();
  const track = activeTrack(s);
  const next = nextStep(s, track);
  const lvl = runLevel(s.run.level);
  if (/(sharp|swell|numb|chest|dizz|faint|night pain|can't walk|cannot walk)/.test(t)) {
    return 'That needs a professional. Stop training today and see a physio or doctor. When you are cleared, the Rebuild Track will bring you back safely.';
  }
  if (/(pain|hurt|sore|injur|ache)/.test(t)) {
    return 'Rate it 0-10. Up to 2/10 is fine to train with. At 3-4, repeat easier work. At 5 or more, stop, and use the Rebuild Track (Me > Report pain). Soreness that fades in a day or two is normal; pain that sharpens or lingers is not.';
  }
  if (/(today|what should|next|plan|do now)/.test(t)) {
    if (s.rebuild.active) return `You are on the Rebuild Track. Next: ${next ? next.title : 'your next Rebuild step'}. Keep pain at 2/10 or less.`;
    return next ? `Next up: ${next.title}.${next.detail ? ` ${next.detail}` : ''} Keep it easy, and log your pain after.` : 'All steps are done for now. Take a rest-day check-in or do your daily orders.';
  }
  if (/(level|xp|star|gate|unlock)/.test(t)) {
    return `You are on Level ${lvl.n}, ${lvl.name}. Earn 70% of the level's XP to open the gate test. Pass the gate (pain 2/10 or less the next morning) to move up. All steps = 2 stars; no week missed = 3 stars.`;
  }
  if (/(pace|easy|slow|fast|speed)/.test(t)) {
    return 'Most runs should feel easy: you can speak in full sentences. Speed work unlocks as your Prep stage grows, because fast running needs strong landing and take-off first.';
  }
  if (/(motivat|tired|lazy|skip|busy)/.test(t)) {
    return 'Small counts. A 10-minute walk or a daily order keeps your streak alive. Consistency beats big days.';
  }
  return 'I am the offline coach right now, so I keep it simple. Ask me what to do today, about pain, about your level, or about pacing.';
}

// ---------- voice ----------
const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const canListen = !!Recognition;
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function listen({ onText, onEnd }) {
  if (!Recognition) return null;
  const rec = new Recognition();
  rec.lang = navigator.language || 'en-US';
  rec.interimResults = true;
  rec.onresult = e => onText(Array.from(e.results).map(r => r[0].transcript).join(''), e.results[e.results.length - 1].isFinal);
  rec.onend = onEnd;
  rec.onerror = onEnd;
  rec.start();
  return rec;
}

export function speak(text) {
  if (!canSpeak) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ''));
  u.lang = navigator.language || 'en-US';
  speechSynthesis.speak(u);
}
