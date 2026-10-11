// Stride Quest coach proxy. Holds the API keys and tries free providers in order:
// Gemini -> Groq -> OpenRouter. The browser never sees a key.
//
// POST /chat  { messages: [{ role: 'user'|'assistant', content }], context: string }
//   -> { reply, actions, provider }   or 503 { error } when every provider fails
// POST /chat  { mode: 'understand', task: 'dream', text }  -> { result, provider }
// Actions are only SUGGESTIONS: the app validates them and the athlete taps Apply.

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

Answer format: a JSON object {"reply": string, "actions": array}.
"actions" are plan changes you SUGGEST; the athlete reviews and taps Apply in the app. Use [] when nothing should change.
Allowed actions (use only these, at most 2, only when clearly helpful; when unsure, suggest nothing and ask a question instead):
- {"type":"start_sick","where":"above"|"below","reason":string} they are sick NOW. "above" = only above-neck symptoms (runny nose, mild sore throat); "below" = fever, chest, body aches, stomach.
- {"type":"start_busy","reason":string} busy or travelling this week.
- {"type":"end_mode","reason":string} they feel better / back to normal, and the state shows a mode is on.
- {"type":"report_pain","redFlag":boolean,"reason":string} ONLY for real pain or injury: pain above 3/10, pain that changes how they move, or a diagnosed injury. NOT for normal tightness, stiffness or muscle soreness after training (give mobility and easy-day advice instead, no action). redFlag true ONLY when they mention one of: sharp pain, swelling, pain at night or at rest, pain while walking, recent fracture or surgery. Moderate pain without those signs: redFlag false (and suggest a physio check in the reply).
- {"type":"move_session","key":string,"day":0-6,"reason":string} move a planned session; key copied exactly from the WEEK PLAN lines; "day" is REQUIRED, an integer, 0 = Monday ... 6 = Sunday, today or later.
- {"type":"set_days","days":[0-6,...],"longDay":0-6,"reason":string} change training days (at least 2).
- {"type":"set_dream","text":string,"event":string,"date":"YYYY-MM-DD" or "","reason":string} they state a new goal or race.
If you suggest an action, say in the reply that they can tap Apply below.
Runner state (from the app):
`;

const UNDERSTAND = `You read what an athlete typed about their dream goal and return JSON only:
{"track":"run"|"tri"|"hybrid"|"none","distance":"5k"|"10k"|"half"|"marathon"|"ultra"|"supersprint"|"sprint"|"olympic"|"70.3"|"full"|"hyrox"|"alphax"|"other"|"none","targetMinutes":number or null,"event":string,"date":"YYYY-MM-DD" or "","summary":string}
"summary" is one short, encouraging sentence that restates the goal, e.g. "Run a 10K in under 50 minutes at the Dubai 10K".
Today is TODAY. If they give a month or season without a year, pick the next one.`;

const UNDERSTAND_LIFTS = `An athlete describes lifts or strength tests they know (machines, other exercises, reps, maxes). Estimate, conservatively, the heaviest BACK SQUAT and DEADLIFT they could do for 5 clean reps, and their strict pull-ups. Return JSON only:
{"squat5Kg": number or null, "deadlift5Kg": number or null, "pullups": number or null, "bodyweightKg": number or null, "confidence": "low"|"medium"|"high", "summary": string}
Rules: use standard conversions (1RM about weight x (1 + reps/30); a 5-rep weight is about 86% of the 1RM). Machines and dumbbells translate to lower barbell numbers: a goblet squat 5-rep weight x about 2-2.5 gives a back squat 5-rep weight; a leg press translates to roughly 40-50% for a back squat; a kettlebell swing or DB RDL x about 2 for a deadlift. Without hinge data, a deadlift is usually about 1.2-1.3 x the back squat. When unsure, estimate lower. Use null when there is nothing to go on. Convert pounds to kg. "summary" is one short sentence, e.g. "Squat about 60 kg x 5 and deadlift about 80 kg x 5, estimated from your leg press and kettlebell work".`;

const LIFTS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    squat5Kg: { type: 'NUMBER', nullable: true }, deadlift5Kg: { type: 'NUMBER', nullable: true }, pullups: { type: 'NUMBER', nullable: true },
    bodyweightKg: { type: 'NUMBER', nullable: true }, confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] }, summary: { type: 'STRING' },
  },
  required: ['confidence', 'summary'],
};

const CHECK = `You review an athlete's questionnaire answers (JSON) for likely MISTAKES before a training plan is built.
Look for: unit mix-ups (kg vs lb, km vs miles, minutes vs hours, metres vs km), impossible or inconsistent numbers (e.g. a 10K pace faster than the 5K pace, a squat far above world records, a longest run much longer than weekly distance), and answers that contradict each other.
Typical example: a bodyweight above about 130 with lifts in kg often means the bodyweight was typed in lb (176 lb = 80 kg). Do NOT judge ambition or fitness, and do not flag things that are simply unusual but possible. Return JSON only: {"issues": [{"field": string, "message": string}]} with at most 3 issues.
"field" must be one of the input keys. "message" is one short, friendly sentence that says what looks off and asks a question. Return {"issues": []} when everything looks fine.`;

const CHECK_SCHEMA = {
  type: 'OBJECT',
  properties: { issues: { type: 'ARRAY', items: { type: 'OBJECT', properties: { field: { type: 'STRING' }, message: { type: 'STRING' } }, required: ['field', 'message'] } } },
  required: ['issues'],
};

const UNDERSTAND_SCHEMA = {
  type: 'OBJECT',
  properties: {
    track: { type: 'STRING', enum: ['run', 'tri', 'hybrid', 'none'] },
    distance: { type: 'STRING', enum: ['5k', '10k', 'half', 'marathon', 'ultra', 'supersprint', 'sprint', 'olympic', '70.3', 'full', 'hyrox', 'alphax', 'other', 'none'] },
    targetMinutes: { type: 'NUMBER', nullable: true }, event: { type: 'STRING' }, date: { type: 'STRING' }, summary: { type: 'STRING' },
  },
  required: ['track', 'distance', 'summary'],
};

const ACTION_TYPES = new Set(['start_sick', 'start_busy', 'end_mode', 'report_pain', 'move_session', 'set_days', 'set_dream']);
const CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    actions: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      type: { type: 'STRING', enum: [...ACTION_TYPES] }, reason: { type: 'STRING' }, where: { type: 'STRING' }, key: { type: 'STRING' },
      day: { type: 'INTEGER' }, days: { type: 'ARRAY', items: { type: 'INTEGER' } }, longDay: { type: 'INTEGER' },
      redFlag: { type: 'BOOLEAN' }, text: { type: 'STRING' }, event: { type: 'STRING' }, date: { type: 'STRING' } }, required: ['type'] } },
  },
  required: ['reply', 'actions'],
};

// Parse the model's JSON; fall back to plain text with no actions.
function parseChat(raw) {
  try {
    const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
    const d = JSON.parse(t);
    const reply = typeof d.reply === 'string' && d.reply.trim() ? d.reply.trim() : null;
    if (!reply) return { reply: raw, actions: [] };
    const actions = (Array.isArray(d.actions) ? d.actions : []).filter(a => a && ACTION_TYPES.has(a.type)).slice(0, 2);
    return { reply, actions };
  } catch { return { reply: raw, actions: [] }; }
}

const MAX_MESSAGES = 12;
const MAX_CHARS = 2000;
const TIMEOUT_MS = 12000;
const HEDGE_MS = 3500; // if the main Gemini model hasn't answered by then, also ask the next one

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

// Gemini models from GEMINI_MODELS (comma-separated), "hedged": the next model starts when the
// previous one fails or is still silent after HEDGE_MS. The first good answer wins.
async function gemini(env, system, messages, schema) {
  if (!env.GEMINI_API_KEY) throw new Error('no key');
  const models = (env.GEMINI_MODELS || 'gemini-flash-latest').split(',').map(m => m.trim()).filter(Boolean);
  return new Promise((resolve, reject) => {
    const errs = [];
    let started = 0, finished = 0, done = false, timer = null;
    const launch = () => {
      if (done || started >= models.length) return;
      const model = models[started++];
      clearTimeout(timer);
      timer = setTimeout(launch, HEDGE_MS);
      geminiModel(env, model, system, messages, schema)
        .then(text => { if (!done) { done = true; clearTimeout(timer); resolve(text); } })
        .catch(e => {
          errs.push(`${model}: ${e.message}`);
          finished++;
          if (done) return;
          if (started < models.length) launch();
          else if (finished >= started) { clearTimeout(timer); reject(new Error(errs.join('; '))); }
        });
    };
    launch();
  });
}

async function geminiModel(env, model, system, messages, schema) {
  const res = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 2000, // room for the model's thinking tokens
        ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!text) throw new Error('gemini empty');
  return text;
}

async function openaiStyle(url, key, model, system, messages, extraHeaders = {}, json = false) {
  const res = await withTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature: 0.7,
      max_tokens: 700,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('empty');
  return text;
}

const PROVIDERS = [
  // Each provider: (env, system, messages, schema) -> raw text. A schema asks for JSON output.
  ['gemini', gemini],
  ['groq', (env, sys, msgs, schema) => {
    if (!env.GROQ_API_KEY) throw new Error('no key');
    return openaiStyle('https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY, env.GROQ_MODEL || 'llama-3.3-70b-versatile', sys, msgs, {}, !!schema);
  }],
  ['xai', (env, sys, msgs, schema) => {
    if (!env.XAI_API_KEY) throw new Error('no key'); // optional, usually paid
    return openaiStyle('https://api.x.ai/v1/chat/completions', env.XAI_API_KEY, env.XAI_MODEL || 'grok-3-mini', sys, msgs, {}, !!schema);
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

    if (body.mode === 'understand') {
      const text = String(body.text || '').slice(0, body.task === 'check' ? 2000 : 300).trim();
      if (!text) return json({ error: 'no text' }, 400, headers);
      const lifts = body.task === 'lifts', check = body.task === 'check';
      const sys = check ? CHECK : lifts ? UNDERSTAND_LIFTS : UNDERSTAND.replace('TODAY', new Date().toISOString().slice(0, 10));
      for (const [name, call] of PROVIDERS) {
        try {
          const raw = await call(env, sys, [{ role: 'user', content: text }], check ? CHECK_SCHEMA : lifts ? LIFTS_SCHEMA : UNDERSTAND_SCHEMA);
          const result = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
          return json({ result, provider: name }, 200, headers);
        } catch { /* try the next provider */ }
      }
      return json({ error: 'Could not read that right now.' }, 503, headers);
    }
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length || messages.at(-1).role !== 'user') return json({ error: 'no user message' }, 400, headers);
    const system = SYSTEM + String(body.context || '').slice(0, 3000);

    const errors = [];
    for (const [name, call] of PROVIDERS) {
      try {
        const raw = await call(env, system, messages, CHAT_SCHEMA);
        const { reply, actions } = parseChat(raw);
        return json({ reply, actions, provider: name }, 200, headers);
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }
    console.log('all providers failed', errors.join('; '));
    return json({ error: 'All coach providers are busy right now.' }, 503, headers);
  },
};
