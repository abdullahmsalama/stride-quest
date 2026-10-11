// Stride Quest coach proxy. Holds the API keys and tries free providers in order:
// Gemini -> Groq -> OpenRouter. The browser never sees a key.
//
// POST /chat  { messages: [{ role: 'user'|'assistant', content }], context: string }
//   -> { reply, provider }   or 503 { error } when every provider fails

const SYSTEM = `You are "Coach", the friendly running coach inside Stride Quest, a game-style running app.
Rules:
- The app decides levels, XP, gates and pain rules. Never change or promise a level; explain the plan the app gives.
- Keep answers short (under 120 words), warm and practical.
- Be genuinely motivating, especially for beginners, people starting from zero and people coming back from injury.
  Celebrate small wins, normalise walking and slow pace, never shame. Follow the Tone line in the runner state. Use the runner's current step when relevant.
- You are not a doctor. For sharp pain, swelling, pain at night, pain while walking, numbness, chest pain,
  dizziness or anything worrying: tell them to stop and see a physio or doctor.
- Never push through pain above 2/10. Prefer easy effort, consistency and recovery.
- If asked about something unrelated to running, fitness, recovery or the app, gently steer back.
Runner state (from the app):
`;

const MAX_MESSAGES = 12;
const MAX_CHARS = 2000;
const TIMEOUT_MS = 20000;

// Best-effort per-IP limit. Memory is per Worker instance, so this is a speed bump, not a wall.
const hits = new Map();
function limited(ip, perMinute) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > perMinute;
}

function cors(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return {
    ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    },
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

async function withTimeout(url, init) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function gemini(env, system, messages) {
  if (!env.GEMINI_API_KEY) throw new Error('no key');
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
  if (!text) throw new Error('gemini empty');
  return text;
}

async function openaiStyle(url, key, model, system, messages, extraHeaders = {}) {
  const res = await withTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty');
  return text;
}

const PROVIDERS = [
  ['gemini', gemini],
  ['groq', (env, sys, msgs) => {
    if (!env.GROQ_API_KEY) throw new Error('no key');
    return openaiStyle('https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY, env.GROQ_MODEL || 'llama-3.3-70b-versatile', sys, msgs);
  }],
  ['openrouter', (env, sys, msgs) => {
    if (!env.OPENROUTER_API_KEY) throw new Error('no key');
    return openaiStyle('https://openrouter.ai/api/v1/chat/completions', env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', sys, msgs,
      { 'HTTP-Referer': env.SITE_URL || 'https://github.com', 'X-Title': 'Stride Quest' });
  }],
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const { ok, headers } = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true }, 200, headers);
    if (url.pathname !== '/chat' || request.method !== 'POST') return json({ error: 'not found' }, 404, headers);
    if (!ok) return json({ error: 'origin not allowed' }, 403, headers);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (limited(ip, parseInt(env.RATE_PER_MINUTE || '10', 10))) return json({ error: 'Too many messages, slow down a little.' }, 429, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, headers); }
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length || messages.at(-1).role !== 'user') return json({ error: 'no user message' }, 400, headers);
    const system = SYSTEM + String(body.context || '').slice(0, 3000);

    const errors = [];
    for (const [name, call] of PROVIDERS) {
      try {
        const reply = await call(env, system, messages);
        return json({ reply, provider: name }, 200, headers);
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }
    console.log('all providers failed', errors.join('; '));
    return json({ error: 'All coach providers are busy right now.' }, 503, headers);
  },
};
