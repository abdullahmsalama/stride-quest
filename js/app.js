import * as E from './engine.js';
import { RUN_LEVELS, PREP_STAGES, REBUILD_STAGES, WORLDS } from './data/tracks.js';
import { EXERCISES, videoLink } from './data/exercises.js';
import * as store from './store.js';
import { askCoach, canListen, canSpeak, listen, speak } from './coach.js';
import * as M from './motivation.js';

// ---------- state ----------
let S = store.load();
if (!S || S.v !== 1) S = E.newState(Date.now());

const CHAT_KEY = 'stride-quest:chat';
const ui = {
  tab: 'today',
  ob: { step: 0, a: {} },
  retake: false,
  modal: null,
  dismissed: new Set(),
  openLevel: null,
  toasts: [],
  chat: readChat(),
  thinking: false,
  speakReplies: false,
  listening: null,
};

function readChat() { try { return JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch { return []; } }
function saveChat() { try { localStorage.setItem(CHAT_KEY, JSON.stringify(ui.chat.slice(-40))); } catch { /* ignore */ } }

function commit(next) { S = next; store.save(S); render(); }
const now = () => Date.now();
const $ = sel => document.querySelector(sel);
const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(messages) {
  for (const m of [].concat(messages)) {
    const id = Math.random().toString(36).slice(2);
    ui.toasts.push({ id, m });
    setTimeout(() => { ui.toasts = ui.toasts.filter(t => t.id !== id); renderToasts(); }, 4500);
  }
  renderToasts();
}

// ---------- onboarding ----------
const GOALS = [['fit', 'Get fit and healthy'], ['first5k', 'Run my first 5K'], ['faster', 'Get faster'], ['longer', 'Run longer distances'], ['race', 'Train for a race']];
const RUNS = [[0, 'None'], [2, '1-3 runs'], [6, '4-8 runs'], [10, '9-12 runs'], [14, '13 or more']];
const CONTINUOUS = [['none', "I don't run yet"], ['jogwalk20', 'Jog/walk mix for about 20 min'], ['10-15', '10-15 min without stopping'], ['20-30', '20-30 min'], ['30-45', '30-45 min'], ['45-75', '45-75 min'], ['75-120', '75 min - 2 h'], ['120+', 'Over 2 h']];
const RED_FLAGS = [['sharp', 'Sharp or stabbing pain'], ['swelling', 'Swelling'], ['night', 'Pain at night or at rest'], ['walking', 'Pain while walking'], ['recent', 'Recent fracture or surgery']];
const SELF_TEST = [
  ['t0', 'Knee-to-wall: knee touches the wall with your toes ~10 cm away, both sides, no pain', 'knee_to_wall'],
  ['t1', 'Stand on one leg for 30s, each side, without touching down', 'single_leg_balance'],
  ['t2', '20+ single-leg calf raises each leg, and a step-down without the knee caving in', 'calf_raise_single'],
  ['t3', '10 quiet, controlled landings from a low step, on one leg', 'single_leg_stick'],
];

const radio = (name, opts, cur) => `<div class="choices">${opts.map(([v, l]) =>
  `<label class="choice"><input type="radio" name="${name}" value="${h(v)}" ${String(cur) === String(v) ? 'checked' : ''}><span>${h(l)}</span></label>`).join('')}</div>`;
const check = (name, label, cur) => `<label class="choice"><input type="checkbox" name="${name}" ${cur ? 'checked' : ''}><span>${label}</span></label>`;
const num = (name, label, cur, unit) => `<label class="field"><span>${h(label)}</span><span class="with-unit"><input type="number" inputmode="decimal" min="0" step="any" name="${name}" value="${cur ?? ''}"><em>${h(unit)}</em></span></label>`;

function obSteps(a) {
  const steps = [
    { title: "Let's find your starting level", body: `
        <label class="field"><span>Your name (optional)</span><input type="text" name="name" value="${h(a.name || '')}" maxlength="40" autocomplete="given-name"></label>
        <p class="q">Main goal</p>${radio('goal', GOALS, a.goal)}` },
    { title: 'How many times did you run in the last 4 weeks?', body: radio('runsLast4w', RUNS, a.runsLast4w) },
    { title: 'Longest you can run without stopping?', body: radio('continuous', CONTINUOUS, a.continuous) },
    { title: 'Your running volume', body: `${num('weeklyKm', 'Roughly how many km per week lately?', a.weeklyKm, 'km')}${num('longestKm', 'Longest run in the last 2 months?', a.longestKm, 'km')}` },
    { title: 'Recent best times (optional)', body: `<p class="hint">Last 6 months. Leave empty if you don't know.</p>
        ${num('best5k', 'Best 5K', a.best5k, 'min')}${num('best10k', 'Best 10K', a.best10k, 'min')}
        <div class="choices">${check('halfDone', 'I have finished a half marathon', a.halfDone)}${check('marathonDone', 'I have finished a marathon', a.marathonDone)}${check('ultraDone', 'I have finished an ultra', a.ultraDone)}</div>` },
    { title: 'Any pain or injury right now?', body: `${radio('pain', [['none', 'No pain'], ['mild', 'Mild or nagging (3/10 or less)'], ['more', 'More than that, or a diagnosed injury']], a.pain)}
        <label class="field"><span>Where? (optional)</span><input type="text" name="painWhere" value="${h(a.painWhere || '')}" maxlength="60" placeholder="e.g. left knee, right Achilles"></label>
        <p class="q">Any of these?</p><div class="choices">${RED_FLAGS.map(([k, l]) => check(`rf_${k}`, h(l), (a.redFlags || []).includes(k))).join('')}</div>` },
    { title: 'How many days a week can you train?', body: radio('daysPerWeek', [[2, '2 days'], [3, '3 days'], [4, '4 days'], [5, '5 days'], [6, '6 days']], a.daysPerWeek ?? 3) },
  ];
  if (E.qualifyingLevel(normalize(a)) >= 3) {
    steps.push({ title: 'Quick body check', body: `<p class="hint">Tick what you can do today. Not sure? Try it now. Each has a demo link.</p>
      <div class="choices">${SELF_TEST.map(([k, l, ex]) => `${check(k, `${h(l)} <a href="${videoLink(ex)}" target="_blank" rel="noopener">demo</a>`, a.selfTest?.[k])}`).join('')}</div>` });
  }
  steps.push({ title: 'Your starting point', result: true });
  return steps;
}

function normalize(a) {
  const n = v => (v === '' || v == null || isNaN(parseFloat(v)) ? 0 : parseFloat(v));
  return {
    ...a,
    runsLast4w: n(a.runsLast4w), weeklyKm: n(a.weeklyKm), longestKm: n(a.longestKm),
    best5k: n(a.best5k) || null, best10k: n(a.best10k) || null,
    continuous: a.continuous || 'none', pain: a.pain || 'none', daysPerWeek: n(a.daysPerWeek) || 3,
  };
}

function collectOb() {
  const form = $('#ob-form');
  if (!form) return;
  const a = ui.ob.a;
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) a[el.name] = el.value; }
    else if (el.type === 'checkbox') {
      if (el.name.startsWith('rf_')) {
        const k = el.name.slice(3);
        a.redFlags = (a.redFlags || []).filter(x => x !== k).concat(el.checked ? [k] : []);
      } else if (/^t\d$/.test(el.name)) { a.selfTest = { ...(a.selfTest || {}), [el.name]: el.checked }; }
      else a[el.name] = el.checked;
    } else a[el.name] = el.value;
  }
}

function renderOnboarding() {
  const steps = obSteps(ui.ob.a);
  const i = Math.min(ui.ob.step, steps.length - 1);
  const st = steps[i];
  const back = i > 0 ? '<button type="button" class="btn ghost" data-act="ob-back">Back</button>' : '';
  const returning = S.needsReassessment ? `<div class="banner info">Welcome back! A quick re-assessment places you again. You won't start more than 3 levels below Level ${S.needsReassessment.oldLevel}.</div>` : '';
  let body;
  if (st.result) {
    const preview = E.placeFromAnswers(S, normalize(ui.ob.a), now());
    const lvl = E.runLevel(preview.placed);
    const w = E.worldOf(lvl);
    const ps = PREP_STAGES[preview.state.prep.level];
    const rb = preview.state.rebuild;
    body = `<div class="result">
        <div class="result-badge">${w.emoji}</div>
        <p class="eyebrow">${h(w.name)}</p>
        <h2>Level ${lvl.n} · ${h(lvl.name)}</h2>
        <p>You qualify for Level ${preview.qualifying}. You start one level below it so the first wins come quickly. Pass the gates to climb back up fast.</p>
        <p><strong>Prep Track:</strong> P${ps.n} ${h(ps.name)} (${h(ps.focus)})</p>
        ${rb.active ? `<div class="banner warn"><strong>Rebuild Track first.</strong> Because you reported pain, you start with the Rebuild Track. Your level is saved and you come back to it afterwards.${rb.seeProfessional ? ' Please get it checked by a physio or doctor first.' : ''}</div>` : ''}
        <p class="hint">Coming in Phase 2: upload Strava/Garmin files or screenshots to verify this.</p>
      </div>`;
  } else body = st.body;
  $('#app').innerHTML = `
    <main class="onboarding">
      <div class="ob-top"><div class="brand">🏃 Stride Quest</div><div class="progress"><div style="width:${((i + 1) / steps.length) * 100}%"></div></div></div>
      ${returning}
      <form id="ob-form" class="card ob-card" autocomplete="off">
        <h1>${h(st.title)}</h1>
        ${body}
        <div class="row end">${back}${st.result ? '<button type="button" class="btn primary" data-act="ob-finish">Start my journey</button>' : '<button type="submit" class="btn primary">Next</button>'}</div>
      </form>
    </main>`;
}

// ---------- shell ----------
function render() {
  if (!S.placedAt || S.needsReassessment || ui.retake) { renderOnboarding(); renderModal(); return; }
  const t = now();
  const views = { today: viewToday, map: viewMap, coach: viewCoach, me: viewMe };
  $('#app').innerHTML = `
    <header class="top">
      <div class="brand">🏃 Stride Quest</div>
      <div class="chips"><span class="chip" title="Total XP">⚡ ${S.xp} XP</span><span class="chip" title="Day streak">🔥 ${E.dayStreak(S, t)}</span></div>
    </header>
    <main class="view view-${ui.tab}">${views[ui.tab]()}</main>
    <nav class="tabs">${[['today', '🏠', 'Today'], ['map', '🗺️', 'Map'], ['coach', '💬', 'Coach'], ['me', '👤', 'Me']].map(([k, i, l]) =>
      `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</nav>`;
  queueModals();
  renderModal();
  if (ui.tab === 'coach') { const log = $('.chat-log'); if (log) log.scrollTop = log.scrollHeight; }
}

function queueModals() {
  if (ui.modal) return;
  const t = now();
  if (E.returnCheck(S, t).needed && !ui.dismissed.has('return')) ui.modal = { type: 'return', step: 0 };
  else if (E.pendingChecks(S, t).length && !ui.dismissed.has('morning')) ui.modal = { type: 'morning' };
}

function banners() {
  const out = [];
  if (S.rebuild.active && S.rebuild.redFlag) out.push(`<div class="banner danger"><strong>Running is paused.</strong> You reported warning signs. Please see a physio or doctor. Gentle mobility is still open. <button class="link" data-act="cleared">I've been cleared</button></div>`);
  else if (S.rebuild.active) out.push(`<div class="banner warn"><strong>Rebuild Track · R${S.rebuild.stage + 1} ${h(REBUILD_STAGES[S.rebuild.stage].name)}.</strong> Your Run level ${S.rebuild.savedRunLevel} is saved. Keep pain at 2/10 or less.${S.rebuild.seeProfessional ? ' Not medical advice: a physio check is a good idea.' : ''}</div>`);
  if (S.refresher) out.push(`<div class="banner info"><strong>Refresher course.</strong> Welcome back! Start with the Prove It run: hit it and you skip the rest.</div>`);
  const blockedAt = E.prepBlocksRun(S);
  if (blockedAt != null) out.push(`<div class="banner info"><strong>Gate passed!</strong> Level ${S.run.level + 1} unlocks at Prep stage P${blockedAt}. Keep going on the Prep Track.</div>`);
  if (S.run.reclaim) out.push(`<div class="banner reclaim">🔒 <strong>Reclaim:</strong> ${h(E.runLevel(S.run.reclaim).name)} (Level ${S.run.reclaim}) is waiting for you.</div>`);
  return out.join('');
}

const STATUS_ICON = { done: '✅', provisional: '⏳', open: '<span class="dot"></span>', locked: '🔒', slot: '🧱' };
const TYPE_LABEL = { run: 'Run', prep: 'Prep', slot: 'Prep slot', rest: 'Rest', gate: 'Gate', proveit: 'Prove It' };

function stepRow(track, st) {
  const clickable = st.status === 'open' || st.status === 'slot';
  return `<li class="step ${st.status} t-${st.type}">
      <button ${clickable ? `data-act="open-step" data-track="${track}" data-idx="${st.idx}"` : 'disabled'}>
        <span class="icon">${STATUS_ICON[st.status]}</span>
        <span class="txt"><span class="type">${TYPE_LABEL[st.type]}${st.boss ? ' · Boss' : ''}</span>${h(st.title)}${st.swapped ? ' <em class="hint">(swapped)</em>' : ''}${st.status === 'provisional' ? '<em class="hint"> waiting for the morning check</em>' : ''}</span>
        <span class="xp">${st.xp ? `+${st.xp}` : ''}</span>
      </button></li>`;
}

function trackTitle(track) {
  if (track === 'run') { const l = E.runLevel(S.run.level); return `${E.worldOf(l).emoji} Level ${l.n} · ${h(l.name)}`; }
  if (track === 'prep') { const p = PREP_STAGES[S.prep.level]; return `🧱 Prep P${p.n} · ${h(p.name)}`; }
  if (track === 'rebuild') { const r = REBUILD_STAGES[S.rebuild.stage]; return `🩹 Rebuild R${r.n} · ${h(r.name)}`; }
  return '🔄 Refresher course';
}

function viewToday() {
  const t = now();
  const track = E.activeTrack(S);
  const steps = E.trackSteps(S, track);
  const lvl = E.runLevel(S.run.level);
  const prog = E.levelProgress(S);
  const pct = Math.min(100, Math.round(prog.earned / Math.max(1, prog.target) * 100));
  const prepSteps = E.trackSteps(S, 'prep');
  const orders = E.dailyOrders(t);
  const doneOrders = S.daily[E.dayKey(t)]?.orders || [];
  const restDone = S.daily[E.dayKey(t)]?.rest;
  const next = steps.find(st => st.status === 'open' || st.status === 'slot');
  const nextPrep = prepSteps.find(st => st.status === 'open');
  const hello = S.profile.name ? `Hi ${h(S.profile.name)}!` : 'Hi!';
  return `
    ${banners()}
    <section class="card hero">
      <p class="eyebrow">${hello} · ${h(E.worldOf(lvl).name)}</p>
      <h2>Level ${lvl.n} · ${h(lvl.name)} <span class="stars">${'⭐'.repeat(S.run.stars[lvl.n] || 0)}</span></h2>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <p class="hint">${prog.earned}/${prog.target} level XP · the gate test opens at ${prog.target}</p>
    </section>
    <section class="card boost">
      <p class="eyebrow">Daily boost</p>
      <p class="boost-line">${h(M.dailyBoost(S, t))}</p>
      ${M.progressLine(S) ? `<p class="hint">${h(M.progressLine(S))}</p>` : ''}
    </section>
    ${next ? `<section class="card next">
      <p class="eyebrow">Next up · ${trackTitle(track)}</p>
      <h3>${h(next.type === 'slot' ? (nextPrep ? `Prep: ${nextPrep.title}` : next.title) : next.title)}</h3>
      ${next.detail ? `<p>${h(next.detail)}</p>` : ''}
      <button class="btn primary" data-act="open-step" data-track="${track}" data-idx="${next.idx}">Start</button>
    </section>` : ''}
    ${track !== 'rebuild' && nextPrep ? `<section class="card next prep">
      <p class="eyebrow">${trackTitle('prep')}</p>
      <h3>${h(nextPrep.title)}</h3>
      <p class="hint">Prep steps also fill the Prep slots in your run level.</p>
      <button class="btn" data-act="open-step" data-track="prep" data-idx="${nextPrep.idx}">Open</button>
    </section>` : ''}
    <section class="card">
      <h3>${trackTitle(track)}</h3>
      <ul class="steps">${steps.map(st => stepRow(track, st)).join('')}</ul>
    </section>
    <section class="card">
      <h3>Daily orders <span class="hint">+${E.XP.daily} XP each</span></h3>
      <ul class="orders">${orders.map(o => `<li><label class="choice"><input type="checkbox" data-act="order" data-i="${o.i}" ${doneOrders.includes(o.i) ? 'checked disabled' : ''}><span>${h(o.title)}</span></label></li>`).join('')}</ul>
      <button class="btn ghost" data-act="rest" ${restDone ? 'disabled' : ''}>${restDone ? 'Rest day logged ✓' : `😴 Rest day check-in (+${E.XP.restDay} XP)`}</button>
    </section>`;
}

function viewMap() {
  const cur = S.run.level;
  const worlds = WORLDS.map(w => {
    const levels = RUN_LEVELS.filter(l => l.world === w.id);
    const nodes = levels.map(l => {
      const state = l.n < cur ? 'done' : l.n === cur ? 'current' : 'locked';
      const stars = S.run.stars[l.n] || 0;
      const skipped = state === 'done' && !stars;
      const reclaim = S.run.reclaim === l.n ? ' reclaim' : '';
      return `<button class="node ${state}${reclaim}" data-act="node" data-n="${l.n}" title="${h(l.criteria)}">
          <span class="num">${l.n}</span><span class="name">${h(l.name)}</span>
          <span class="stars">${state === 'locked' ? (reclaim ? '🔒 Reclaim' : `Needs P${l.needsPrep}`) : skipped ? 'Placed past' : '⭐'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
        </button>`;
    }).join('<span class="path"></span>');
    return `<section class="world w-${w.id}"><h3>${w.emoji} ${h(w.name)}</h3><div class="nodes">${nodes}</div></section>`;
  }).join('');
  const open = ui.openLevel === cur ? `<section class="card"><h3>${trackTitle('run')}</h3><ul class="steps">${E.trackSteps(S, 'run').map(st => stepRow(E.activeTrack(S) === 'run' ? 'run' : 'none', st)).join('')}</ul></section>` : '';
  const prep = PREP_STAGES.map(p => `<li class="${p.n < S.prep.level || (p.n === 7 && S.prep.mastered) ? 'done' : p.n === S.prep.level ? 'current' : ''}"><strong>P${p.n}</strong> ${h(p.name)}<span>${h(p.focus)}</span></li>`).join('');
  const rebuild = S.rebuild.active ? `<section class="card"><h3>🩹 Rebuild Track</h3><ol class="ladder">${REBUILD_STAGES.map((r, i) => `<li class="${i < S.rebuild.stage ? 'done' : i === S.rebuild.stage ? 'current' : ''}"><strong>R${r.n}</strong> ${h(r.name)}<span>${h(r.focus)}</span></li>`).join('')}</ol></section>` : '';
  return `${banners()}${rebuild}<div class="map">${worlds}</div>${open}
    <section class="card"><h3>🧱 Prep Track</h3><p class="hint">Harder run work unlocks with your Prep stage: strides at P3, hills and intervals at P4.</p><ol class="ladder">${prep}</ol></section>`;
}

function viewCoach() {
  const msgs = ui.chat.length ? ui.chat : [{ role: 'assistant', content: `Hey${S.profile.name ? ' ' + S.profile.name : ''}! I'm your coach. Ask me what to do today, how a drill works, or how you're feeling.` }];
  return `<section class="chat">
      <div class="chat-log">${msgs.map(m => `<div class="msg ${m.role}">${h(m.content)}${m.provider === 'offline' ? '<span class="tag">offline coach</span>' : ''}</div>`).join('')}
        ${ui.thinking ? '<div class="msg assistant typing"><span></span><span></span><span></span></div>' : ''}</div>
      <div class="quick">${['What should I do today?', 'I feel sore', 'Explain my level', 'How fast should easy runs be?'].map(q => `<button class="pill" data-act="quick" data-q="${h(q)}">${h(q)}</button>`).join('')}</div>
      <form id="chat-form" class="chat-input">
        ${canListen ? `<button type="button" class="mic ${ui.listening ? 'on' : ''}" data-act="mic" aria-label="Speak">🎤</button>` : ''}
        <input name="msg" placeholder="${ui.listening ? 'Listening…' : 'Message your coach'}" autocomplete="off" maxlength="1000">
        <button class="btn primary" type="submit" ${ui.thinking ? 'disabled' : ''}>Send</button>
      </form>
      ${canSpeak ? `<label class="choice small"><input type="checkbox" data-act="speak-toggle" ${ui.speakReplies ? 'checked' : ''}><span>Read replies aloud</span></label>` : ''}
      <p class="hint">The coach explains your plan; the app decides levels. Not medical advice.</p>
    </section>`;
}

function viewMe() {
  const hist = S.history.filter(x => x.kind === 'session' || x.kind === 'event' || x.kind === 'bonus').slice(-15).reverse();
  return `
    <section class="card">
      <h3>${h(S.profile.name || 'Runner')}</h3>
      <div class="stats">
        <div><strong>${S.xp}</strong><span>Total XP</span></div>
        <div><strong>${S.run.level}</strong><span>Run level</span></div>
        <div><strong>P${S.prep.level}</strong><span>Prep stage</span></div>
        <div><strong>${E.dayStreak(S, now())}</strong><span>Day streak</span></div>
      </div>
      <p class="hint">${S.profile.daysPerWeek} training days a week · streak multiplier x${E.streakMultiplier(S, now())}</p>
    </section>
    <section class="card"><h3>Badges</h3><div class="badges">${Object.entries(E.BADGES).map(([k, b]) =>
      `<div class="badge ${S.badges[k] ? 'on' : ''}" title="${h(b.desc)}"><span>${b.emoji}</span>${h(b.name)}</div>`).join('')}</div></section>
    <section class="card"><h3>Body</h3>
      <div class="row wrap">
        <button class="btn" data-act="report-pain">🩹 Report pain or injury</button>
        ${S.rebuild.redFlag ? '<button class="btn" data-act="cleared">I\'ve been cleared by a professional</button>' : ''}
      </div></section>
    <section class="card"><h3>Recent activity</h3>${hist.length ? `<ul class="history">${hist.map(x =>
      `<li><span>${new Date(x.ts).toLocaleDateString()}</span>${h(x.title)}${x.pain != null ? ` <em>pain ${x.pain}/10</em>` : ''}<b>${x.xp ? `+${x.xp}` : ''}</b></li>`).join('')}</ul>` : '<p class="hint">Nothing yet. Your first step is on the Today tab.</p>'}</section>
    <section class="card"><h3>Your data</h3>
      <p class="hint">Progress is saved in this browser only. Export it to move to another device.</p>
      <div class="row wrap">
        <button class="btn" data-act="export">Export progress</button>
        <label class="btn">Import<input type="file" accept="application/json" data-act="import" hidden></label>
        <button class="btn" data-act="retake">Retake assessment</button>
        <button class="btn danger" data-act="reset">Reset everything</button>
      </div></section>`;
}

// ---------- modals ----------
function renderModal() {
  const root = $('#modal');
  const m = ui.modal;
  if (!m) { root.innerHTML = ''; root.hidden = true; return; }
  root.hidden = false;
  root.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${MODALS[m.type](m)}</div>`;
}

function painSlider(label = 'Pain during the session (0 = none, 10 = worst)') {
  return `<label class="field pain"><span>${h(label)}</span>
    <input type="range" name="pain" min="0" max="10" value="0" data-act="pain-range">
    <span class="pain-scale"><b id="pain-val">0</b>/10 · <em id="pain-hint">counts as normal</em></span></label>`;
}

const MODALS = {
  step(m) {
    const st = E.trackSteps(S, m.track)[m.idx];
    const exs = (st.ex || []).map(id => EXERCISES[id] && `<li class="ex">
        <div><strong>${h(EXERCISES[id].name)}</strong> <span class="dose">${h(EXERCISES[id].dose)}</span></div>
        <ul>${EXERCISES[id].cues.map(c => `<li>${h(c)}</li>`).join('')}</ul>
        <a href="${videoLink(id)}" target="_blank" rel="noopener">▶ Watch how</a></li>`).join('');
    const passQ = st.type === 'proveit' ? `<p class="q">Did you hit it?</p>${radio('passed', [['1', 'Yes, I hit it'], ['0', 'Not quite']], '1')}` : '';
    const gateNote = st.type === 'gate' ? `<p class="hint">${st.nextDay ? 'Gate result is confirmed by tomorrow morning\'s pain check (2/10 or less).' : 'Only log it once you have done the test.'}</p>` : '';
    return `<form id="step-form">
      <p class="eyebrow">${trackTitle(m.track)} · ${TYPE_LABEL[st.type]}</p>
      <h2>${h(st.title)}</h2>
      ${st.detail ? `<p>${h(st.detail)}</p>` : ''}
      ${exs ? `<ul class="exercises">${exs}</ul>` : ''}
      ${gateNote}${passQ}
      ${st.type === 'rest' ? '' : painSlider()}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Log it (+${st.xp} XP)</button></div>
    </form>`;
  },
  rebuildPrompt() {
    return `<form id="rebuild-form">
      <h2>🩹 Let's look after that</h2>
      <p>The Rebuild Track brings you back step by step: isometrics, strength, landing, then run/walk. Your level is saved.</p>
      <p class="q">Any of these?</p><div class="choices">${RED_FLAGS.map(([k, l]) => check(`rf_${k}`, h(l), false)).join('')}</div>
      <p class="hint">If you tick any, running pauses until a physio or doctor clears you. This app is not medical advice.</p>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Not now</button><button class="btn primary" type="submit">Start Rebuild Track</button></div>
    </form>`;
  },
  morning() {
    const due = E.pendingChecks(S, now());
    return `<form id="morning-form">
      <h2>🌅 Morning check</h2>
      <p>How does your body feel today after:</p>
      <ul class="plain">${due.map(p => `<li>${h(titleOfPending(p))}</li>`).join('')}</ul>
      ${painSlider('Pain or soreness right now (0-10)')}
      <div class="row end"><button type="button" class="btn ghost" data-act="dismiss" data-key="morning">Later</button><button class="btn primary" type="submit">Save</button></div>
    </form>`;
  },
  return(m) {
    const { gapDays } = E.returnCheck(S, now());
    if (m.summary) {
      const s = m.summary;
      return `<h2>Your comeback plan</h2>
        <p>Away ${s.gapDays} days.${s.effectiveDays < s.gapDays ? ` Thanks to the training you kept up, that counts as about ${s.effectiveDays} days off.` : ''}</p>
        ${s.toLevel !== s.fromLevel ? `<p>Level ${s.fromLevel} → <strong>Level ${s.toLevel}</strong> for now.</p>` : ''}
        <ul class="plain">${s.notes.map(n => `<li>${h(n)}</li>`).join('')}</ul>
        <div class="row end"><button class="btn primary" data-act="close">Let's go</button></div>`;
    }
    return `<form id="return-form">
      <h2>👋 Welcome back!</h2>
      <p>You've been away for ${gapDays} days. A short check sets up the right way back in.</p>
      <p class="q">What happened?</p>${radio('reason', [['busy', 'Life got busy'], ['illness', 'I was ill'], ['injury', 'Pain or injury']], 'busy')}
      <p class="q">While away, roughly per week:</p>
      ${num('easyMin', 'Easy running', '', 'min')}${num('hardMin', 'Hard running (tempo, intervals)', '', 'min')}${num('crossMin', 'Cycling, swimming, other cardio', '', 'min')}
      <p class="hint">Unsure? Leave it empty. The Prove It run will show where you are.</p>
      <div class="row end"><button class="btn primary" type="submit">Build my plan</button></div>
    </form>`;
  },
};

function titleOfPending(p) {
  const steps = p.track === 'refresher' ? S.refresher?.steps : p.track === 'run' ? E.runLevel(p.level)?.steps : p.track === 'prep' ? PREP_STAGES[p.level]?.steps : REBUILD_STAGES[p.level]?.steps;
  return steps?.[p.idx]?.title || 'Your last session';
}

// ---------- actions ----------
function handleOutcome(outcome) {
  const extra = outcome.status === 'done' || outcome.status === 'provisional' ? [M.afterSession(S)]
    : outcome.status === 'repeat' || outcome.status === 'stepBack' ? [M.repeatLine(S)] : [];
  toast([...outcome.messages, ...extra]);
  if (outcome.status === 'rebuildPrompt') ui.modal = { type: 'rebuildPrompt' };
  render();
}

const actions = {
  tab(el) { ui.tab = el.dataset.tab; ui.openLevel = null; render(); },
  'ob-back'() { collectOb(); ui.ob.step--; renderOnboarding(); },
  'ob-finish'() {
    const { state } = E.placeFromAnswers(S, normalize(ui.ob.a), now());
    ui.retake = false; ui.ob = { step: 0, a: {} }; ui.tab = 'today';
    commit(state);
  },
  'open-step'(el) {
    let track = el.dataset.track, idx = +el.dataset.idx;
    if (track === 'none') return;
    const st = E.trackSteps(S, track)[idx];
    if (st.type === 'slot') {
      const p = E.trackSteps(S, 'prep').find(x => x.status === 'open');
      if (!p) return toast('Your Prep Track step is waiting for its gate. Check the Prep stage.');
      track = 'prep'; idx = p.idx;
    }
    ui.modal = { type: 'step', track, idx }; renderModal();
  },
  close() { ui.modal = null; render(); },
  dismiss(el) { ui.dismissed.add(el.dataset.key); ui.modal = null; render(); },
  order(el) { commit(E.completeOrder(S, +el.dataset.i, now())); toast(`+${E.XP.daily} XP`); },
  rest() {
    const before = S.xp; const next = E.restCheckIn(S, now());
    if (next.xp === before) return toast('You already logged a session or rest today.');
    commit(next); toast(`Rest counts. +${E.XP.restDay} XP`);
  },
  node(el) {
    const n = +el.dataset.n, l = E.runLevel(n);
    if (n === S.run.level) { ui.openLevel = ui.openLevel === n ? null : n; render(); }
    else if (n < S.run.level) toast(`${l.name}: ${'⭐'.repeat(S.run.stars[n] || 0) || 'cleared'}`);
    else toast(`${l.name} · ${l.criteria} · needs Prep P${l.needsPrep}`);
  },
  cleared() { if (confirm('Confirm a physio or doctor has cleared you to train?')) commit(E.clearRedFlag(S, now())); },
  'report-pain'() { ui.modal = { type: 'rebuildPrompt' }; renderModal(); },
  export() { store.exportFile(S); },
  retake() { if (confirm('Retake the assessment? Your XP and badges stay; your level is set again.')) { ui.retake = true; ui.ob = { step: 0, a: { ...(S.answers || {}) } }; render(); } },
  reset() { if (confirm('Delete all progress in this browser?')) { store.clear(); localStorage.removeItem(CHAT_KEY); ui.chat = []; S = E.newState(now()); render(); } },
  quick(el) { sendChat(el.dataset.q); },
  mic() {
    if (ui.listening) { ui.listening.stop(); return; }
    const input = $('#chat-form input');
    ui.listening = listen({
      onText: (text, final) => { input.value = text; if (final) { ui.listening = null; sendChat(text); } },
      onEnd: () => { ui.listening = null; const b = $('.mic'); if (b) b.classList.remove('on'); },
    });
    $('.mic')?.classList.add('on');
  },
};

async function sendChat(text) {
  text = text.trim();
  if (!text || ui.thinking) return;
  ui.chat.push({ role: 'user', content: text });
  ui.thinking = true; render();
  const history = ui.chat.slice(-12).map(({ role, content }) => ({ role, content }));
  const { reply, provider } = await askCoach(history, E.coachContext(S, now()), S);
  ui.chat.push({ role: 'assistant', content: reply, provider });
  ui.thinking = false; saveChat(); render();
  if (ui.speakReplies) speak(reply);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' && el.type === 'range') return;
  if (el.type === 'checkbox' && el.dataset.act === 'speak-toggle') return;
  if (el.dataset.act === 'import') return;
  if (e.target === $('#modal')) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.act === 'speak-toggle') ui.speakReplies = el.checked;
  if (el.dataset.act === 'import' && el.files[0]) {
    try { commit(await store.importFile(el.files[0])); toast('Progress imported.'); }
    catch (err) { toast(err.message); }
  }
});

document.addEventListener('input', e => {
  if (e.target.dataset.act !== 'pain-range') return;
  const v = +e.target.value;
  $('#pain-val').textContent = v;
  $('#pain-hint').textContent = v <= 2 ? 'counts as normal' : v <= 4 ? 'step will be repeated' : 'stop: Rebuild Track suggested';
  e.target.closest('.pain').dataset.level = v <= 2 ? 'ok' : v <= 4 ? 'warn' : 'bad';
});

document.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const t = now();
  if (f.id === 'ob-form') { collectOb(); ui.ob.step++; renderOnboarding(); window.scrollTo(0, 0); return; }
  if (f.id === 'chat-form') { const v = f.msg.value; f.msg.value = ''; sendChat(v); return; }
  if (f.id === 'step-form') {
    const m = ui.modal;
    const pain = f.pain ? +f.pain.value : 0;
    const passed = f.passed ? f.passed.value === '1' : undefined;
    const { state, outcome } = E.completeStep(S, m.track, m.idx, { pain, passed, now: t });
    ui.modal = null; S = state; store.save(S);
    handleOutcome(outcome);
    return;
  }
  if (f.id === 'rebuild-form') {
    const redFlag = RED_FLAGS.some(([k]) => f[`rf_${k}`].checked);
    ui.modal = null;
    commit(E.enterRebuild(S, { redFlag, now: t }));
    toast(redFlag ? 'Running paused. Please see a professional.' : 'Rebuild Track started. Your level is saved.');
    return;
  }
  if (f.id === 'morning-form') {
    const { state, outcome } = E.morningCheck(S, +f.pain.value, t);
    ui.modal = null; S = state; store.save(S);
    handleOutcome(outcome);
    return;
  }
  if (f.id === 'return-form') {
    const n = v => parseFloat(v) || 0;
    const { state, summary } = E.applyReturn(S, { reason: f.reason.value, easyMin: n(f.easyMin.value), hardMin: n(f.hardMin.value), crossMin: n(f.crossMin.value), now: t });
    S = state; store.save(S);
    ui.modal = state.needsReassessment ? null : { type: 'return', summary };
    if (state.needsReassessment) ui.ob = { step: 0, a: { ...(S.answers || {}) } };
    render();
  }
});

$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && ui.modal?.type === 'step') { ui.modal = null; renderModal(); } });

// ---------- toasts ----------
function renderToasts() {
  $('#toasts').innerHTML = ui.toasts.map(t => `<div class="toast">${h(t.m)}</div>`).join('');
}

render();
