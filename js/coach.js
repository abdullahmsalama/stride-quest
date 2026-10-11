import { WORKER_URL } from './config.js';
import { activeTrack, nextStep, runLevel } from './engine.js';
import { offlineActions } from './actions.js';

// Ask the coach. Uses the Worker when configured, falls back to the offline coach otherwise.
export async function askCoach(messages, context, state) {
  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL.replace(/\/$/, '')}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) return { reply: data.reply, actions: Array.isArray(data.actions) ? data.actions : [], provider: data.provider };
      if (res.status === 429) return { reply: data.error || 'Too many messages. Give it a minute.', provider: 'limit' };
    } catch { /* network error: fall through */ }
  }
  const last = messages.at(-1)?.content || '';
  return { reply: offlineReply(last, state), actions: offlineActions(last, state), provider: 'offline' };
}

// Ask the AI to read free text (e.g. the dream). Resolves to null when offline or unsure.
export async function understand(task, text) {
  if (!WORKER_URL || !String(text || '').trim()) return null;
  try {
    const res = await fetch(`${WORKER_URL.replace(/\/$/, '')}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'understand', task, text }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? data.result || null : null;
  } catch { return null; }
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
