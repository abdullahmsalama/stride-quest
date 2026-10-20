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
Allowed actions (use only these, at most 3, only when clearly helpful; when unsure, suggest nothing and ask a question instead):
- {"type":"start_sick","where":"above"|"below","reason":string} they are sick NOW. "above" = only above-neck symptoms (runny nose, mild sore throat); "below" = fever, chest, body aches, stomach.
- {"type":"start_busy","reason":string} busy or travelling this week.
- {"type":"end_mode","reason":string} they feel better / back to normal, and the state shows a mode is on.
- {"type":"report_pain","redFlag":boolean,"reason":string} ONLY for real pain or injury: pain above 3/10, pain that changes how they move, or a diagnosed injury. NOT for normal tightness, stiffness or muscle soreness after training (give mobility and easy-day advice instead, no action). redFlag true ONLY when they mention one of: sharp pain, swelling, pain at night or at rest, pain while walking, recent fracture or surgery. Moderate pain without those signs: redFlag false (and suggest a physio check in the reply).
- {"type":"move_session","key":string,"day":0-6,"reason":string} move a planned session; key copied exactly from the WEEK PLAN lines; "day" is REQUIRED, an integer, 0 = Monday ... 6 = Sunday, today or later.
- {"type":"change_session","key":string,"title":string,"detail":string,"reason":string} rewrite ONE planned session for this week only: shorter, easier, longer, different (e.g. tempo -> easy 30 min, long run 45 -> 30 min, swap a run for a bike). key copied exactly from the WEEK PLAN lines. "title" is the new session in the app's style with its length, e.g. "Easy run 30 min" or "Long easy run 55 min"; "detail" one short line of how to do it. Rules the app enforces: tests, gates and races can't be changed; at most 25% longer (or +10 min) than planned; never longer or harder during Rebuild or sick mode.
- {"type":"skip_session","key":string,"reason":string} rest instead of a planned session this week (very tired, sore, life); it comes back next week.
- {"type":"set_days","days":[0-6,...],"longDay":0-6,"reason":string} change training days (at least 2).
- {"type":"set_dream","text":string,"event":string,"date":"YYYY-MM-DD" or "","reason":string} they state a new goal or race.
- {"type":"update_numbers", ...numbers, "reason":string} when they give real numbers that should change their placement or say a level looks wrong. Numbers (kg, minutes, km, metres; convert lb, miles and h:mm): "bodyweightKg","squat5Kg","deadlift5Kg" (heaviest for 5 clean reps; a 1-rep max x 0.86),"pullups","row1000Min","best5kMin","best10kMin","longestRunKm","weeklyKm","swimM","rideKm". Only include numbers they actually gave. The app re-runs its placement rules and shows the change.
- {"type":"level_down","track":"run"|"strength"|"engine"|"swim"|"bike"|"prep","reason":string} when they say a level is too hard or they want to go back.
If you suggest an action, say in the reply that they can tap Apply below or reply \"confirm\".
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

const CHECK = `You help an athlete check their questionnaire answers before a training plan is built. You talk WITH them: they can explain, correct or ask, and you can propose changes to their answers.
The first message is their answers as JSON, plus DERIVED figures the app computed. Later messages are the conversation.

What each answer means (read carefully, do not guess other meanings):
- runsPerWeek: average number of runs PER WEEK over the last 4 weeks.
- weeklyKm: running distance per week, km. longestKm / longestTime: longest single run in the last 2 months.
- best5kText / best10kText: a time (mm:ss or h:mm:ss); *Mode "time" = total time, "pace" = minutes per km.
- continuous: how long they can run without stopping. daysPerWeek: days they can train.
- bodyweight, squat5, deadlift5: in liftUnit (kg or lb); liftMode "5" = weight for 5 reps, "1" = 1-rep max. pullups: strict reps.
- swimDist / swimM: longest continuous swim. longestRide / rideKm: longest ride, km. row1000Text: 1000 m row time.
- sex, dream, dreamEvent, dreamDate: who they are and what they want.
- tracks: the sports they train for (run, hybrid = lifting + race stations, tri = swim + bike + run). They do ONLY these: never assume other activities.

Flag ONLY clear mistakes: unit mix-ups (kg/lb, km/miles, minutes/hours, m/km), impossible numbers, or answers that truly contradict each other. Use the DERIVED figures. Hard limits, do not flag inside them:
- kmPerRun between 1 and 35 is normal (50 km over 3 runs = ~17 km per run is a normal experienced runner).
- longestShareOfWeek up to 60% is normal. 5K pace 2:50-12:00 per km is possible. A 10K pace slower than the 5K pace is normal.
- Lifts up to 3x bodyweight (squat) and 3.5x (deadlift) are possible. Unusual but possible is fine. Never judge ambition. Never repeat an issue the athlete has already explained.

Reply JSON only:
{"reply": short friendly answer to the athlete's last message (one or two sentences; on the first message, summarise what you checked),
 "issues": up to 3 current problems [{"field": an answer key, "message": one friendly sentence that asks a question}],
 "changes": answer changes the athlete asked for or confirmed [{"field": an answer key, "value": the new value as text, "why": a few words}]}
Only propose a change when the athlete said the new value or clearly confirmed it. Values use the same format as the answers (numbers as plain numbers, times as mm:ss).`;

const CHECK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    issues: { type: 'ARRAY', items: { type: 'OBJECT', properties: { field: { type: 'STRING' }, message: { type: 'STRING' } }, required: ['field', 'message'] } },
    changes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { field: { type: 'STRING' }, value: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['field', 'value'] } },
  },
  required: ['reply', 'issues', 'changes'],
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

const ACTION_TYPES = new Set(['start_sick', 'start_busy', 'end_mode', 'report_pain', 'move_session', 'change_session', 'skip_session', 'set_days', 'set_dream', 'update_numbers', 'level_down']);
const CHAT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING' },
    actions: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      type: { type: 'STRING', enum: [...ACTION_TYPES] }, reason: { type: 'STRING' }, where: { type: 'STRING' }, key: { type: 'STRING' },
      day: { type: 'INTEGER' }, days: { type: 'ARRAY', items: { type: 'INTEGER' } }, longDay: { type: 'INTEGER' },
      redFlag: { type: 'BOOLEAN' }, title: { type: 'STRING' }, detail: { type: 'STRING' }, text: { type: 'STRING' }, event: { type: 'STRING' }, date: { type: 'STRING' }, track: { type: 'STRING' },
      bodyweightKg: { type: 'NUMBER' }, squat5Kg: { type: 'NUMBER' }, deadlift5Kg: { type: 'NUMBER' }, pullups: { type: 'NUMBER' }, row1000Min: { type: 'NUMBER' },
      best5kMin: { type: 'NUMBER' }, best10kMin: { type: 'NUMBER' }, longestRunKm: { type: 'NUMBER' }, weeklyKm: { type: 'NUMBER' }, swimM: { type: 'NUMBER' }, rideKm: { type: 'NUMBER' } }, required: ['type'] } },
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
    const actions = (Array.isArray(d.actions) ? d.actions : []).filter(a => a && ACTION_TYPES.has(a.type)).slice(0, 3);
    return { reply, actions };
  } catch { return { reply: raw, actions: [] }; }
}

const MAX_MESSAGES = 12;
const MAX_CHARS = 4000; // room for an answer pasted from the athlete's own AI app
const TIMEOUT_MS = 12000;
const SMART_TIMEOUT_MS = 45000; // the smart coach thinks longer
const HEDGE_MS = 5500; // if the main Gemini model hasn't answered by then, also ask the next one

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

async function withTimeout(url, init, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
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

async function geminiModel(env, model, system, messages, schema, smart = false) {
  const res = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.6, maxOutputTokens: smart ? 8000 : 2000, // room for the model's thinking tokens
        ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) },
    }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (text) lastModel = model;
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

let lastModel = null;
// Which model answered, for the "via … · free tier" label in the app (Gemini sets lastModel itself).
const modelFor = (name, env) => (name.startsWith('gemini') ? lastModel
  : name === 'groq' ? env.GROQ_MODEL || 'llama-3.3-70b-versatile' : name === 'xai' ? env.XAI_MODEL || 'grok-3-mini' : name === 'openrouter' ? env.OPENROUTER_MODEL || 'openrouter' : name);
const tierFor = name => (name === 'xai' ? 'paid' : 'free');
// A plain reason when every provider failed, so the app can say something friendly instead of a code.
const failReason = errs => (errs.length && errs.every(e => /429|quota|RESOURCE_EXHAUSTED|no key/i.test(e)) && errs.some(e => /429|quota|RESOURCE/i.test(e)) ? 'busy'
  : errs.some(e => /abort|timeout/i.test(e)) ? 'slow' : 'down');
// Extra thinking for the smart coach (Gemini 3.x uses thinkingLevel).
const THINK = { 'gemini-3.8-flash': { thinkingLevel: 'high' }, 'gemini-3-flash-preview': { thinkingLevel: 'high' } };

// The smart coach: bigger Gemini models with room to think. Falls back to the normal chain.
async function geminiSmart(env, system, messages, schema) {
  if (!env.GEMINI_API_KEY) throw new Error('no key');
  const models = (env.GEMINI_SMART_MODELS || 'gemini-3.8-flash,gemini-flash-latest,gemini-3-flash-preview').split(',').map(m => m.trim()).filter(Boolean);
  const errs = [];
  for (const model of models) {
    try {
      const res = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.5, maxOutputTokens: 8000, ...(THINK[model] ? { thinkingConfig: THINK[model] } : {}), ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}) },
        }),
      }, SMART_TIMEOUT_MS);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('').trim();
      if (text) { lastModel = model; return text; }
      throw new Error('empty');
    } catch (e) { errs.push(`${model}: ${e.message}`); }
  }
  throw new Error(errs.join('; '));
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

// ---------- anonymous comparisons (Stats tab, opt-in) ----------
// Plausible ranges keep typos and junk out. Times in minutes, lifts as 1-rep max ÷ bodyweight, FTP in W/kg.
const METRICS = {
  run5k: [12, 120, 'low'], run10k: [26, 240, 'low'], half: [58, 480, 'low'], marathon: [120, 720, 'low'],
  hyrox_open: [50, 240, 'low'], hyrox_pro: [50, 240, 'low'],
  squat: [0.2, 5, 'high'], deadlift: [0.3, 5.5, 'high'], ftp: [0.5, 7.5, 'high'], pullups: [0, 80, 'high'],
};
const SEXES = ['m', 'f'], AGES = ['18-29', '30-39', '40-49', '50-59', '60+'];
const MIN_GROUP = 50; // no percentage until a group has this many other athletes
const WRITES_PER_DAY = 30;

async function hashWho(ip, env) {
  const data = new TextEncoder().encode(`${ip}|${env.STATS_SALT || 'stride-quest'}|${new Date().toISOString().slice(0, 10)}`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Share of the group that you beat, and how big the group is (yourself excluded).
async function rank(env, metric, value, id, sex, age) {
  const dir = METRICS[metric][2];
  const where = `v.metric = ?1 AND v.id != ?2 AND a.sex = ?3${age ? ' AND a.age = ?4' : ''}`;
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN ${dir === 'low' ? 'v.value > ?5' : 'v.value < ?5'} THEN 1 ELSE 0 END) AS beat
    FROM vals v JOIN athletes a ON a.id = v.id WHERE ${where}`).bind(metric, id, sex, age, value).first();
  const n = row?.n || 0;
  return n >= MIN_GROUP ? { n, p: Math.round((100 * (row.beat || 0)) / n) } : { n, p: null };
}

// Of the athletes who have both numbers, the share at least as good as you at both.
async function bothRank(env, [m1, m2], v1, v2, id, sex) {
  const c1 = METRICS[m1][2] === 'low' ? 'x.value <= ?4' : 'x.value >= ?4', c2 = METRICS[m2][2] === 'low' ? 'y.value <= ?5' : 'y.value >= ?5';
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN ${c1} AND ${c2} THEN 1 ELSE 0 END) AS good
    FROM vals x JOIN vals y ON y.id = x.id AND y.metric = ?2 JOIN athletes a ON a.id = x.id
    WHERE x.metric = ?1 AND x.id != ?3 AND a.sex = ?6`).bind(m1, m2, id, v1, v2, sex).first();
  const n = row?.n || 0;
  return n >= MIN_GROUP ? { n, share: (row.good || 0) / n } : { n, share: null };
}

async function stats(request, env, headers) {
  if (!env.DB) return json({ error: 'stats not set up' }, 503, headers);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, headers); }
  const id = String(body.id || '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'bad id' }, 400, headers);
  if (body.delete) {
    await env.DB.batch([env.DB.prepare('DELETE FROM vals WHERE id = ?1').bind(id), env.DB.prepare('DELETE FROM athletes WHERE id = ?1').bind(id)]);
    return json({ deleted: true }, 200, headers);
  }
  const sex = SEXES.includes(body.sex) ? body.sex : null;
  if (!sex) return json({ error: 'pick men or women to compare' }, 400, headers);
  const age = AGES.includes(body.age) ? body.age : null;
  const values = Object.fromEntries(Object.entries(body.values || {})
    .filter(([k, v]) => METRICS[k] && typeof v === 'number' && v >= METRICS[k][0] && v <= METRICS[k][1]));

  const who = await hashWho(request.headers.get('CF-Connecting-IP') || 'unknown', env), day = new Date().toISOString().slice(0, 10);
  const w = await env.DB.prepare('SELECT n FROM writes WHERE who = ?1 AND day = ?2').bind(who, day).first();
  if (!w || w.n < WRITES_PER_DAY) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO writes (who, day, n) VALUES (?1, ?2, 1) ON CONFLICT (who, day) DO UPDATE SET n = n + 1').bind(who, day),
      env.DB.prepare('DELETE FROM writes WHERE day < ?1').bind(day),
      env.DB.prepare('INSERT INTO athletes (id, sex, age, updated) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (id) DO UPDATE SET sex = ?2, age = ?3, updated = ?4').bind(id, sex, age, Date.now()),
      env.DB.prepare('DELETE FROM vals WHERE id = ?1').bind(id),
      ...Object.entries(values).map(([k, v]) => env.DB.prepare('INSERT INTO vals (id, metric, value) VALUES (?1, ?2, ?3)').bind(id, k, v)),
    ]);
  }
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = { sex: await rank(env, k, v, id, sex, null), ...(age ? { age: await rank(env, k, v, id, sex, age) } : {}) };
  }
  const pair = Array.isArray(body.pair) && body.pair.length === 2 && body.pair.every(k => values[k] != null) ? body.pair : null;
  const both = pair ? await bothRank(env, pair, values[pair[0]], values[pair[1]], id, sex) : null;
  return json({ metrics: out, both, min: MIN_GROUP }, 200, headers);
}

// Anonymous tallies (no ID): "one more athlete is preparing for Alpha X". Only these keys count.
// app:open = a device opened the app (once), app:placed = finished the setup (once), app:day = active that day
// (once a day), track:x = which sports people picked.
const COUNT_KEYS = /^(view:(race-card|videos)|prep:(hyrox|alphax)(:(open|pro|base))?|site:(hyrox|alphax|calendar)|app:(open|placed|day)|track:(run|hybrid|tri|gym))$/;
async function tally(request, env, headers) {
  if (!env.DB) return json({ error: 'not set up' }, 503, headers);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, headers); }
  const key = String(body.key || '');
  if (!COUNT_KEYS.test(key)) return json({ error: 'unknown key' }, 400, headers);
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare('INSERT INTO counts (key, day, n) VALUES (?1, ?2, 1) ON CONFLICT (key, day) DO UPDATE SET n = n + 1').bind(key, day).run();
  return json({ ok: true }, 200, headers);
}

// ---------- exercise videos (YouTube search inside the app) ----------
// One YouTube search per exercise a week (the free quota is ~100 searches a day), then the athletes'
// 👍 / 👎 reorder the list for everyone, and videos suggested by 2+ athletes join it.
const VIDEO_TTL = 7 * 24 * 3600 * 1000;
const isoDuration = d => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ''); if (!m) return ''; const h = +m[1] || 0, mi = +m[2] || 0, se = +m[3] || 0; return h ? `${h}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')}` : `${mi}:${String(se).padStart(2, '0')}`; };
async function youtubeSearch(env, q) {
  const key = env.YOUTUBE_API_KEY;
  if (!key) throw new Error('no key');
  // Short form demos first (under 4 min), topped up with medium-length ones (4-20 min) if needed.
  const search = async duration => {
    const u = new URL('https://www.googleapis.com/youtube/v3/search');
    Object.entries({ part: 'snippet', type: 'video', maxResults: '8', q: `${q} how to form`, videoEmbeddable: 'true', safeSearch: 'strict', relevanceLanguage: 'en', videoDuration: duration, key }).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u);
    if (!r.ok) throw new Error(`youtube ${r.status}`);
    return (await r.json()).items || [];
  };
  let items = await search('short');
  if (items.length < 4) { const more = await search('medium'); items = [...items, ...more.filter(m => !items.some(i => i.id?.videoId === m.id?.videoId))]; }
  const ids = items.map(i => i.id?.videoId).filter(Boolean);
  const durs = {};
  if (ids.length) { // lengths: 1 quota unit
    const v = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${key}`);
    if (v.ok) for (const it of (await v.json()).items || []) durs[it.id] = isoDuration(it.contentDetails?.duration);
  }
  return items.filter(i => i.id?.videoId).map(i => ({ id: i.id.videoId, title: i.snippet.title, channel: i.snippet.channelTitle, thumb: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url, duration: durs[i.id.videoId] || '' }));
}
const cleanQ = q => String(q || '').toLowerCase().replace(/[^a-z0-9 +'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
async function videos(request, env, headers) {
  if (!env.DB) return json({ error: 'not set up' }, 503, headers);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, headers); }
  const q = cleanQ(body.q);
  if (!q) return json({ error: 'no query' }, 400, headers);
  const vid = String(body.id || '');
  if (body.vote) { // { q, id, vote: 1 | -1, undo: 1 | -1 | 0 }
    if (!/^[\w-]{11}$/.test(vid)) return json({ error: 'bad id' }, 400, headers);
    const up = (body.vote === 1 ? 1 : 0) - (body.undo === 1 ? 1 : 0), down = (body.vote === -1 ? 1 : 0) - (body.undo === -1 ? 1 : 0);
    await env.DB.prepare('INSERT INTO video_votes (q, id, up, down) VALUES (?1, ?2, MAX(?3, 0), MAX(?4, 0)) ON CONFLICT (q, id) DO UPDATE SET up = MAX(up + ?3, 0), down = MAX(down + ?4, 0)').bind(q, vid, up, down).run();
    return json({ ok: true }, 200, headers);
  }
  if (body.suggest) { // a pasted link: must be a real, embeddable YouTube video
    const id = (/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(String(body.suggest)) || [])[1];
    if (!id) return json({ error: 'That doesn\'t look like a YouTube link.' }, 400, headers);
    const o = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`);
    if (!o.ok) return json({ error: 'That video can\'t be played here (private, removed or not embeddable).' }, 400, headers);
    const meta = await o.json();
    await env.DB.prepare('INSERT INTO video_suggest (q, id, title, channel, n) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT (q, id) DO UPDATE SET n = n + 1').bind(q, id, String(meta.title || '').slice(0, 140), String(meta.author_name || '').slice(0, 80)).run();
    return json({ ok: true, video: { id, title: meta.title, channel: meta.author_name, thumb: meta.thumbnail_url, duration: '' } }, 200, headers);
  }
  let list = null, cached = false;
  const row = await env.DB.prepare('SELECT ts, json FROM video_cache WHERE q = ?1').bind(q).first();
  if (row && Date.now() - row.ts < VIDEO_TTL) { list = JSON.parse(row.json); cached = true; }
  if (!list) {
    try {
      list = await youtubeSearch(env, q);
      await env.DB.prepare('INSERT INTO video_cache (q, ts, json) VALUES (?1, ?2, ?3) ON CONFLICT (q) DO UPDATE SET ts = ?2, json = ?3').bind(q, Date.now(), JSON.stringify(list)).run();
    } catch (e) {
      if (row) list = JSON.parse(row.json); // stale is better than nothing
      else return json({ error: 'busy', reason: /403|429/.test(e.message) ? 'busy' : 'down' }, 503, headers);
    }
  }
  const sugg = (await env.DB.prepare('SELECT id, title, channel, n FROM video_suggest WHERE q = ?1 AND n >= 2').bind(q).all()).results || [];
  for (const sv of sugg) if (!list.some(v => v.id === sv.id)) list.push({ id: sv.id, title: sv.title, channel: sv.channel, thumb: `https://i.ytimg.com/vi/${sv.id}/mqdefault.jpg`, duration: '', suggested: sv.n });
  const votes = Object.fromEntries(((await env.DB.prepare('SELECT id, up, down FROM video_votes WHERE q = ?1').bind(q).all()).results || []).map(v => [v.id, v]));
  list = list.map((v, i) => ({ ...v, up: votes[v.id]?.up || 0, down: votes[v.id]?.down || 0, rank: i }))
    .filter(v => !(v.down >= 3 && v.down > 2 * v.up)) // clearly unhelpful: dropped
    .sort((a, b) => (b.up - b.down) - (a.up - a.down) || a.rank - b.rank)
    .slice(0, 6);
  return json({ q, videos: list, cached }, 200, headers);
}

// ---------- Strava (opt-in): log in with Strava, then read the athlete's own activities ----------
const STRAVA = 'https://www.strava.com';
const isDevice = d => /^[0-9a-f-]{36}$/.test(String(d || ''));
async function stravaToken(env, body, creds = null) {
  const r = await fetch(`${STRAVA}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: creds?.cid || env.STRAVA_CLIENT_ID, client_secret: creds?.secret || env.STRAVA_CLIENT_SECRET, ...body }) });
  if (!r.ok) throw new Error(`strava ${r.status}`);
  return r.json();
}
// Shared app: only devices Abdullah approved (or his own admin devices).
async function stravaAllowed(env, device) {
  if (await env.DB.prepare('SELECT 1 FROM strava_admins WHERE device = ?1').bind(device).first()) return true;
  return (await env.DB.prepare("SELECT status FROM strava_access WHERE device = ?1").bind(device).first())?.status === 'approved';
}
// A valid access token for this device (refreshed when it's about to expire).
async function stravaAccess(env, device, secret = null) {
  const row = await env.DB.prepare('SELECT * FROM strava WHERE device = ?1').bind(device).first();
  if (!row) return null;
  if (row.expires * 1000 > Date.now() + 120000) return row;
  if (row.cid && !secret) throw new Error('own app: secret needed');
  const t = await stravaToken(env, { grant_type: 'refresh_token', refresh_token: row.refresh }, row.cid ? { cid: row.cid, secret } : null);
  await env.DB.prepare('UPDATE strava SET access = ?2, refresh = ?3, expires = ?4 WHERE device = ?1').bind(device, t.access_token, t.refresh_token, t.expires_at).run();
  return { ...row, access: t.access_token, refresh: t.refresh_token, expires: t.expires_at };
}
async function strava(request, env, url, headers, ok) {
  if (!env.DB || !env.STRAVA_CLIENT_ID) return json({ error: 'Strava is not set up' }, 503, headers);
  const self = `${url.origin}/strava/callback`;
  const allowedReturn = u => { try { const o = new URL(u).origin; return (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o); } catch { return false; } };
  // 1) The app sends the athlete here; Strava asks them to allow read access.
  if (url.pathname === '/strava/connect') {
    const device = url.searchParams.get('device'), back = url.searchParams.get('return') || '';
    if (!isDevice(device) || !allowedReturn(back)) return new Response('Bad request', { status: 400 });
    // Own Strava app (credentials parked a moment ago), or the shared app (approved people only).
    const byo = await env.DB.prepare('SELECT cid FROM strava_byo WHERE device = ?1 AND ts > ?2').bind(device, Date.now() - 15 * 60000).first();
    if (!byo && !(await stravaAllowed(env, device))) { const b = new URL(back); b.searchParams.set('strava', 'not-approved'); return Response.redirect(b.toString(), 302); }
    const state = btoa(JSON.stringify({ device, back }));
    const go = new URL(`${STRAVA}/oauth/authorize`);
    Object.entries({ client_id: byo?.cid || env.STRAVA_CLIENT_ID, redirect_uri: self, response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read_all', state }).forEach(([k, v]) => go.searchParams.set(k, v));
    return Response.redirect(go.toString(), 302);
  }
  // 2) Strava sends them back with a code: swap it for tokens, then return to the app.
  if (url.pathname === '/strava/callback') {
    let st = {};
    try { st = JSON.parse(atob(url.searchParams.get('state') || '')); } catch { /* bad state */ }
    if (!isDevice(st.device) || !allowedReturn(st.back)) return new Response('Bad request', { status: 400 });
    const back = new URL(st.back);
    if (url.searchParams.get('error') || !url.searchParams.get('code')) { back.searchParams.set('strava', 'denied'); return Response.redirect(back.toString(), 302); }
    if (!/activity:read/.test(url.searchParams.get('scope') || '')) { back.searchParams.set('strava', 'scope'); return Response.redirect(back.toString(), 302); }
    try {
      const byo = await env.DB.prepare('SELECT cid, secret FROM strava_byo WHERE device = ?1').bind(st.device).first();
      const t = await stravaToken(env, { code: url.searchParams.get('code'), grant_type: 'authorization_code' }, byo);
      await env.DB.prepare('DELETE FROM strava_byo WHERE device = ?1').bind(st.device).run(); // their secret: gone
      if (!byo && !(await stravaAllowed(env, st.device))) { // went round the button: not approved for the shared app
        try { await fetch(`${STRAVA}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${t.access_token}` } }); } catch { /* ignore */ }
        back.searchParams.set('strava', 'not-approved'); return Response.redirect(back.toString(), 302);
      }
      const name = [t.athlete?.firstname, t.athlete?.lastname?.[0]].filter(Boolean).join(' ');
      await env.DB.prepare('INSERT INTO strava (device, athlete, name, access, refresh, expires, scope, ts, cid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT (device) DO UPDATE SET athlete = ?2, name = ?3, access = ?4, refresh = ?5, expires = ?6, scope = ?7, ts = ?8, cid = ?9')
        .bind(st.device, t.athlete?.id || null, name, t.access_token, t.refresh_token, t.expires_at, url.searchParams.get('scope'), Date.now(), byo?.cid || null).run();
      back.searchParams.set('strava', 'connected');
    } catch (e) { back.searchParams.set('strava', /403|limit/i.test(e.message) ? 'limit' : 'error'); }
    return Response.redirect(back.toString(), 302);
  }
  // 3) The app asks for its activities (and only its own), or disconnects.
  if (request.method !== 'POST') return json({ error: 'not found' }, 404, headers);
  if (!ok) return json({ error: 'origin not allowed' }, 403, headers);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, headers); }
  if (!isDevice(body.device)) return json({ error: 'bad device' }, 400, headers);
  const isAdmin = async d => !!(await env.DB.prepare('SELECT 1 FROM strava_admins WHERE device = ?1').bind(d).first());
  if (url.pathname === '/strava/status') {
    const a = await env.DB.prepare('SELECT status FROM strava_access WHERE device = ?1').bind(body.device).first();
    const admin = await isAdmin(body.device);
    const pending = admin ? (await env.DB.prepare("SELECT COUNT(*) AS n FROM strava_access WHERE status = 'pending'").first()).n : 0;
    return json({ status: admin ? 'approved' : a?.status || 'none', admin, pending }, 200, headers);
  }
  if (url.pathname === '/strava/request') {
    const name = String(body.name || '').trim().slice(0, 60), msg = String(body.msg || '').trim().slice(0, 300);
    if (!name) return json({ error: 'Add your name so Abdullah knows who you are.' }, 400, headers);
    const cur = await env.DB.prepare('SELECT status FROM strava_access WHERE device = ?1').bind(body.device).first();
    if (cur?.status === 'approved') return json({ status: 'approved' }, 200, headers);
    await env.DB.prepare("INSERT INTO strava_access (device, name, msg, status, ts) VALUES (?1, ?2, ?3, 'pending', ?4) ON CONFLICT (device) DO UPDATE SET name = ?2, msg = ?3, status = 'pending', ts = ?4").bind(body.device, name, msg, Date.now()).run();
    if (env.NTFY_TOPIC) { try { await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, { method: 'POST', body: `${name}${msg ? `: ${msg}` : ''}`, headers: { Title: 'Stride Quest: Strava access request', Tags: 'runner', Click: env.SITE_URL || '' } }); } catch { /* the in-app list still has it */ } }
    return json({ status: 'pending' }, 200, headers);
  }
  if (url.pathname === '/strava/claim') { // the owner, once, with the code they set as a Worker secret
    // Slows guessing down: each IP gets 3 tries a minute.
    if (limited(`claim:${request.headers.get('CF-Connecting-IP') || 'unknown'}`, 3)) return json({ error: 'Too many tries. Wait a minute.' }, 429, headers);
    if (!env.ADMIN_CLAIM) return json({ error: 'That code is not right.' }, 403, headers);
    if (String(body.code || '') !== env.ADMIN_CLAIM) return json({ error: 'That code is not right.' }, 403, headers);
    await env.DB.prepare('INSERT INTO strava_admins (device, ts) VALUES (?1, ?2) ON CONFLICT (device) DO NOTHING').bind(body.device, Date.now()).run();
    return json({ admin: true }, 200, headers);
  }
  if (url.pathname === '/strava/admin') {
    if (!(await isAdmin(body.device))) return json({ error: 'not admin' }, 403, headers);
    if (body.action === 'usage') { // the owner's view of the anonymous tallies: all time, last 7 days, today
      const today = new Date().toISOString().slice(0, 10), week = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
      const rows = (await env.DB.prepare('SELECT key, SUM(n) AS total, SUM(CASE WHEN day >= ?1 THEN n ELSE 0 END) AS week, SUM(CASE WHEN day = ?2 THEN n ELSE 0 END) AS today FROM counts GROUP BY key').bind(week, today).all()).results || [];
      return json({ usage: rows }, 200, headers);
    }
    if (['approve', 'decline', 'revoke'].includes(body.action) && isDevice(body.target)) {
      await env.DB.prepare('UPDATE strava_access SET status = ?2, decided = ?3 WHERE device = ?1').bind(body.target, body.action === 'approve' ? 'approved' : 'declined', Date.now()).run();
      if (body.action === 'revoke') await env.DB.prepare('DELETE FROM strava WHERE device = ?1 AND cid IS NULL').bind(body.target).run();
    }
    const list = (await env.DB.prepare('SELECT a.device, a.name, a.msg, a.status, a.ts, s.name AS strava FROM strava_access a LEFT JOIN strava s ON s.device = a.device ORDER BY a.ts DESC LIMIT 50').all()).results || [];
    const used = (await env.DB.prepare('SELECT COUNT(*) AS n FROM strava WHERE cid IS NULL').first()).n;
    return json({ requests: list, used }, 200, headers);
  }
  if (url.pathname === '/strava/byo') { // park their own app's credentials for the few minutes of connecting
    const cid = String(body.cid || '').trim(), secret = String(body.secret || '').trim();
    if (!/^\d{3,12}$/.test(cid) || !/^[0-9a-f]{20,64}$/i.test(secret)) return json({ error: 'That doesn\'t look like a Strava Client ID and Secret.' }, 400, headers);
    await env.DB.batch([env.DB.prepare('DELETE FROM strava_byo WHERE ts < ?1').bind(Date.now() - 15 * 60000),
      env.DB.prepare('INSERT INTO strava_byo (device, cid, secret, ts) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (device) DO UPDATE SET cid = ?2, secret = ?3, ts = ?4').bind(body.device, cid, secret, Date.now())]);
    return json({ ok: true }, 200, headers);
  }
  if (url.pathname === '/strava/disconnect') {
    const row = await env.DB.prepare('SELECT access FROM strava WHERE device = ?1').bind(body.device).first();
    if (row) { try { await fetch(`${STRAVA}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${row.access}` } }); } catch { /* still delete */ } }
    await env.DB.prepare('DELETE FROM strava WHERE device = ?1').bind(body.device).run();
    return json({ disconnected: true }, 200, headers);
  }
  if (url.pathname === '/strava/activities') {
    let row;
    try { row = await stravaAccess(env, body.device, body.secret || null); } catch (e) { return json({ connected: true, error: /secret/.test(e.message) ? 'own-app-secret' : 'refresh' }, 200, headers); }
    if (!row) return json({ connected: false }, 200, headers);
    const after = Math.max(0, Math.floor(+body.after || (Date.now() / 1000 - 14 * 86400)));
    const r = await fetch(`${STRAVA}/api/v3/athlete/activities?after=${after}&per_page=60`, { headers: { Authorization: `Bearer ${row.access}` } });
    if (r.status === 401) return json({ connected: false, error: 'Strava access was removed. Connect again.' }, 200, headers);
    if (r.status === 429) return json({ connected: true, error: 'busy' }, 200, headers);
    if (!r.ok) return json({ connected: true, error: `strava ${r.status}` }, 200, headers);
    const list = (await r.json()).map(a => ({ id: a.id, name: a.name, type: a.sport_type || a.type, start: a.start_date, local: a.start_date_local, km: Math.round((a.distance || 0) / 10) / 100,
      minutes: Math.round((a.moving_time || 0) / 6) / 10, elapsed: Math.round((a.elapsed_time || 0) / 6) / 10, hr: a.average_heartrate || null, maxHr: a.max_heartrate || null, climb: a.total_elevation_gain || 0, kj: a.kilojoules || null }));
    return json({ connected: true, name: row.name, activities: list }, 200, headers);
  }
  return json({ error: 'not found' }, 404, headers);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const { ok, headers } = cors(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers });
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true }, 200, headers);
    if (url.pathname === '/models' && ok && url.searchParams.get('p') === 'groq' && env.GROQ_API_KEY) {
      // Which Groq models this key can use (names only).
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` } });
      const d = await r.json().catch(() => ({}));
      return json({ status: r.status, models: (d.data || []).map(m => m.id) }, 200, headers);
    }
    if (url.pathname === '/models' && ok && env.GEMINI_API_KEY) {
      // Which Gemini models this key can use (names only), to configure the smart coach.
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
      const d = await r.json().catch(() => ({}));
      return json({ models: (d.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', '')) }, 200, headers);
    }
    if (url.pathname.startsWith('/strava/')) return strava(request, env, url, headers, ok);
    if (url.pathname === '/videos' && request.method === 'POST') {
      if (!ok) return json({ error: 'origin not allowed' }, 403, headers);
      if (limited(`v:${request.headers.get('CF-Connecting-IP') || 'unknown'}`, 30)) return json({ error: 'slow down' }, 429, headers);
      return videos(request, env, headers);
    }
    if (url.pathname === '/count' && request.method === 'POST') {
      if (!ok) return json({ error: 'origin not allowed' }, 403, headers);
      if (limited(`c:${request.headers.get('CF-Connecting-IP') || 'unknown'}`, 30)) return json({ error: 'slow down' }, 429, headers);
      return tally(request, env, headers);
    }
    if (url.pathname === '/stats' && request.method === 'POST') {
      if (!ok) return json({ error: 'origin not allowed' }, 403, headers);
      if (limited(`s:${request.headers.get('CF-Connecting-IP') || 'unknown'}`, 20)) return json({ error: 'slow down' }, 429, headers);
      return stats(request, env, headers);
    }
    if (url.pathname !== '/chat' || request.method !== 'POST') return json({ error: 'not found' }, 404, headers);
    if (!ok) return json({ error: 'origin not allowed' }, 403, headers);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (limited(ip, parseInt(env.RATE_PER_MINUTE || '10', 10))) return json({ error: 'Too many messages, slow down a little.' }, 429, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, headers); }

    if (body.mode === 'understand') {
      const lifts = body.task === 'lifts', check = body.task === 'check';
      // The answer check is a conversation: the answers first, then the athlete and the AI taking turns.
      const convo = check && Array.isArray(body.messages)
        ? body.messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(0, 14)
          .map((m, i) => ({ role: m.role, content: m.content.slice(0, i === 0 ? 3000 : 700) }))
        : null;
      const text = String(body.text || '').slice(0, check ? 3000 : 700).trim();
      if (!text && !convo?.length) return json({ error: 'no text' }, 400, headers);
      const sys = check ? CHECK : lifts ? UNDERSTAND_LIFTS : UNDERSTAND.replace('TODAY', new Date().toISOString().slice(0, 10));
      let chain = check ? [['gemini-smart', geminiSmart], ...PROVIDERS] : PROVIDERS; // the check: careful model first (~10 s), fast ones as backup
      if (body.debug && body.only) chain = chain.filter(([n]) => n === body.only); // testing one provider
      const tried = [];
      for (const [name, call] of chain) {
        try {
          const raw = await call(env, sys, convo?.length ? convo : [{ role: 'user', content: text }], check ? CHECK_SCHEMA : lifts ? LIFTS_SCHEMA : UNDERSTAND_SCHEMA);
          const result = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
          return json({ result, provider: name, model: modelFor(name, env), tier: tierFor(name) }, 200, headers);
        } catch (e) { tried.push(`${name}: ${String(e.message).slice(0, 160)}`); /* try the next provider */ }
      }
      console.log('understand failed', tried.join(' | '));
      return json({ error: 'Could not read that right now.', reason: failReason(tried), ...(body.debug ? { tried } : {}) }, 503, headers);
    }
    const messages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length || messages.at(-1).role !== 'user') return json({ error: 'no user message' }, 400, headers);
    // The app's own feature guide, for "how do I…" / "what is…" questions about the app itself.
    const app = String(body.app || '').slice(0, 2600);
    const system = SYSTEM + String(body.context || '').slice(0, 4500) + (app ? `\n\nHOW THE APP WORKS (use this to answer questions about the app itself and say which tab or button to use; never invent features that are not listed):\n${app}` : '');

    const errors = [];
    let chain = body.smart ? [['gemini-smart', geminiSmart], ...PROVIDERS] : PROVIDERS;
    if (body.debug && body.only) chain = chain.filter(([n]) => n === body.only); // testing one provider
    for (const [name, call] of chain) {
      try {
        const raw = await call(env, system, messages, CHAT_SCHEMA);
        const { reply, actions } = parseChat(raw);
        return json({ reply, actions, provider: name, model: modelFor(name, env), tier: tierFor(name), ...(body.debug ? { tried: errors } : {}) }, 200, headers);
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }
    console.log('all providers failed', errors.join('; '));
    return json({ error: 'All coach providers are busy right now.', reason: failReason(errors) }, 503, headers);
  },
};
