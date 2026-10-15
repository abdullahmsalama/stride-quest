import * as E from './engine.js';
import { RUN_LEVELS, PREP_STAGES, REBUILD_STAGES, WORLDS } from './data/tracks.js';
import { EXERCISES, videoLink } from './data/exercises.js';
import * as store from './store.js';
import { askCoach, understand, understandChat, canListen, canSpeak, listen, speak, AI_TROUBLE, prettyModel, aiLabel } from './coach.js';
import * as ACT from './actions.js';
import * as M from './motivation.js';
import { renderMap, runAvatar, mapPageY, runFogParts, POINTS, H as MAP_H, W as MAP_W } from './map.js';
import { playPlacementIntro } from './intro.js';
import * as sfx from './sound.js';
import * as CH from './challenges.js';
import * as K from './calendar.js';
import { parseTime, formatTime, raceMinutes, estimateKm } from './time.js';
import { dreamTarget, weeksUntil, targetFromAI } from './goal.js';
import * as ST from './standards.js';
import { APP_VERSION } from './config.js';
import * as BG from './background.js';
import * as TRI from './tri.js';
import { renderLaneMap, gateY as laneGateY, TH as LANE_H, TW as LANE_W, MAPS as LANE_MAPS, nodePoint, moveCharacter, celebrate, signature, START_POINT, laneFogParts, bandAtY, setPlates } from './trimap.js';
import * as HYB from './hybrid.js';
import { HYBRID_WORLDS, BLOCK_WEEKS, STRENGTH_STAGES } from './data/hybrid.js';
import { TRI_WORLDS } from './data/tri.js';
import { confetti } from './intro.js';
import * as STATS from './stats.js';
import { NORMS, RHO } from './data/norms.js';
import { WORKER_URL } from './config.js';
import { RACES } from './data/races.js';
import * as EV from './events.js';
import * as TG from './target.js';
import * as NU from './nutrition.js';
import * as SPL from './splits.js';
import * as AGE from './age.js';
import { KID_LIKES, MISSIONS, KID_TIPS, missionsFor } from './data/kids.js';
import { OTHER, EFFORT, otherItems, sessionItem, otherOf, STRAVA_RUN, kindOfStrava, effortOf, stravaMet } from './data/other.js';
import { FEATURES, GROUPS, FEATURE_BRIEF } from './data/features.js';

// ---------- state ----------
// Theme: light by default (the look the app launched with); dark or follow-the-device on request.
const THEME_KEY = 'stride-quest:theme';
const theme = () => { try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; } };
function applyTheme(t = theme()) {
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#f4f5f0' : '#14213d');
}
applyTheme();

let S = store.load();
if (!S || S.v !== 1) S = E.newState(Date.now());
S = CH.ensureSocial(S);
store.save(S);

// A friend's link (invite, challenge or result) arrives in the URL hash.
const incomingLink = CH.decodeHash(location.hash);
if (location.hash.includes('sq=')) history.replaceState(null, '', location.pathname + location.search);

const CHAT_KEY = 'stride-quest:chat';
const ui = {
  tab: 'today',
  ob: { step: 0, a: {} },
  retake: false,
  modal: null,
  dismissed: new Set(),
  avatarAt: null,
  lanePopup: null,
  smartCoach: (() => { try { return localStorage.getItem('stride-quest:smartCoach') === '1'; } catch { return false; } })(),
  incoming: incomingLink,
  socialTab: 'challenges',
  intro: null,
  mapMode: null, // set from the main track below
  mapPopup: null,
  mapRunning: false,
  mapScroll: false,
  toasts: [],
  chat: readChat(),
  thinking: false,
  speakReplies: false,
  listening: null,
};

// The map that belongs to the athlete's main track.
function primaryMode() {
  const p = S.profile.primary;
  if (p === 'hybrid' && HYB.hasHybrid(S)) return 'hyb';
  if (p === 'tri' && TRI.hasTri(S)) return 'tri';
  return 'world';
}
ui.mapMode = primaryMode();

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
const TRACKS = [['run', '🏃 Running'], ['hybrid', '🏃🏋️ Hybrid (Alpha X, Hyrox, Tough Mudder…)'], ['tri', '🏊🚴🏃 Triathlon']];
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
// A time typed as mm:ss / h:mm:ss, optionally as a pace per km (modeName toggles Total time / Pace).
const timeField = (name, label, cur, placeholder, modeName, mode) => `<div class="field time-field"><span>${h(label)}</span>
  <div class="time-row"><input type="text" name="${name}" value="${h(cur ?? '')}" placeholder="${h(placeholder)}" autocomplete="off" spellcheck="false" inputmode="text">
  ${modeName ? `<div class="seg mini">${[['time', 'Total time'], ['pace', 'Pace /km']].map(([v, l]) => `<label class="${(mode || 'time') === v ? 'on' : ''}"><input type="radio" name="${modeName}" value="${v}" ${(mode || 'time') === v ? 'checked' : ''} hidden>${l}</label>`).join('')}</div>` : ''}</div></div>`;
const tip = (text, label = 'More info') => `<details class="tip"><summary aria-label="${h(label)}">ⓘ</summary><p>${h(text)}</p></details>`;
const select = (name, opts, cur) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`;
const OTHER_EVENTS = ['CrossFit Open', 'CrossFit Games', 'Wodapalooza', 'Rogue Invitational', 'Tough Mudder', 'Spartan Race', 'DEKA', 'ATHX'];
const num = (name, label, cur, unit) => `<label class="field"><span>${h(label)}</span><span class="with-unit"><input type="number" inputmode="decimal" min="0" step="any" name="${name}" value="${cur ?? ''}"><em>${h(unit)}</em></span></label>`;

// "Other training" questions (also used in Me to edit them later). Names: ot_<kind> (do it?),
// otd_<kind>_<weekday>, otm_<kind> (minutes), ote_<kind> (effort), otn (name for "something else").
function otherBlock(a) {
  return `<p class="hint">Optional: skip if Stride Quest is all you do.</p><div class="choices">${OTHER.map(o => {
    const on = !!a[`ot_${o.k}`];
    return `${check(`ot_${o.k}`, o.label, on)}${on ? `<div class="ot-detail">
        ${o.k === 'other' ? `<label class="field"><span>What is it?</span><input type="text" name="otn" maxlength="40" value="${h(a.otn || '')}" placeholder="e.g. boxing, CrossFit, hiking"></label>` : ''}
        <p class="q">Which days?</p><div class="day-picker">${K.DAY_NAMES.map((d, i) => `<label class="day-chip"><input type="checkbox" name="otd_${o.k}_${i}" ${a[`otd_${o.k}_${i}`] ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        <div class="row wrap"><label class="field"><span>Usual length</span><span class="with-unit"><input type="number" inputmode="numeric" name="otm_${o.k}" value="${a[`otm_${o.k}`] || ''}" min="10" max="300" placeholder="60"><em>min</em></span></label></div>
        <p class="q">How hard, usually?</p>${radio(`ote_${o.k}`, EFFORT, a[`ote_${o.k}`] || 'moderate')}</div>` : ''}`;
  }).join('')}</div>`;
}
// The answers above as a list: [{ kind, days, minutes, effort, name }].
function otherFrom(a) {
  return OTHER.filter(o => a[`ot_${o.k}`]).map(o => ({ kind: o.k, name: o.k === 'other' ? String(a.otn || '').trim().slice(0, 40) : '', days: K.DAY_NAMES.map((d, i) => i).filter(i => a[`otd_${o.k}_${i}`]),
    minutes: Math.max(10, Math.min(300, +a[`otm_${o.k}`] || 60)), effort: a[`ote_${o.k}`] || 'moderate' }));
}
const otherToAnswers = list => Object.fromEntries((list || []).flatMap(o => [[`ot_${o.kind}`, true], [`otm_${o.kind}`, o.minutes], [`ote_${o.kind}`, o.effort], ...(o.name ? [['otn', o.name]] : []), ...o.days.map(d => [`otd_${o.kind}_${d}`, true])]));
const otherLine = o => `${(otherOf(o.kind) || otherOf('other')).label.split(' (')[0]}${o.name ? ` (${o.name})` : ''} · ${o.days.length ? o.days.map(d => K.DAY_NAMES[d]).join(', ') : 'no fixed days'} · ${o.minutes} min · ${o.effort}`;

function obSteps(a) {
  if (+a.age > 0 && +a.age < 13) return kidSteps(a);
  return obStepsAdult(a);
}
function obStepsAdult(a) {
  const steps = [
    { welcome: true, title: "Let's build your plan", body: `
        <p class="lead">A few quick questions so your plan fits <strong>you</strong>: where you are today, what you dream of, and how your week looks.</p>
        <ol class="welcome-list"><li><span>🎯</span><div><strong>Your dream</strong><br><span class="hint">What you want to achieve</span></div></li>
          <li><span>📍</span><div><strong>Where you are today</strong><br><span class="hint">So the first level is a win, not a struggle</span></div></li>
          <li><span>📅</span><div><strong>Your week</strong><br><span class="hint">Which days you can train</span></div></li></ol>
        <p class="hint">About 2 minutes. Your answers stay on this device.</p>
        <p class="byline">Developed by <button type="button" class="linkish" data-act="about-me">Abdullah Salama</button></p>` },
    { title: 'About you', why: 'So we only show the tracks you care about, and use the right times and weights for you.', body: `
        <label class="field"><span>Your name (optional)</span><input type="text" name="name" value="${h(a.name || '')}" maxlength="40" autocomplete="given-name"></label>
        <label class="field"><span>Your age</span><span class="with-unit"><input type="number" inputmode="numeric" name="age" min="4" max="99" step="1" value="${h(a.age ?? '')}" placeholder="e.g. 32"><em>years</em></span></label>
        ${+a.age > 0 && +a.age < 13 ? '<p class="hint">👨‍👩‍👧 Under 13: next you\'ll set up <strong>Family mode</strong> together with a grown-up: fun play missions, no training plans.</p>' : +a.age >= 13 && +a.age < 18 ? '<p class="hint">🌱 Under 18: you get <strong>Teen mode</strong>: the full app with a few safety rules for growing bodies.</p>' : ''}
        <p class="q">Which category do you race in? ${tip("Men's and women's race weights, times and standards differ. 'Prefer not to say' uses the more forgiving standards.", 'About categories')}</p>
        ${radio('sex', [['m', "Men's"], ['f', "Women's"], ['x', 'Prefer not to say']], a.sex || 'x')}
        <p class="q">What do you train for? <span class="hint">Pick one or more</span></p>
        <div class="choices">${TRACKS.map(([k, l]) => check(`tr_${k}`, l, (a.tracks || ['run']).includes(k))).join('')}</div>
        ${(a.tracks || []).length > 1 ? `<p class="q">Which one leads your week?</p>${radio('primary', TRACKS.filter(([k]) => a.tracks.includes(k)), a.primary || a.tracks[0])}` : ''}` },
    { title: 'What do you dream of achieving?', why: 'Your plan works backwards from here. Dream big: we make it step by step.', body: `
        <label class="field"><span>In your own words</span><textarea name="dream" rows="2" maxlength="160" placeholder="e.g. Run a sub-50 10K · Finish my first marathon · Hyrox Pro under 1:15 · Run 30 min without stopping">${h(a.dream || '')}</textarea></label>
        <p class="q">Which is closest?</p>${radio('goal', GOALS, a.goal)}
        <p class="q">A target event or date? <span class="hint">optional</span></p>
        <label class="field"><span>Event</span><input type="text" name="dreamEvent" value="${h(a.dreamEvent || '')}" maxlength="60" placeholder="e.g. Berlin Marathon, Hyrox Dubai"></label>
        <label class="field"><span>Date</span><input type="date" name="dreamDate" value="${h(a.dreamDate || '')}"></label>` },
    { title: 'Your sporting background', why: 'Former athletes keep their technique for life and come back faster: we credit that.', body: backgroundQuestions(a) },
    { title: 'How many runs a week do you do?', why: 'Recent running tells us more than your best day ever.', body: `
        <label class="field"><span>Runs per week, on average over the last 4 weeks</span><span class="with-unit"><input type="number" inputmode="numeric" name="runsPerWeek" min="0" max="14" step="1" value="${a.runsPerWeek ?? (a.runsLast4w != null && a.runsLast4w !== '' ? Math.round(+a.runsLast4w / 4) : '')}" placeholder="e.g. 3"><em>runs / week</em></span></label>
        <p class="hint">0 if you haven't run lately. Count every run, including easy ones.</p>` },
    { title: 'Longest you can run without stopping?', why: 'Sets your first level so it feels doable.', body: radio('continuous', CONTINUOUS, a.continuous) },
    { title: 'Your running volume', why: 'Keeps your first weeks at a safe load.', body: `${num('weeklyKm', 'Roughly how many km per week lately?', a.weeklyKm, 'km')}
        <p class="q">Longest run in the last 2 months?</p><p class="hint">Distance, time, or both.</p>
        ${num('longestKm', 'Distance', a.longestKm, 'km')}${timeField('longestTime', 'Time', a.longestTime, 'h:mm:ss, e.g. 1:05:00')}` },
    { title: 'Recent best times (optional)', why: 'Fine-tunes your level and, later, your paces.', body: `<p class="hint">Last 6 months. Type mm:ss (or h:mm:ss), as a total time or your pace per km. Leave empty if you don't know.</p>
        ${timeField('best5kText', 'Best 5K', a.best5kText ?? (a.best5k ? formatTime(a.best5k) : ''), (a.best5kMode || 'time') === 'pace' ? 'pace, e.g. 5:30' : 'e.g. 27:30', 'best5kMode', a.best5kMode)}
        ${timeField('best10kText', 'Best 10K', a.best10kText ?? (a.best10k ? formatTime(a.best10k) : ''), (a.best10kMode || 'time') === 'pace' ? 'pace, e.g. 5:45' : 'e.g. 58:00 or 1:02:30', 'best10kMode', a.best10kMode)}
        <div class="choices">${check('halfDone', 'I have finished a half marathon', a.halfDone)}${check('marathonDone', 'I have finished a marathon', a.marathonDone)}${check('ultraDone', 'I have finished an ultra', a.ultraDone)}</div>
        ${(a.tracks || []).includes('hybrid') ? hybridRaces(a) : ''}` },
    ...((a.tracks || []).includes('hybrid') ? [{ title: 'Your strength and engine', why: 'Strength and Engine set your two Hybrid lanes. Your running comes from the run questions.', body: hybQuestions(a) }] : []),
    ...((a.tracks || []).includes('tri') ? [{ title: 'Your swim and bike', why: 'Swim and bike set your two other triathlon lanes. Your running comes from the run questions.', body: triQuestions(a) }] : []),
    { title: 'Any pain or injury right now?', why: 'Safety first: if something hurts, we rebuild before we push.', body: `${radio('pain', [['none', 'No pain'], ['mild', 'Mild or nagging (3/10 or less)'], ['more', 'More than that, or a diagnosed injury']], a.pain)}
        <label class="field"><span>Where? (optional)</span><input type="text" name="painWhere" value="${h(a.painWhere || '')}" maxlength="60" placeholder="e.g. left knee, right Achilles"></label>
        <p class="q">Any of these?</p><div class="choices">${RED_FLAGS.map(([k, l]) => check(`rf_${k}`, h(l), (a.redFlags || []).includes(k))).join('')}</div>` },
    { title: 'Which days can you train?', why: 'We build your week around your life, not the other way round.', body: `<p class="hint">Pick at least 2. You can move sessions any time.</p>
        <div class="day-picker">${K.DAY_NAMES.map((d, i) => `<label class="day-chip"><input type="checkbox" name="d_${i}" ${(a.days || K.defaultDays(3)).includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
        <label class="field"><span>Best day for your longest session</span><select name="longDay">${K.DAY_NAMES.map((d, i) => `<option value="${i}" ${(a.longDay ?? 5) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>` },
    { title: 'Do you train anything else?', why: 'Gym, football or padel count too: we keep your hard runs away from heavy-leg days, and your nutrition counts them.', body: otherBlock(a) }
  ];
  if (E.qualifyingLevel(normalize(a)) >= 3) {
    steps.push({ title: 'Quick body check', why: 'Strong landings and ankles come before speed work.', body: `<p class="hint">Tick what you can do today. Not sure? Try it now: each has a demo link. Leave one unticked only if you can't do it: we'll start your Prep just before it.</p>
      <div class="choices">${SELF_TEST.map(([k, l, ex]) => `${check(k, `${h(l)} <a href="${videoLink(ex)}" target="_blank" rel="noopener">demo</a>`, a.selfTest?.[k])}`).join('')}</div>` });
  }
  steps.push({ title: 'How much do you want to see?', why: 'Some people like every detail, some just want to know what to do next.', body:
    radio('view', [['simple', 'Keep it simple: just tell me what to do next'], ['full', 'Show me everything: my week, levels and details']], a.view || 'simple') + '<p class="hint">You can switch any time at the top of Today.</p>' });
  steps.push({ title: 'Your starting point', result: true });
  return steps;
}

const cap = w => w ? w[0].toUpperCase() + w.slice(1) : '';
const FORMAT_LABEL = { solo: 'Solo', pair: 'Pair', relay: 'Relay' };
const raceLabel = r => [r.event, cap(r.division || r.category), r.event === 'Hyrox' && r.format === 'pair' ? 'Doubles' : FORMAT_LABEL[r.format]]
  .filter(Boolean).join(' · ') + (r.time ? ` (${formatTime(r.time)})` : '');

// "Your dream: … · realistic around Level 8, 4 levels from here · 10 weeks to go"
function dreamLine(a, level, compact = false) {
  const text = (a.dream ?? a.text ?? '').trim();
  const event = a.dreamEvent ?? a.event ?? '';
  const date = a.dreamDate ?? a.date ?? '';
  if (!text && !event) return '';
  const target = a.target !== undefined ? a.target : dreamTarget(`${text} ${event}`);
  const weeks = weeksUntil(date, now());
  const bits = [];
  if (target?.level) bits.push(target.level <= level ? 'within reach at your level 💪' : `realistic around Level ${target.level}: ${target.level - level} level${target.level - level > 1 ? 's' : ''} from here`);
  else if (target?.track === 'hybrid' && target.world != null) bits.push(HYB.hasHybrid(S) ? (target.world <= S.hybrid.world ? 'you are in that world now 💪' : `lives at ${HYBRID_WORLDS[target.world].name}: ${target.world - S.hybrid.world} world${target.world - S.hybrid.world > 1 ? 's' : ''} from here`) : `your Hybrid map flags it at ${HYBRID_WORLDS[target.world].name}`);
  else if (target?.track === 'hybrid') bits.push('your Hybrid track will build towards it');
  else if (target?.track === 'tri' && target.world != null && TRI.hasTri(S)) bits.push(target.world <= S.tri.world ? 'you are in that world now 💪' : `lives at ${TRI_WORLDS[target.world].name}: ${target.world - S.tri.world} world${target.world - S.tri.world > 1 ? 's' : ''} from here`);
  else if (target?.track === 'tri') bits.push(target.world != null ? `your Tri map flags it at ${TRI_WORLDS[target.world].name}` : 'your Triathlon track will build towards it');
  if (weeks != null) bits.push(`${weeks} week${weeks === 1 ? '' : 's'} to go`);
  const label = [text, event].filter(Boolean).join(' · ');
  return compact ? `<p class="dream">🎯 ${h(label)}${bits.length ? ` <span>${h(bits.join(' · '))}</span>` : ''}</p>`
    : `<div class="dream-box"><strong>🎯 Your dream:</strong> ${h(label)}${bits.length ? `<br><span class="hint">${h(bits.join(' · '))}</span>` : ''}</div>`;
}

const SWIM_DIST = [['none', "I can't swim yet"], ['25', '25 m'], ['100', '100 m'], ['200', '200 m'], ['400', '400 m'], ['750', '750 m'], ['1500', '1.5 km'], ['1900', '1.9 km'], ['3800', '3.8 km or more']];
const RIDES = [['none', 'Not recently'], ['30', '30 min'], ['60', '1 hour'], ['10', '10 km'], ['20', '20 km'], ['40', '40 km'], ['90', '90 km'], ['180', '180 km or more']];
const TRI_RACES = [['supersprint', 'Super Sprint'], ['sprint', 'Sprint'], ['olympic', 'Olympic'], ['half', '70.3'], ['full', 'Full distance']];
function backgroundQuestions(a) {
  return `<p class="q">Have you trained seriously in a sport before? <span class="hint">optional, pick all that apply</span></p>
    <div class="choices">${BG.SPORTS.map(([k, l]) => `<div class="race-opt"><div class="race-head">${check(`bg_${k}`, h(l), a[`bg_${k}`])}</div>
      ${a[`bg_${k}`] ? `<div class="race-detail bg-detail">
        <label class="field"><span>Level</span>${select(`bglvl_${k}`, BG.LEVELS, a[`bglvl_${k}`] || 'club')}</label>
        <label class="field"><span>How long</span>${select(`bgyrs_${k}`, BG.YEARS, a[`bgyrs_${k}`] || '3')}</label>
        <label class="field"><span>Last trained seriously</span>${select(`bgsince_${k}`, BG.SINCE, a[`bgsince_${k}`] || 'now')}</label></div>` : ''}</div>`).join('')}</div>`;
}
const backgroundOf = a => BG.SPORTS.map(([k]) => k).filter(k => a[`bg_${k}`]).map(k => ({ sport: k, level: a[`bglvl_${k}`] || 'club', years: a[`bgyrs_${k}`] || '3', since: a[`bgsince_${k}`] || 'now' }));

function hybQuestions(a) {
  return `<p class="q">Where do you train?</p>${radio('gym', [['full', 'Gym with sled, rower, SkiErg'], ['gym', 'Gym with barbells, no sled or ergs'], ['home', 'Home: dumbbells / kettlebells'], ['none', 'No equipment yet']], a.gym || 'full')}
    <p class="q">Lifting experience</p>${radio('liftExp', [['none', 'New to lifting'], ['lt1', 'Under 1 year'], ['y1_3', '1-3 years'], ['y3', 'More than 3 years']], a.liftExp || 'lt1')}
    <p class="q">Your current lifts <span class="hint">optional</span></p>
    <p class="hint">The heaviest weight you can lift with good form, either for 5 clean reps or as a single max rep.</p>
    ${radio('liftMode', [['5', 'For 5 clean reps'], ['1', 'As a 1-rep max'], ['unknown', "I don't know my numbers"]], a.liftMode || '5')}
    <div class="seg mini unit-seg">${[['kg', 'kg'], ['lb', 'lb']].map(([v, l]) => `<label class="${(a.liftUnit || 'kg') === v ? 'on' : ''}"><input type="radio" name="liftUnit" value="${v}" ${(a.liftUnit || 'kg') === v ? 'checked' : ''} hidden>${l}</label>`).join('')}</div>
    ${num('bodyweight', 'Your bodyweight', a.bodyweight, a.liftUnit || 'kg')}
    ${a.liftMode === 'unknown' ? '' : `${num('squat5', 'Heaviest back squat', a.squat5, a.liftUnit || 'kg')}${num('deadlift5', 'Heaviest deadlift', a.deadlift5, a.liftUnit || 'kg')}`}${num('pullups', 'Strict pull-ups in a row', a.pullups, 'reps')}
    <label class="field"><span>Other lifts or tests you know <span class="hint">optional, the AI turns them into estimates</span></span><textarea name="otherLifts" rows="2" maxlength="200" placeholder="e.g. leg press 150 kg x 8, goblet squat 24 kg x 10, bench 60 kg">${h(a.otherLifts || '')}</textarea></label>
    ${timeField('row1000Text', '1000 m row time', a.row1000Text, 'm:ss, e.g. 3:55')}
    <p class="q">Start with which block?</p>${radio('startBlock', [['auto', 'Let the app choose'], ['engine', '⚡ Engine block'], ['strength', '🏋️ Strength block']], a.startBlock || 'auto')}`;
}

function triQuestions(a) {
  // No pre-ticked answer: a skipped question never caps the swim you told us about.
  const yn = (name, cur) => radio(name, [['yes', 'Yes'], ['no', 'Not yet']], cur);
  return `<p class="q">How far can you swim without stopping?</p>${radio('swimDist', SWIM_DIST, +a.swimM > 0 ? a.swimDist : a.swimDist || '100')}
    ${num('swimM', 'Or type it exactly (replaces the choice above)', a.swimM, 'm')}
    ${(a.swimDist && a.swimDist !== 'none') || +a.swimM > 0 ? `<p class="q">Do you swim freestyle (front crawl)?</p>${yn('freestyle', a.freestyle)}
      <p class="q">Have you swum in open water (lake or sea)?</p>${yn('openWater', a.openWater)}` : '<div class="banner info">No problem! You start with water comfort. Lessons with a swim coach are the fastest, safest way: we track your progress alongside.</div>'}
    <p class="q">Your bike</p>${radio('bikeAccess', [['road', 'Road or tri bike'], ['other', 'Another bike (hybrid, mountain bike)'], ['trainer', 'Indoor trainer only'], ['none', 'No bike yet']], a.bikeAccess || 'road')}
    ${a.bikeAccess !== 'none' ? `<p class="q">Longest ride lately?</p>${radio('longestRide', RIDES, +a.rideKm > 0 ? a.longestRide : a.longestRide || '60')}${num('rideKm', 'Or type it exactly (replaces the choice above)', a.rideKm, 'km')}` : ''}
    <p class="q">Pool sessions possible per week?</p>${radio('poolPerWeek', [['0', 'None'], ['1', '1'], ['2', '2'], ['3', '3 or more']], a.poolPerWeek || '2')}
    <p class="q">Triathlons finished <span class="hint">optional</span></p><div class="choices">${TRI_RACES.map(([k, l]) => check(`race_${k}`, l, a[`race_${k}`])).join('')}</div>`;
}

function hybridCard(onMap = false) {
  if (!HYB.hasHybrid(S)) return '';
  const w = HYB.hybWorld(S), lim = HYB.limiter(S), b = HYB.blockInfo(S, now());
  const st = HYB.laneStatus(S);
  const blockLine = b.type === 'deload' ? '😮‍💨 <strong>Deload week</strong>: everything light. Next: ' + (b.next === 'engine' ? '⚡ Engine block' : '🏋️ Strength block')
    : `${b.type === 'engine' ? '⚡ <strong>Engine block</strong>' : '🏋️ <strong>Strength block</strong>'} · week ${b.week} of ${b.weeks}<br><span class="hint">Building ${b.type}, maintaining ${b.type === 'engine' ? 'strength' : 'engine'}. Then a deload week.</span>`;
  const other = b.type === 'engine' ? 'strength' : 'engine';
  return `<section class="card hyb-card" ${onMap ? '' : 'style="order:8"'}><p class="eyebrow">Hybrid · ${w.emoji} ${h(w.name)}${w.races?.length ? ` · ${h([...w.races].sort((a, b) => (b[0] === 'alphax') - (a[0] === 'alphax')).map(r => r[1]).join(' / '))}` : ''}</p>
    <p class="block-line">${blockLine}</p>
    <div class="block-bar">${Array.from({ length: BLOCK_WEEKS }, (_, i) => `<span class="${b.type !== 'deload' && i < b.week ? 'on' : ''}"></span>`).join('')}<span class="deload ${b.type === 'deload' ? 'on' : ''}"></span></div>
    <div class="lane-bars">${st.map(l => `<div class="${l.ok ? 'ok' : lim?.lane === l.lane ? 'lim' : ''}"><span>${HYB.LANE_ICON[l.lane]}</span><b>${h(l.lane === 'run' ? `Level ${S.run.level}` : l.have >= (l.lane === 'strength' ? HYB.STR_MAX : HYB.ENG_MAX) ? 'All done' : `${ST.sexText((l.lane === 'strength' ? HYB.strengthStage(S) : HYB.engineStage(S)).target, S.profile.sex)} next`)}</b><em>${h(w.name)} needs ${h(ST.sexText(HYB.laneTarget(l.lane, l.need), S.profile.sex))} ${l.ok ? '✓' : lim?.lane === l.lane ? '· limiter' : ''}</em></div>`).join('')}</div>
    ${['strength', 'engine', 'run'].some(l => BG.fast(S, l)) ? `<p class="hint">⚡ Comeback fast-track on ${['strength', 'engine', 'run'].filter(l => BG.fast(S, l)).map(l => HYB.LANE_ICON[l]).join(' ')}: gates open straight away, prove it and move on.</p>` : ''}
    <p class="hint">${S.hybrid.finished ? 'World Championships conquered 🌍' : lim ? `${HYB.LANE_ICON[lim.lane]} ${HYB.LANE_LABEL[lim.lane]} is your limiter.${lim.lane !== 'run' && !HYB.inFocus(S, lim.lane) ? ` ${lim.lane === 'engine' ? 'An' : 'A'} ${HYB.LANE_LABEL[lim.lane]} block would move it most.` : ''}` : S.rebuild.active ? gateLockedLine() : '🏁 All lanes ready: your race gate is open!'}</p>
    ${HYB.lanesReady(S) && HYB.gateSteps(S)[0]?.boss ? `<div class="banner info">🏁 <strong>Next: ${h(HYB.gateSteps(S)[0].title.replace(/^Boss: /, ''))}.</strong> That's a real race, so it isn't in your week: pick one under Races (Today), and log it here when you've done it. <button class="btn small" data-act="open-step" data-track="hyGate" data-idx="0">Log my race</button></div>` : ''}
    <div class="row wrap">${onMap ? '' : '<button class="btn small" data-act="goto-hyb-map">Open Hybrid map</button>'}
      ${b.type !== 'deload' ? `<button class="btn ghost small" data-act="block-switch" data-b="${other}">Switch to ${other} block</button><button class="btn ghost small" data-act="block-switch" data-b="deload">Deload now</button>` : `<button class="btn ghost small" data-act="block-switch" data-b="${b.next}">Start ${b.next} block now</button>`}</div>
    ${S.hybrid.speedFocus ? '<p class="banner info">⚡ <strong>Speed focus:</strong> your next blocks lean on engine and race-pace work to bring your race time down.</p>' : ''}
    <p class="hint">Use your category's official weights (${S.profile.sex === 'm' ? "men's" : S.profile.sex === 'f' ? "women's" : "men's or women's"}; Hyrox Open/Pro, Alpha X Base/Open). ${S.hybrid.gym !== 'full' ? 'No sled or ergs? Each exercise shows a swap.' : ''}</p></section>`;
}

function triCard() {
  if (!TRI.hasTri(S)) return '';
  const w = TRI.triWorld(S), lim = TRI.limiter(S);
  const st = TRI.laneStatus(S);
  return `<section class="card tri-card" style="order:8"><p class="eyebrow">Triathlon · ${w.emoji} ${h(w.name)}</p>
    <div class="lane-bars">${st.map(l => `<div class="${l.ok ? 'ok' : lim?.lane === l.lane ? 'lim' : ''}"><span>${TRI.LANE_ICON[l.lane]}</span><b>${h(l.lane === 'run' ? `Level ${S.run.level}` : l.have >= (l.lane === 'swim' ? TRI.SWIM_MAX : TRI.BIKE_MAX) ? 'All done' : `${(l.lane === 'swim' ? TRI.swimStage(S) : TRI.bikeStage(S)).target} gate next`)}</b><em>${h(w.name)} needs ${h(TRI.laneTarget(l.lane, l.need))} ${l.ok ? '✓' : lim?.lane === l.lane ? '· limiter' : ''}</em></div>`).join('')}</div>
    ${['swim', 'bike', 'run'].some(l => BG.fast(S, l)) ? `<p class="hint">⚡ Comeback fast-track on ${['swim', 'bike', 'run'].filter(l => BG.fast(S, l)).map(l => TRI.LANE_ICON[l]).join(' ')}: gates open straight away, prove it and move on.</p>` : ''}
    <p class="hint">${S.tri.finished ? 'Full distance conquered 🏆' : lim ? `${TRI.LANE_ICON[lim.lane]} ${TRI.LANE_LABEL[lim.lane]} is your limiter: it moves your triathlon most right now.` : S.rebuild.active ? gateLockedLine() : '🌉 All lanes ready: your transition gate is open!'}</p>
    <button class="btn small" data-act="goto-tri-map">Open Tri map</button></section>`;
}

function hybridRaces(a) {
  const formats = (pair) => [['solo', 'Solo'], ['pair', pair], ['relay', 'Relay']];
  const block = (key, name, info, extra) => `<div class="race-opt">
      <div class="race-head">${check(`hx_${key}`, `I have finished <strong>${name}</strong>`, a[`hx_${key}`])}${info ? tip(info, `About ${name}`) : ''}</div>
      ${a[`hx_${key}`] ? `<div class="race-detail">${extra}${timeField(`${key}Time`, 'Finish time (optional)', a[`${key}Time`], 'h:mm:ss')}</div>` : ''}</div>`;
  return `<p class="q">Hybrid races</p>
    ${block('alphax', 'Alpha X', 'Alpha X is about 75% endurance. Open: 10 x (800 m run + station), 8 km running. Base: 10 x (400 m run + station) with lighter weights. Your Hybrid plan adds real strength blocks on top.',
      `<label class="field"><span>Category</span>${select('alphaxCat', [['base', 'Base'], ['open', 'Open']], a.alphaxCat || 'base')}</label><label class="field"><span>Format</span>${select('alphaxFormat', formats('Pair'), a.alphaxFormat || 'solo')}</label>`)}
    ${block('hyrox', 'Hyrox', 'Hyrox is about 80% endurance: closer to an endurance race than truly hybrid. Your Hybrid plan adds real strength blocks on top.',
      `<label class="field"><span>Division</span>${select('hyroxDiv', [['open', 'Open'], ['pro', 'Pro']], a.hyroxDiv || 'open')}</label><label class="field"><span>Format</span>${select('hyroxFormat', formats('Doubles (pair)'), a.hyroxFormat || 'solo')}</label>`)}
    ${block('other', 'another competition', '',
      `<label class="field"><span>Which one?</span><input type="text" name="otherName" value="${h(a.otherName || '')}" list="events-list" maxlength="60" placeholder="e.g. CrossFit Open"><datalist id="events-list">${OTHER_EVENTS.map(e => `<option value="${e}">`).join('')}</datalist></label>`)}`;
}

// Ask the AI to look over all the answers for likely mistakes (units, typos, contradictions).
const CHECK_FIELDS = ['runsPerWeek', 'weeklyKm', 'longestKm', 'longestTime', 'best5kText', 'best5kMode', 'best10kText', 'best10kMode', 'continuous', 'dream', 'dreamEvent', 'dreamDate',
  'sex', 'bodyweight', 'squat5', 'deadlift5', 'pullups', 'liftUnit', 'liftMode', 'liftExp', 'row1000Text', 'swimDist', 'swimM', 'longestRide', 'rideKm', 'daysPerWeek'];
// What the AI is doing on the result screen: busy / ok / off (unreachable), per task.
ui.ai = {};
async function aiRun(task, text) {
  ui.ai[task] = 'busy'; refreshAiStatus();
  const r = await understand(task, text);
  ui.ai[task] = r ? 'ok' : 'off';
  refreshAiStatus();
  return r;
}
function aiStatusLine() {
  const st = Object.values(ui.ai);
  if (!st.length) return '';
  const cls = st.includes('busy') ? 'busy' : st.every(x => x === 'off') ? 'off' : 'ok';
  const txt = cls === 'busy' ? '🤖 The AI is reading your answers… (the careful model takes about 10 seconds)' : cls === 'off' ? '🤖 The AI couldn\'t answer this time: your placement uses the app\'s own rules (it still works).' : `🤖 The AI read your answers ✓${ui.aiModel?.model ? ` · ${aiLabel(ui.aiModel.model, ui.aiModel.provider, ui.aiModel.tier)}` : ''}`;
  return `<p class="ai-status ${cls}" id="ai-status">${txt}</p>`;
}
function refreshAiStatus() { const el = document.getElementById('ai-status'); if (el) el.outerHTML = aiStatusLine(); }
// "Not quite? Tell the AI": a correction box that sends the athlete's own words back for a second reading.
const aiFixBox = (task, prompt) => `<div class="ai-fix"><input type="text" id="ai-note-${task}" maxlength="240" placeholder="${h(prompt)}"><button type="button" class="btn small" data-act="ai-fix" data-task="${task}">Read again</button></div>`;

// Answers the AI may change for the athlete (after they said or confirmed the new value), and how to check them.
const CHECK_EDIT = {
  runsPerWeek: ['Runs per week', 'int', 0, 14], weeklyKm: ['Weekly km', 'num', 0, 300], longestKm: ['Longest run (km)', 'num', 0, 250],
  longestTime: ['Longest run (time)', 'time'], best5kText: ['Best 5K', 'time'], best10kText: ['Best 10K', 'time'], daysPerWeek: ['Training days', 'int', 1, 7],
  bodyweight: ['Bodyweight', 'num', 25, 400], squat5: ['Squat', 'num', 0, 600], deadlift5: ['Deadlift', 'num', 0, 700], pullups: ['Pull-ups', 'int', 0, 100],
  liftUnit: ['Lift units', ['kg', 'lb']], liftMode: ['Lifts are', ['5', '1']], row1000Text: ['1000 m row', 'time'], swimM: ['Longest swim (m)', 'num', 0, 20000], rideKm: ['Longest ride (km)', 'num', 0, 600],
};
function validChange(c) {
  const spec = CHECK_EDIT[c?.field];
  if (!spec) return null;
  const v = String(c.value ?? '').trim(), [label, type, lo, hi] = spec;
  if (Array.isArray(type)) return type.includes(v) ? { ...c, value: v, label } : null;
  if (type === 'time') return parseTime(v) != null ? { ...c, value: v, label } : null;
  const n = Number(v.replace(',', '.'));
  return isFinite(n) && n >= lo && n <= hi && (type !== 'int' || Number.isInteger(n)) ? { ...c, value: String(n), label } : null;
}
// Figures the app works out, so the AI doesn't have to (and doesn't misread the answers).
function derivedFacts(a) {
  const x = normalize(a), d = {};
  if (x.weeklyKm && x.runsPerWeek) d.kmPerRun = Math.round((x.weeklyKm / x.runsPerWeek) * 10) / 10;
  if (x.best5k) d.pace5kPerKm = formatTime(x.best5k / 5);
  if (x.best10k) d.pace10kPerKm = formatTime(x.best10k / 10);
  if (x.longestKm && x.weeklyKm) d.longestShareOfWeek = `${Math.round((x.longestKm / x.weeklyKm) * 100)}%`;
  return d;
}
// Only the answers that belong to the sports picked (old Triathlon or lifting answers left over from an
// earlier run of the questionnaire on this device must not reach the AI), plus which sports those are.
const TRI_ONLY = new Set(['swimDist', 'swimM', 'longestRide', 'rideKm']);
const LIFT_ONLY = new Set(['bodyweight', 'squat5', 'deadlift5', 'pullups', 'liftUnit', 'liftMode', 'liftExp', 'row1000Text']);
const checkKey = a => {
  const tracks = a.tracks?.length ? a.tracks : ['run'];
  const keep = k => !(TRI_ONLY.has(k) && !tracks.includes('tri')) && !(LIFT_ONLY.has(k) && !tracks.includes('hybrid'));
  return JSON.stringify({ tracks, ...Object.fromEntries(CHECK_FIELDS.filter(k => keep(k) && a[k] !== undefined && a[k] !== '').map(k => [k, a[k]])) });
};
// The answer check is a conversation: first the answers, then the athlete and the AI take turns.
async function checkAnswers(note = '') {
  const a = ui.ob.a, key = checkKey(a);
  if (!note) { if (a.check?.for === key) return; a.check = { for: key, issues: null, chat: [] }; }
  const chat = a.check?.chat || [];
  if (note) chat.push({ role: 'user', content: note });
  a.check = { ...(a.check || {}), for: key, chat, busy: true };
  if (document.querySelector('.result')) renderOnboarding();
  ui.ai.check = 'busy'; refreshAiStatus();
  const first = `ANSWERS: ${key}\nDERIVED (worked out by the app): ${JSON.stringify(derivedFacts(a))}`;
  const res = await understandChat('check', [{ role: 'user', content: first }, ...chat.filter(m => !m.trouble).map(({ role, content }) => ({ role, content }))]);
  const r = res.result;
  ui.ai.check = r ? 'ok' : 'off'; ui.aiModel = r ? { model: res.model, tier: res.tier, provider: res.provider } : ui.aiModel;
  const issues = Array.isArray(r?.issues) ? r.issues.filter(i => CHECK_FIELDS.includes(i.field)).slice(0, 3) : (a.check.issues || []);
  if (r?.reply) chat.push({ role: 'assistant', content: String(r.reply).slice(0, 500), changes: (r.changes || []).map(validChange).filter(Boolean).slice(0, 4) });
  else chat.push({ role: 'assistant', trouble: true, content: `${AI_TROUBLE[res.reason] || AI_TROUBLE.down} Your placement still works with the app's own rules, and you can fix answers with Back.`, changes: [] });
  ui.ob.a.check = { for: key, issues, chat, busy: false };
  if (document.querySelector('.result')) renderOnboarding();
}
// The check box on the result screen: what looks off, the conversation, and a reply box.
function checkBox() {
  const c = ui.ob.a.check;
  if (!c) return '';
  const issues = (c.issues || []).map(i => `<div class="check-item"><span>${h(i.message)}</span><button type="button" class="btn small" data-act="fix-field" data-field="${h(i.field)}">Fix it</button></div>`).join('');
  const talk = (c.chat || []).map((m, mi) => `<div class="cc-msg ${m.role} ${m.trouble ? 'trouble' : ''}">${m.trouble ? '⚠️ ' : ''}${h(m.content)}${m.trouble && mi === c.chat.length - 1 ? '<button type="button" class="btn small cc-change" data-act="check-retry">↻ Try again</button>' : ''}${(m.changes || []).map((ch, ci) => `<button type="button" class="btn small cc-change ${ch.applied ? 'done' : ''}" data-act="check-apply" data-m="${mi}" data-c="${ci}" ${ch.applied ? 'disabled' : ''}>${ch.applied ? '✓ Changed' : 'Apply'}: ${h(ch.label)} → ${h(ch.value)}</button>`).join('')}</div>`).join('');
  const box = `${issues}${talk ? `<div class="cc-thread">${talk}</div>` : ''}${c.busy ? '<p class="hint">🤖 Reading…</p>' : ''}
    <div class="ai-fix"><input type="text" id="ai-note-check" maxlength="400" placeholder="${talk ? 'Reply to the AI…' : 'e.g. "I run 3 times a week, 50 km" or "my lifts are in lb"'}"><button type="button" class="btn small" data-act="ai-fix" data-task="check" ${c.busy ? 'disabled' : ''}>Send</button></div>`;
  const via = ui.aiModel?.model ? `<span class="hint"> · ${h(aiLabel(ui.aiModel.model, ui.aiModel.provider, ui.aiModel.tier))}</span>` : '';
  if (c.issues?.length || talk) return `<div class="check-box"><strong>🤖 Quick check before we start</strong>${via}${box}<p class="hint">All correct? Just start your journey.</p></div>`;
  return c.issues ? `<details class="ai-more"><summary>Something looks wrong? Talk to the AI</summary>${box}</details>` : '';
}

// Ask the AI to turn other lifts / tests into squat and deadlift estimates (non-blocking).
async function readLifts(note = '') {
  const a = ui.ob.a, text = String(a.otherLifts || '').trim();
  if (!text || (a.liftsAI?.for === text && !note)) return;
  const r = await aiRun('lifts', `${text}${a.bodyweight ? ` (bodyweight ${a.bodyweight} ${a.liftUnit === 'lb' ? 'lb' : 'kg'})` : ''}${note ? `. Correction from the athlete: ${note}` : ''}`);
  if (!r || (!r.squat5Kg && !r.deadlift5Kg && !r.pullups)) { if (note && document.querySelector('.result')) { toast('The AI could not read that. Try the numbers, e.g. "squat 100 kg x 5".'); } return; }
  ui.ob.a.liftsAI = { for: text, ...r, accepted: true };
  if (document.querySelector('.result')) renderOnboarding();
}

// Ask the AI what the dream means (non-blocking). The result screen shows it for a yes / not quite.
async function readDream(note = '') {
  const a = ui.ob.a, text = [a.dream, a.dreamEvent].filter(Boolean).join(' · ');
  if (!text || (a.dreamAI?.for === text && !note)) return;
  const r = await aiRun('dream', note ? `${text}. Correction from the athlete about what they mean: ${note}` : text);
  if (!r || r.track === 'none') { if (note) toast('The AI could not read that. Try naming the race and the time, e.g. "Hyrox Open under 1:20".'); return; }
  ui.ob.a.dreamAI = { for: text, ...r, accepted: true, note };
  if (ui.ob && !S.placedAt || ui.retake) { const res = document.querySelector('.result'); if (res) renderOnboarding(); }
}

// Sessions a week they already do, across sports: runs, plus lifting / CrossFit, pool sessions and
// regular outside training. The "too many days too soon" check uses this, not runs alone.
function recentSessions(a, other = []) {
  const runs = a.runsPerWeek ?? (a.runsLast4w != null && a.runsLast4w !== '' ? Math.round(+a.runsLast4w / 4) : null);
  if (runs == null) return null;
  const lift = { y3: 3, y1_3: 3, lt1: 2 }[a.liftExp] || 0, pool = +a.poolPerWeek || 0;
  const outside = (other || []).reduce((n, o) => n + (o.days || []).length, 0);
  return +runs + ((a.tracks || []).includes('hybrid') || a.bg_crossfit || a.bg_strength ? lift : 0) + pool + outside;
}
function normalize(a) {
  const n = v => (v === '' || v == null || isNaN(parseFloat(v)) ? 0 : parseFloat(v));
  const best5k = a.best5kText != null ? raceMinutes(a.best5kText, a.best5kMode, 5) : n(a.best5k) || null;
  const best10k = a.best10kText != null ? raceMinutes(a.best10kText, a.best10kMode, 10) : n(a.best10k) || null;
  const longestMin = parseTime(a.longestTime);
  let longestKm = n(a.longestKm), longestEstimated = false;
  if (!longestKm && longestMin) { longestKm = estimateKm(longestMin, best5k); longestEstimated = true; }
  const hybrid = [];
  if (a.hx_alphax) hybrid.push({ event: 'Alpha X', category: a.alphaxCat || 'base', format: a.alphaxFormat || 'solo', time: parseTime(a.alphaxTime) });
  if (a.hx_hyrox) hybrid.push({ event: 'Hyrox', division: a.hyroxDiv || 'open', format: a.hyroxFormat || 'solo', time: parseTime(a.hyroxTime) });
  if (a.hx_other && a.otherName) hybrid.push({ event: String(a.otherName).slice(0, 60), time: parseTime(a.otherTime) });
  // A Hyrox or Alpha X Open finished solo or as a pair means 8 km of running in the race; Alpha X Base is 4 km.
  if (hybrid.some(r => (r.event === 'Hyrox' || (r.event === 'Alpha X' && r.category === 'open')) && r.format !== 'relay')) longestKm = Math.max(longestKm, 8);
  else if (hybrid.some(r => r.event === 'Alpha X' && r.format !== 'relay')) longestKm = Math.max(longestKm, 4);
  return {
    ...a,
    runsLast4w: a.runsPerWeek != null && a.runsPerWeek !== '' ? Math.round(n(a.runsPerWeek) * 4) : n(a.runsLast4w), runsPerWeek: a.runsPerWeek != null && a.runsPerWeek !== '' ? n(a.runsPerWeek) : (a.runsLast4w != null && a.runsLast4w !== '' ? Math.round(n(a.runsLast4w) / 4) : null), weeklyKm: n(a.weeklyKm), longestKm, longestEstimated, longestMin,
    best5k: best5k || null, best10k: best10k || null, hybridRaces: hybrid,
    triRaces: TRI_RACES.map(([k]) => k).filter(k => a[`race_${k}`]),
    row1000: parseTime(a.row1000Text) || null,
    // Lifts the athlete didn't type: the AI's estimate (if accepted) fills the gap, as 5-rep numbers.
    ...(a.liftsAI?.accepted && (a.liftMode === 'unknown' || !(+a.squat5 || +a.deadlift5)) ? {
      squat5: a.liftsAI.squat5Kg || '', deadlift5: a.liftsAI.deadlift5Kg || '', liftMode: '5',
      pullups: a.pullups || a.liftsAI.pullups || '', bodyweight: a.bodyweight || a.liftsAI.bodyweightKg || '' } : {}),
    ...(a.liftMode === 'unknown' && !a.liftsAI?.accepted ? { squat5: '', deadlift5: '' } : {}),
    continuous: a.continuous || 'none', pain: a.pain || 'none', daysPerWeek: (a.days || K.defaultDays(3)).length,
  };
}

// Family mode setup: who, with a grown-up, what they like, which days.
function kidSteps(a) {
  const all = obStepsAdult(a);
  return [all[0], all[1], { title: 'Family mode', why: 'Kids need play, not training plans. A grown-up sets this up with them.', body: `
        <div class="banner info">👨‍👩‍👧 <strong>For grown-ups:</strong> Family mode gives your child fun daily play missions (about 60 active minutes a day is the WHO goal, mostly play). No times, tests, calories, chat or sharing. Everything stays on this device.</div>
        <div class="choices">${check('guardian', 'I\'m a parent or guardian, and I\'ll be there for the missions', a.guardian)}</div>
        <p class="q">What do they enjoy? <span class="hint">pick any</span></p>
        <div class="choices">${KID_LIKES.map(([k, l]) => check(`kl_${k}`, l, a[`kl_${k}`])).join('')}</div>` },
    { title: 'Which days are best for play?', why: 'Every day counts, but we\'ll cheer loudest on these.', body: `<div class="day-picker">${K.DAY_NAMES.map((d, i) => `<label class="day-chip"><input type="checkbox" name="d_${i}" ${(a.days || [0, 1, 2, 3, 4, 5, 6]).includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>` },
    { title: 'Ready to play!', result: true, kid: true }];
}
function collectOb() {
  const form = $('#ob-form');
  if (!form) return;
  const a = ui.ob.a;
  const radios = new Set();
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { radios.add(el.name); if (el.checked) a[el.name] = el.value; }
    else if (el.type === 'checkbox') {
      if (el.name.startsWith('tr_')) {
        const k = el.name.slice(3);
        a.tracks = (a.tracks || ['run']).filter(x => x !== k).concat(el.checked ? [k] : []);
      } else if (el.name.startsWith('d_')) {
        const k = +el.name.slice(2);
        a.days = (a.days || K.defaultDays(3)).filter(x => x !== k).concat(el.checked ? [k] : []).sort((x, y) => x - y);
      } else if (el.name.startsWith('rf_')) {
        const k = el.name.slice(3);
        a.redFlags = (a.redFlags || []).filter(x => x !== k).concat(el.checked ? [k] : []);
      } else if (/^t\d$/.test(el.name)) { a.selfTest = { ...(a.selfTest || {}), [el.name]: el.checked }; }
      else a[el.name] = el.checked;
    } else a[el.name] = el.value;
  }
  // A single-choice question left empty (tapped again to clear) forgets its answer.
  for (const n of radios) if (!form.querySelector(`[name="${n}"]:checked`)) delete a[n];
}

function renderOnboarding() {
  const steps = obSteps(ui.ob.a);
  const i = Math.min(ui.ob.step, steps.length - 1);
  const st = steps[i];
  const back = i > 0 ? '<button type="button" class="btn ghost" data-act="ob-back">Back</button>' : '';
  const invited = ui.incoming && ui.incoming.from?.name ? `<div class="banner info">🏆 <strong>${h(ui.incoming.from.name)}</strong> ${ui.incoming.t === 'c' ? 'sent you a challenge' : 'invited you to run together'}! Finish this quick setup to see how it fits your level.</div>` : '';
  const returning = invited + (S.needsReassessment ? `<div class="banner info">Welcome back! A quick re-assessment places you again. You won't start more than 3 levels below Level ${S.needsReassessment.oldLevel}.</div>` : '');
  let body;
  if (st.kid) body = `<div class="result"><div class="result-badge">🌟</div><h2>Hi${ui.ob.a.name ? ` ${h(ui.ob.a.name)}` : ''}! Let's play.</h2>
        <p>Every day you get a fun play mission. Do it with your grown-up, tap <strong>We did it!</strong> and collect a sticker. Collect them all!</p>
        <p class="hint">For grown-ups: no training plans, timing, calorie numbers, AI chat, Strava or sharing in Family mode. At 13 the app moves on to Teen mode.</p></div>`;
  else if (st.result) {
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
        ${aiStatusLine()}
        ${checkBox()}
        ${(() => { const a = normalize(ui.ob.a), adv = TG.daysAdvice(recentSessions({ ...ui.ob.a, runsPerWeek: a.runsPerWeek }, otherFrom(ui.ob.a)), (ui.ob.a.days || K.defaultDays(3)).length, preview.placed, backgroundOf(ui.ob.a));
          return adv ? daysBanner(adv).replace(/<div class="row wrap">.*<\/div><\/div>$/s, '<div class="row wrap"><button type="button" class="btn small" data-act="fix-field" data-field="d_0">Change days</button></div></div>') : ''; })()}
        ${dreamLine({ ...normalize(ui.ob.a), ...(ui.ob.a.dreamAI?.accepted ? { target: targetFromAI(ui.ob.a.dreamAI) || undefined, dreamDate: ui.ob.a.dreamDate || ui.ob.a.dreamAI.date || '' } : {}) }, preview.placed)}
        ${ui.ob.a.dreamAI ? `<div class="ai-read ${ui.ob.a.dreamAI.accepted ? '' : 'off'}"><span>🤖 Here's what I understood: <strong>${h(ui.ob.a.dreamAI.summary || '')}</strong></span>
          <div class="row">${ui.ob.a.dreamAI.accepted ? '<button type="button" class="btn ghost small" data-act="dream-ai" data-v="0">Not quite</button>' : '<button type="button" class="btn ghost small" data-act="dream-ai" data-v="1">Use this reading</button>'}</div>
          ${!ui.ob.a.dreamAI.accepted ? aiFixBox('dream', 'What did you mean? e.g. "Hyrox Pro, not Open, by next June"') : ''}</div>` : ''}
        ${(ui.ob.a.tracks || []).includes('hybrid') ? (() => { const hy = HYB.placeHybrid(preview.state, normalize(ui.ob.a), now()); const w = HYBRID_WORLDS[hy.world];
          const lr = HYB.readLifts(normalize(ui.ob.a), ui.ob.a.sex);
          return `<div class="dream-box"><strong>🏋️⚙️🏃 Hybrid: ${w.emoji} ${h(w.name)}</strong>${lr.level ? `<br><span class="hint">Read as: ${[lr.sqRatio ? `squat ${lr.sqRatio.toFixed(1)}x bodyweight` : '', lr.dlRatio ? `deadlift ${lr.dlRatio.toFixed(1)}x` : ''].filter(Boolean).join(' · ')} (bodyweight ${Math.round(lr.bwKg)} kg). Wrong? Check kg / lb.</span>` : ''}<br><span class="hint">Strength: ${h(ST.sexText(HYB.laneTarget('strength', hy.strength.stage + 1), ui.ob.a.sex))} next · Engine: ${h(HYB.laneTarget('engine', hy.engine.stage + 1))} next · starting with a ${hy.block.type === 'engine' ? '⚡ Engine' : '🏋️ Strength'} block</span></div>
            ${ui.ob.a.liftsAI ? `<div class="ai-read ${ui.ob.a.liftsAI.accepted ? '' : 'off'}"><span>🤖 I read your lifts as: <strong>${h(ui.ob.a.liftsAI.summary || '')}</strong>${ui.ob.a.liftsAI.confidence === 'low' ? ' <em class="hint">(rough estimate)</em>' : ''}</span>
              <div class="row"><button type="button" class="btn ghost small" data-act="lifts-ai" data-v="${ui.ob.a.liftsAI.accepted ? 0 : 1}">${ui.ob.a.liftsAI.accepted ? 'Not quite' : 'Use this estimate'}</button></div>
              ${!ui.ob.a.liftsAI.accepted ? aiFixBox('lifts', 'Correct it, e.g. "those were in lb" or "bench 100 kg for 3"') : ''}</div>` : ''}`; })() : ''}
        ${(ui.ob.a.tracks || []).includes('tri') ? (() => { const tri = TRI.placeTri(preview.state, normalize(ui.ob.a)); const w = TRI_WORLDS[tri.world];
          return `<div class="dream-box"><strong>🏊🚴🏃 Triathlon: ${w.emoji} ${h(w.name)}</strong><br><span class="hint">Swim: ${h(TRI.laneTarget('swim', tri.swim.stage + 1))} next · Bike: ${h(TRI.laneTarget('bike', tri.bike.stage + 1))} next · Run: your Run level${tri.learnToSwim ? ' · starting with swim lessons' : ''}</span></div>`; })() : ''}
        ${backgroundOf(ui.ob.a).length ? `<div class="dream-box">🏅 <strong>Welcome back, athlete.</strong><br><span class="hint">${h(BG.describe(backgroundOf(ui.ob.a)).join(' · '))}. Your technique is credited and your gates open early while you climb back: muscle memory is real.</span></div>` : ''}
        <p><strong>Prep Track:</strong> P${ps.n} ${h(ps.name)} (${h(ps.focus)})</p>
        ${normalize(ui.ob.a).longestEstimated ? `<p class="hint">Longest run estimated at about ${normalize(ui.ob.a).longestKm} km from its time.</p>` : ''}
        ${normalize(ui.ob.a).hybridRaces.length ? `<p class="hint">Races on record: ${h(normalize(ui.ob.a).hybridRaces.map(raceLabel).join(', '))}. They count toward your Hybrid placement.</p>` : ''}
        ${rb.active ? `<div class="banner warn"><strong>Rebuild Track first.</strong> Because you reported pain, you start with the Rebuild Track. Your level is saved and you come back to it afterwards.${rb.seeProfessional ? ' Please get it checked by a physio or doctor first.' : ''}</div>` : ''}
        <p class="hint">🔗 Use Strava? After you start, connect it in Me and your workouts come in by themselves.</p>
      </div>`;
  } else body = st.body;
  $('#app').innerHTML = `
    <main class="onboarding">
      <div class="ob-top"><button type="button" class="brand brand-btn" data-act="about-me" title="About Stride Quest"><img class="brand-logo" src="icons/logo-96.png" alt="" width="28" height="28">Stride Quest</button><div class="progress"><div style="width:${((i + 1) / steps.length) * 100}%"></div></div></div>
      ${returning}
      <form id="ob-form" class="card ob-card" autocomplete="off">
        ${!st.welcome && !st.result ? `<p class="eyebrow">Question ${i} of ${steps.length - 2}</p>` : ''}
        <h1>${h(st.title)}</h1>
        ${st.why ? `<p class="why">💡 ${h(st.why)}</p>` : ''}
        ${body}
        ${st.welcome && ui.retake && S.answers ? `<div class="same-answers"><p class="hint">This is a fresh questionnaire: new answers, new result. Nothing changed? Skip the questions and go straight to your result with the answers you gave last time.</p><button type="button" class="btn" data-act="ob-same">↩️ Use my previous answers</button></div>` : ''}
        <div class="row end">${back}${st.result ? '<button type="button" class="btn primary" data-act="ob-finish">Start my journey</button>' : `<button type="submit" class="btn primary">${st.welcome ? "Let's start" : 'Next'}</button>`}</div>
      </form>
    </main>`;
}

// ---------- shell ----------
function render() {
  if (!S.placedAt || S.needsReassessment || ui.retake) { $('#app').className = ''; renderOnboarding(); renderModal(); return; }
  $('#app').className = 'shell';
  if (HYB.hasHybrid(S)) { const next = HYB.refreshHybrid(S, now(), E.weekKey(now())); if (next !== S) { S = next; store.save(S); } }
  if (S.placedAt && !S.prep?.credited) { const r = E.creditPrep(S, now()); S = r.state; store.save(S); if (r.msgs.length) setTimeout(() => toast(r.msgs.join(' ')), 600); }
  const frame = document.querySelector('.worldmap');
  if (frame) ui.frameTop = frame.scrollTop; // keep the framed map's scroll across redraws
  const t = now();
  const kid = AGE.isKid(S);
  if (kid && !['today', 'me'].includes(ui.tab)) ui.tab = 'today';
  const views = kid ? { today: viewKids, me: viewKidMe } : { today: viewToday, map: viewMap, challenge: viewChallenge, events: viewCompetitions, stats: viewStats, nutrition: viewNutrition, coach: viewCoach, me: viewMe };
  $('#app').innerHTML = `
    <header class="top">
      <button type="button" class="brand brand-btn" data-act="about-me" title="About Stride Quest"><img class="brand-logo" src="icons/logo-96.png" alt="" width="28" height="28">Stride Quest</button>
      <div class="chips"><button class="chip help-btn" data-act="help" title="How the app works" aria-label="Help">❓<span class="help-word"> Help</span></button><span class="chip" title="Total XP: ${S.xp}">⚡ ${S.xp >= 10000 ? `${(S.xp / 1000).toFixed(1).replace(/\.0$/, '')}k` : S.xp}<span class="xp-word"> XP</span></span><span class="chip" title="Day streak">🔥 ${E.dayStreak(S, t)}</span></div>
    </header>
    <main class="view view-${ui.tab}">${views[ui.tab]()}</main>
    <nav class="tabs">${(kid ? [['today', '🌟', 'Play'], ['me', '👤', 'Me']] : [['today', '🏠', 'Today'], ['map', '🗺️', 'Map'], ['challenge', '🏆', 'Challenge'], ['events', '🗓️', '<em class="long">Competitions </em>Calendar'], ['stats', '📊', 'Stats'], ['nutrition', '🍽️', 'Nutrition'], ['me', '👤', 'Me']]).map(([k, i, l]) =>
      `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"${k === 'events' ? ' aria-label="Competitions Calendar"' : ''}><span>${i}</span><b class="lbl">${l}</b></button>`).join('')}</nav>
    ${ui.tab === 'coach' || kid ? '' : coachFab()}`;
  queueModals();
  renderModal();
  if (ui.tab === 'coach') { const log = $('.chat-log'); if (log) log.scrollTop = log.scrollHeight; }
  if (ui.tab === 'coach' && ui.chatDraft != null) { const inp = document.querySelector('#chat-form [name=msg]'); if (inp) { inp.value = ui.chatDraft; inp.focus(); } ui.chatDraft = null; }
  if (ui.tab === 'map' && ui.mapMode === 'world') afterMapRender();
  if (ui.tab === 'map' && (ui.mapMode === 'tri' || ui.mapMode === 'hyb')) afterTriRender();
  fogRevealedToast();
  tourFlag(`tab_${ui.tab}`);
  rewardQuests();
  document.querySelector('.tip-bubble:not(.offer)')?.remove();
  tourBar();
  if (!ui.tour && !ui.helpReturn) setTimeout(maybeTip, 600);
}

function fogRevealedToast() {
  if (!ui.fogRevealed) return;
  ui.fogRevealed = null; sfx.levelDing(4);
  if (Date.now() - (ui.fogToastAt || 0) < 30000) return; // one toast per climb, the chime every time
  ui.fogToastAt = Date.now();
  setTimeout(() => toast('☁️ The clouds part: a new world is revealed!'), 400);
}
// The Engine character reaches a level: bends down, lifts the plate lying there onto the sled, carries on.
function pickPlate(id, v, pt) {
  const gp = document.getElementById(`gp-${id}-${v}`), av = document.getElementById(`ln-av-${id}-engine`);
  if (!gp || !av) return 0;
  const [gx, gy] = (gp.getAttribute('transform').match(/-?[\d.]+/g) || [0, 0]).map(Number);
  av.classList.add('pickup');
  sfx.plateLoad(S.profile.sex);
  gp.style.transform = `translate(${gx}px, ${gy}px)`;
  gp.getBoundingClientRect(); // start the move from where it lies
  gp.style.transition = 'transform .45s cubic-bezier(.3, 1.3, .6, 1)';
  setTimeout(() => { gp.style.transform = `translate(${pt.x + 14}px, ${pt.y - 26}px) scale(.75)`; }, 300);
  setTimeout(() => { gp.remove(); setPlates(id, v, S.profile.sex); }, 780);
  setTimeout(() => av.classList.remove('pickup'), 1150);
  return 1300;
}
// At the fog's edge: lift one world of clouds and hold the character for a moment.
const FOG_PAUSE = 1500;
function fogGate(parts, y, next) {
  if (parts.edgeY == null || y > parts.edgeY + 30) return 0;
  swapFog(next());
  return FOG_PAUSE;
}
// Swap just the fog layer while a character climbs, so the clouds lift as they go.
function swapFog(parts) {
  const map = document.querySelector('.worldmap'), svg = map?.querySelector('svg');
  if (!svg) return;
  svg.querySelectorAll(':scope > .fog, :scope > .fog-reveal').forEach(n => n.remove());
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML = parts.svg;
  const before = svg.querySelector(':scope > .lane-ch, :scope > #avatar');
  [...g.childNodes].forEach(n => svg.insertBefore(n, before));
  const canvas = map.querySelector('.map-canvas');
  canvas.style.marginTop = `-${((parts.crop / MAP_W) * 100).toFixed(3)}%`;
  map.querySelector('.fog-peek')?.remove();
  map.classList.remove('peek');
  if (parts.peek) canvas.insertAdjacentHTML('beforeend', parts.peek);
  fogRevealedToast();
}

function queueModals() {
  if (ui.modal || AGE.isKid(S)) return;
  const t = now();
  if (ui.incoming && !ui.mapRunning && !ui.intro) { openIncoming(); if (ui.modal) return; }
  // Busy / travel mode lasts a week, then the normal plan comes back by itself.
  if (S.mode?.type === 'busy' && t - S.mode.since > 7 * E.DAY) { S = E.endMode(S, t).state; store.save(S); setTimeout(() => toast('🧳 Busy week over: your normal plan is back.'), 800); }
  if (!S.mode && E.returnCheck(S, t).needed && !ui.dismissed.has('return')) ui.modal = { type: 'return', step: 0 };
  else if (E.pendingChecks(S, t).length && !ui.dismissed.has('morning')) ui.modal = { type: 'morning' };
}

function banners() {
  const out = [];
  if (TRI.hasTri(S) && S.tri.learnToSwim && S.tri.swim.stage === 0) out.push('<div class="banner info"><strong>🏊 Learning to swim?</strong> Lessons with a coach are the fastest, safest start. Never swim alone; choose a lifeguarded pool.</div>');
  if (S.mode?.type === 'sick') out.push(`<div class="banner warn"><strong>🤒 Sick mode.</strong> ${S.mode.where === 'above' ? 'Only easy movement, and only if you feel like it.' : 'Full rest: no training.'} Your streak is frozen, nothing is lost. <button class="link" data-act="mode-end">I'm better</button></div>`);
  if (S.mode?.type === 'busy') out.push(`<div class="banner info"><strong>🧳 Busy mode.</strong> Only Key sessions this week; short versions count. <button class="link" data-act="mode-end">Back to normal</button></div>`);
  if (S.rebuild.active && S.rebuild.redFlag) out.push(`<div class="banner danger"><strong>Running is paused.</strong> You reported warning signs. Please see a physio or doctor. Gentle mobility is still open. <strong>Locked for now:</strong> runs, swim, bike, lifting and race gates. <button class="link" data-act="cleared">I've been cleared</button></div>`);
  else if (S.rebuild.active) out.push(`<div class="banner warn"><strong>Rebuild Track · R${S.rebuild.stage + 1} ${h(REBUILD_STAGES[S.rebuild.stage].name)}.</strong> Your Run level ${S.rebuild.savedRunLevel} is saved. Keep pain at 2/10 or less.${S.rebuild.seeProfessional ? ' Not medical advice: a physio check is a good idea.' : ''} <strong>Locked for now:</strong> race gates (and hard runs) until the Rebuild Track is done. <button class="link" data-act="painfree">I'm pain-free now</button></div>`);
  if (S.refresher) out.push(S.refresher.reason === 'illness'
    ? `<div class="banner info"><strong>💛 Recovery plan.</strong> Easy health checks first, then you're back on your map${S.run.reclaim ? ` to reclaim Level ${S.run.reclaim}` : ''}. Feeling great early? The Prove It run fast-tracks you.</div>`
    : `<div class="banner info"><strong>Refresher course.</strong> Welcome back! Start with the Prove It run: hit it and you skip the rest.</div>`);
  // Training days that don't fit the athlete: too many too soon (beginners), 7 days with no rest, or too
  // few to keep progressing (intermediate and advanced).
  const recent = recentSessions({ ...(S.answers || {}), tracks: S.profile.tracks }, S.otherTraining);
  const adv = TG.daysAdvice(recent, S.profile.days?.length, S.run.level, S.background);
  if (adv && !ui.dismissed.has('days')) out.push(daysBanner(adv, now() - (S.placedAt || 0) < 28 * E.DAY));
  const spike = TG.loadSpike(S.history, now());
  if (spike && !ui.dismissed.has('spike')) out.push(`<div class="banner warn">⚠️ <strong>Big week!</strong> ${spike.week} sessions in the last 7 days, versus your usual ${spike.usual}. Sudden jumps are when most injuries happen. Make the next day or two easy or rest: the gains come when you recover. <button class="linkish" data-act="dismiss-banner" data-key="spike">OK</button></div>`);
  const blockedAt = E.prepBlocksRun(S);
  if (blockedAt != null) out.push(`<div class="banner info"><strong>Level ${S.run.level} cleared! 🎉</strong> Level ${S.run.level + 1} also needs body prep <strong>P${blockedAt}</strong>, and you're at P${S.prep.level}${blockedAt - S.prep.level > 1 ? ` (${blockedAt - S.prep.level} stages to go)` : ''}. Your week now brings Prep Track sessions; Level ${S.run.level + 1} opens as soon as you reach P${blockedAt}.
      <div class="row"><button class="btn small" data-act="prep-stage" data-n="${S.prep.level}">See my Prep steps</button></div></div>`);
  if (S.run.reclaim && blockedAt == null) out.push(`<div class="banner reclaim">🔒 <strong>Reclaim:</strong> ${h(E.runLevel(S.run.reclaim).name)} (Level ${S.run.reclaim}) is waiting for you.</div>`);
  return out.join('');
}

function daysBanner(a, recentStart = true) {
  const btns = `<div class="row wrap"><button class="btn small" data-act="edit-days">Change training days</button><button class="btn ghost small" data-act="dismiss-banner" data-key="days">Keep ${a.to}</button></div>`;
  if (a.kind === 'many' && a.noRest) return `<div class="banner warn">⚠️ <strong>7 days a week, no rest?</strong> Even elite athletes keep at least one rest or very easy day: that's when the body adapts. ${a.hi} days plus a rest day fits you.${btns}</div>`;
  if (a.kind === 'many') return recentStart ? `<div class="banner warn">⚠️ <strong>Easy does it.</strong> You've been training about ${a.from} time${a.from === 1 ? '' : 's'} a week and picked ${a.to} training days. Jumping straight up is a classic way to get hurt. Start with <strong>${a.start} days</strong> and add one more every 3–4 weeks: you'll get there faster by staying injury-free.${btns}</div>` : '';
  return `<div class="banner info">💡 <strong>${a.to} day${a.to === 1 ? '' : 's'} a week keeps you fit, but at your level it's slow going.</strong> ${a.lo}–${a.hi} days is what moves ${a.tier === 'advanced' ? 'an advanced runner' : 'you'} forward. Short on time? Two of them can be short, easy sessions.${btns}</div>`;
}

// A ready gate is still locked during the Rebuild Track: say so instead of "open".
const gateLockedLine = () => (S.rebuild.redFlag ? '🔒 All lanes ready, but the race gate stays locked until you\'re cleared. <button class="link" data-act="cleared">I\'ve been cleared</button>'
  : '🔒 All lanes ready, but the race gate is locked while you\'re on the Rebuild Track. <button class="link" data-act="painfree">I\'m pain-free now</button>');
const STATUS_ICON = { done: '✅', provisional: '⏳', open: '<span class="dot"></span>', locked: '🔒', slot: '🧱' };
const TYPE_LABEL = { run: 'Run', swim: 'Swim', bike: 'Bike', lift: 'Lift', engine: 'Engine', maint: 'Maintain', prep: 'Prep', slot: 'Prep slot', rest: 'Rest', gate: 'Gate', proveit: 'Prove It' };

// A session's exercises with cues and demo links (the step pop-up and the read-only details share it).
function exHtml(st) {
  return (st.ex || []).map(id => EXERCISES[id] && `<li class="ex">
        <div><strong>${h(EXERCISES[id].name)}</strong> <span class="dose">${h(EXERCISES[id].dose)}</span></div>
        <ul>${EXERCISES[id].cues.map(c => `<li>${h(c)}</li>`).join('')}</ul>
        ${EXERCISES[id].alt && S.hybrid && S.hybrid.gym !== 'full' ? `<p class="hint">🔁 ${h(EXERCISES[id].alt)}</p>` : ''}
        <div class="row wrap"><button type="button" class="btn small" data-act="videos" data-ex="${id}">▶ Watch how</button><a class="hint" href="${videoLink(id)}" target="_blank" rel="noopener">Search YouTube ↗</a></div></li>`).join('') + raceNote(st);
}
// ---------- demo videos: YouTube search inside the app, played in place, rated by everyone ----------
const VOTES_KEY = 'stride-quest:votes';
const myVotes = () => { try { return JSON.parse(localStorage.getItem(VOTES_KEY)) || {}; } catch { return {}; } };
const setMyVote = (k, v) => { try { const all = myVotes(); if (v) all[k] = v; else delete all[k]; localStorage.setItem(VOTES_KEY, JSON.stringify(all)); } catch { /* ignore */ } };
async function videoApi(body) {
  if (!WORKER_URL) return { error: 'offline' };
  try {
    const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return r.ok ? d : { error: d.error || 'busy', reason: d.reason };
  } catch { return { error: 'offline' }; }
}
const vidCache = {};
function videoList(panel, q, list) {
  const votes = myVotes();
  panel.innerHTML = `<p class="q">Demo videos <span class="hint">· most helpful first, rated by Stride Quest athletes</span></p>
    <div class="vid-list">${list.map(v => `<button type="button" class="vid-item" data-act="vid-play" data-id="${h(v.id)}">
      <span class="vid-thumb"><img src="${h(v.thumb || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`)}" alt="" loading="lazy">${v.duration ? `<em>${h(v.duration)}</em>` : ''}</span>
      <span class="vid-meta"><strong>${h(v.title)}</strong><span class="hint">${h(v.channel || '')}${v.up ? ` · 👍 ${v.up}` : ''}${votes[`${q}|${v.id}`] === 1 ? ' · you liked it' : ''}${v.suggested ? ' · suggested by athletes' : ''}</span></span></button>`).join('')}</div>
    <details class="vid-suggest"><summary class="hint">Know a better video? Paste a link</summary>
      <div class="ai-fix"><input type="url" placeholder="https://youtube.com/watch?v=…" maxlength="200"><button type="button" class="btn small" data-act="vid-suggest">Add</button></div></details>`;
}
function videoPlayer(panel, q, v) {
  const mine = myVotes()[`${q}|${v.id}`] || 0;
  panel.innerHTML = `<div class="vid-frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1" title="${h(v.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>
    <p class="vid-title"><strong>${h(v.title)}</strong> <span class="hint">${h(v.channel || '')}</span></p>
    <div class="row wrap vid-rate"><span class="hint">Was it helpful?</span>
      <button type="button" class="btn small ${mine === 1 ? 'on' : ''}" data-act="vid-vote" data-id="${h(v.id)}" data-v="1">👍 Helpful${v.up + (mine === 1 ? 0 : 0) ? ` · ${v.up}` : ''}</button>
      <button type="button" class="btn small ${mine === -1 ? 'on' : ''}" data-act="vid-vote" data-id="${h(v.id)}" data-v="-1">👎 Not great</button>
      <span class="grow"></span><button type="button" class="btn ghost small" data-act="vid-back">◂ Other videos</button></div>`;
}
const panelOf = el => el.closest('.ex')?.querySelector('.vid-panel');

// Any session anywhere opens: open ones to log, the rest read-only.
const sessionAct = (track, idx, status) => (status === 'open' || status === 'slot' ? `data-act="open-step" data-track="${track}" data-idx="${idx}"` : `data-act="step-info" data-track="${track}" data-idx="${idx}"`);

function stepRow(track, st) {
  return `<li class="step ${st.status} t-${st.type}">
      <button ${sessionAct(track, st.idx, st.status)}>
        <span class="icon">${STATUS_ICON[st.status]}</span>
        <span class="txt"><span class="type">${TYPE_LABEL[st.type]}${st.boss ? ' · Boss' : ''}</span>${h(st.title)}${st.swapped ? ' <em class="hint">(swapped)</em>' : ''}${st.status === 'provisional' ? '<em class="hint"> done: counts after tomorrow morning\'s check</em>' : ''}${st.lockReason ? `<em class="lock-why">🔒 ${h(st.lockReason)}</em>` : ''}</span>
        <span class="xp">${st.xp ? `+${st.xp}` : ''}</span>
      </button></li>`;
}

function trackTitle(track) {
  if (track === 'run') { const l = E.runLevel(S.run.level); return `${E.worldOf(l).emoji} Level ${l.n} · ${h(l.name)}`; }
  if (track === 'prep') { const p = PREP_STAGES[S.prep.level]; return `🧱 Prep P${p.n} · ${h(p.name)}`; }
  if (track === 'rebuild') { const r = REBUILD_STAGES[S.rebuild.stage]; return `🩹 Rebuild R${r.n} · ${h(r.name)}`; }
  if (track === 'strength') return `🏋️ Strength · ${h(HYB.strengthStage(S).name)}`;
  if (track === 'engine') return `⚙️ Engine · ${h(HYB.engineStage(S).name)}`;
  if (track === 'hyGate') return `🏁 ${h(HYB.hybWorld(S).name)} race gate`;
  if (track === 'hyMaint') return S.hybrid.block.type === 'deload' ? '😮‍💨 Deload week' : `🔧 Maintaining ${S.hybrid.block.type === 'engine' ? 'strength' : 'engine'}`;
  if (track === 'swim') return `🏊 Swim · ${h(TRI.swimStage(S).name)} (${h(TRI.swimStage(S).target)})`;
  if (track === 'bike') return `🚴 Bike · ${h(TRI.bikeStage(S).name)} (${h(TRI.bikeStage(S).target)})`;
  if (track === 'triGate') return `🌉 ${h(TRI.triWorld(S).name)} transition gate`;
  return S.refresher?.reason === 'illness' ? '💛 Recovery plan' : '🔄 Refresher course';
}

// ---------- tutorial: getting started, "Show me", how it works, first-time tips ----------
// Device-level: what this person has seen or done here (tabs opened, tips dismissed).
const TOUR_KEY = 'stride-quest:tour';
const tourLocal = () => { try { return JSON.parse(localStorage.getItem(TOUR_KEY)) || {}; } catch { return {}; } };
const setTourLocal = v => { try { localStorage.setItem(TOUR_KEY, JSON.stringify(v)); } catch { /* ignore */ } };
function tourFlag(k) { const t = tourLocal(); if (t.flags?.[k]) return; setTourLocal({ ...t, flags: { ...(t.flags || {}), [k]: true } }); }
const applies = (f, s = S) => !f.when || f.when(s);
const quests = () => FEATURES.filter(f => f.quest && applies(f) && (!f.quest.when || f.quest.when(S)));
const questDone = f => !!f.quest.done(S, tourLocal().flags || {});
const QUEST_XP = 5;
// New quests done since last time: a little XP each (once, saved with progress).
function rewardQuests() {
  const got = quests().filter(f => questDone(f) && !S.tour?.rewarded?.[f.id]);
  if (!got.length) return;
  S.tour = { ...(S.tour || {}), rewarded: { ...(S.tour?.rewarded || {}), ...Object.fromEntries(got.map(f => [f.id, true])) } };
  S.xp += QUEST_XP * got.length;
  got.forEach(f => S.history.push({ ts: now(), kind: 'bonus', xp: QUEST_XP, title: `Getting started: ${f.quest.label}` }));
  store.save(S);
  setTimeout(() => toast(`🧭 +${QUEST_XP * got.length} XP: ${got.map(f => f.quest.label).join(', ')}`), 300);
}
function gettingStarted(style = '') {
  if (S.tour?.hidden) return '';
  const qs = quests(), done = qs.filter(questDone).length;
  if (done === qs.length) return '';
  return `<details class="card tour-card" ${style} ${ui.tourOpen ? 'open' : ''}><summary data-act="tour-open"><span class="lc-title">🧭 Getting started: ${done} of ${qs.length}</span><span class="hint">Optional. Little steps to find your way around, +${QUEST_XP} XP each.</span></summary>
      <ul class="tour-list">${qs.map(f => { const ok = questDone(f); return `<li class="${ok ? 'done' : ''}"><span>${ok ? '✅' : '⬜'}</span><span>${h(f.quest.label)}</span>${ok ? '' : `<button class="btn small" data-act="show-me" data-f="${f.id}">Show me</button>`}</li>`; }).join('')}</ul>
      <div class="row end"><button class="btn ghost small" data-act="tour-hide">Hide getting started</button></div>
    </details>`;
}
// The guided tour: one stop per key feature, a bar at the bottom with Back / Next / End.
const TOUR = ['today-next', 'views', 'map', 'fog', 'lanes', 'sled', 'race-prep', 'calendar', 'challenge', 'stats', 'nutrition', 'coach', 'numbers', 'dream'];
const tourStops = () => TOUR.map(id => FEATURES.find(f => f.id === id)).filter(f => f && applies(f));
function startTour(i = 0) { document.querySelector('.tip-bubble')?.remove(); ui.tour = { i }; ui.helpReturn = false; tourGo(); }
function tourGo() {
  const stops = tourStops(), f = stops[ui.tour.i];
  if (!f) return endTour(true);
  showMe(f.id, { keepBar: true });
}
function endTour(finished) {
  ui.tour = null; ui.helpReturn = false; document.querySelector('.tour-bar')?.remove();
  if (finished) { tourFlag('tour_done'); toast('🧭 Tour done! Everything is under ❓ Help at the top whenever you need it.'); }
}
// Drawn after every render (the bar lives outside the page, so it survives redraws).
function tourBar() {
  document.querySelector('.tour-bar')?.remove();
  if (ui.modal || (!ui.tour && !ui.helpReturn)) return;
  const b = document.createElement('div');
  b.className = 'tour-bar';
  if (ui.tour) {
    const stops = tourStops(), f = stops[ui.tour.i];
    if (!f) return;
    b.innerHTML = `<p><strong>🧭 Tour ${ui.tour.i + 1} of ${stops.length} · ${h(f.title)}</strong><br>${h(f.text)}</p>
      <div class="row"><button class="btn ghost small" data-act="tour-end">✕ End</button><span class="grow"></span>
        ${ui.tour.i > 0 ? '<button class="btn ghost small" data-act="tour-step" data-d="-1">◂ Back</button>' : ''}
        <button class="btn small" data-act="tour-step" data-d="1">${ui.tour.i + 1 < stops.length ? 'Next ▸' : 'Finish ✓'}</button></div>`;
  } else {
    b.innerHTML = `<div class="row"><button class="btn small" data-act="help-back">↩ Back to Help</button><span class="grow"></span><button class="btn ghost small" data-act="tour-end">✕</button></div>`;
  }
  document.body.appendChild(b);
}

// The Help panel (❓ Help in the header): open getting-started steps, then the whole guide.
function helpPanel() {
  const qs = quests(), done = qs.filter(questDone).length, t = tourLocal();
  const steps = S.tour?.hidden ? `<p class="hint">Getting started is hidden. <button class="linkish" data-act="tour-unhide">Show it again</button></p>`
    : done < qs.length ? `<div class="help-steps"><p class="q">🧭 Getting started: ${done} of ${qs.length}</p><div class="bar"><div style="width:${Math.round((done / qs.length) * 100)}%"></div></div>
        <ul class="tour-list">${qs.filter(f => !questDone(f)).map(f => `<li><span>⬜</span><span>${h(f.quest.label)}</span><button class="btn small" data-act="show-me" data-f="${f.id}">Show me</button></li>`).join('')}</ul></div>`
    : '<p class="hint">🧭 Getting started: all done 🎉</p>';
  return `<div class="help-panel"><h2>❓ Help</h2><p class="why">💡 Everything the app can do, in plain words. "Show me" takes you there.</p>
      <button class="btn primary wide" data-act="tour-start">▶ Take the tour (about 1 minute)</button>${steps}
      ${GROUPS.map(([g, label]) => { const fs = FEATURES.filter(f => f.group === g && applies(f)); return fs.length ? `<details class="help-group"><summary>${h(label)}</summary>${fs.map(f => `<div class="how-item"><strong>${h(f.title)}</strong><p class="hint">${h(f.text)}</p><button class="btn small" data-act="show-me" data-f="${f.id}">Show me</button></div>`).join('')}</details>` : ''; }).join('')}
      <label class="switch-row"><input type="checkbox" data-act="tips-toggle" ${t.tipsOff ? '' : 'checked'}> <span>First-time tips</span></label>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Close</button></div></div>`;
}

function howItWorks() {
  const t = tourLocal();
  return `<section class="card how-card"><h3>📖 How it works</h3><p class="hint">Everything the app can do, in plain words. "Show me" takes you there.</p>
      ${GROUPS.map(([g, label]) => { const fs = FEATURES.filter(f => f.group === g && applies(f)); return fs.length ? `<details><summary>${h(label)}</summary>${fs.map(f => `<div class="how-item"><strong>${h(f.title)}</strong><p class="hint">${h(f.text)}</p><button class="btn small" data-act="show-me" data-f="${f.id}">Show me</button></div>`).join('')}</details>` : ''; }).join('')}
      <div class="row wrap">${S.tour?.hidden ? '<button class="btn small" data-act="tour-unhide">Show getting started again</button>' : ''}
        <label class="switch-row"><input type="checkbox" data-act="tips-toggle" ${t.tipsOff ? '' : 'checked'}> <span>First-time tips</span></label></div>
    </section>`;
}
// "Show me": go to the place, scroll to it and light it up.
function showMe(id, { keepBar = false } = {}) {
  const f = FEATURES.find(x => x.id === id);
  if (!f) return;
  const sh = f.show || {};
  if (!keepBar) { ui.tour = null; ui.helpReturn = ui.modal?.type === 'help'; }
  ui.modal = null; ui.tab = sh.tab || 'today'; ui.mapPopup = null; ui.lanePopup = null; ui.frameTop = null;
  if (sh.mapMode) ui.mapMode = sh.mapMode === 'lanes' ? (HYB.hasHybrid(S) ? 'hyb' : 'tri') : sh.mapMode;
  if (sh.socialTab) ui.socialTab = sh.socialTab;
  if (sh.view && S.profile.view !== sh.view) { S.profile.view = sh.view; store.save(S); }
  render();
  setTimeout(() => {
    const el = sh.sel && document.querySelector(sh.sel);
    if (!el) { if (!ui.tour) toast(`${f.title}: ${f.text}`); return; } // on the tour, the bar already explains it
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('spotlight');
    setTimeout(() => el.classList.remove('spotlight'), 2600);
  }, 450);
}
// One small bubble the first time a feature shows up (never during animations or pop-ups). It sits
// in a fixed spot above the tab bar, and the thing it talks about glows while it's open.
const tipVisible = el => { const r = el.getBoundingClientRect(); return el.isConnected && r.width > 0 && r.top >= 70 && r.bottom <= innerHeight - 170; };
function maybeTip() {
  const open = document.querySelector('.tip-bubble');
  if (open) {
    // The thing it points at scrolled away: put the tip away until it's back in view.
    if (open.classList.contains('offer')) return;
    const target = document.querySelector('.tip-target');
    if (target && tipVisible(target)) return;
    open.remove(); target?.classList.remove('spotlight', 'tip-target');
  }
  const t = tourLocal();
  if (t.tipsOff || ui.tour || ui.helpReturn || ui.modal || ui.laneAnimating || ui.mapRunning || document.querySelector('.play-btn')) return;
  const visible = tipVisible;
  // Once, after placement: offer a look around.
  if (!t.offered && S.placedAt && !AGE.isKid(S) && (ui.tab === 'today' || ui.tab === 'map')) {
    const b = document.createElement('div');
    b.className = 'tip-bubble offer';
    b.innerHTML = '<p>🧭 <strong>New here?</strong> Take a 1-minute look around: what each part does, with "Show me" buttons.</p><div class="row end"><button class="btn ghost small" data-act="tour-offer" data-v="later">Later</button><button class="btn small" data-act="tour-offer" data-v="go">Show me around</button></div>';
    document.body.appendChild(b);
    return;
  }
  const f = FEATURES.find(x => x.tip && applies(x) && !t.seen?.[x.id] && [...document.querySelectorAll(x.tip.sel)].some(visible));
  if (!f) return;
  const el = [...document.querySelectorAll(f.tip.sel)].find(visible);
  el.classList.add('spotlight', 'tip-target');
  const b = document.createElement('div');
  b.className = 'tip-bubble';
  b.innerHTML = `<p>💡 ${h(f.tip.text)}</p><div class="row end"><button class="btn small" data-act="tip-ok" data-f="${f.id}">Got it</button></div>`;
  document.body.appendChild(b);
}
// Tips can also appear once you scroll something into view.
let tipTimer = null;
const tipSoon = () => { clearTimeout(tipTimer); tipTimer = setTimeout(maybeTip, 350); };
if (typeof window !== 'undefined') { window.addEventListener('scroll', tipSoon, { passive: true }); document.addEventListener('scroll', tipSoon, { passive: true, capture: true }); }

// ---------- prepare for a race (Alpha X first and larger, Hyrox close behind) ----------
// On simulation sessions: do them in the format of the race you're preparing for.
function raceNote(st) {
  const race = S.hybrid?.race, r = race && RACES[race.event];
  if (!r || !(st.ex || []).some(x => x === 'race_sim' || x === 'compromised_run')) return '';
  const div = r.divisions.find(d => d[0] === race.division)?.[1] || '';
  return `<li class="ex race-note race-${race.event}"><div><strong>${r.icon} Your race: ${h(r.name)} ${h(div)}</strong></div>
    <p class="hint">Do the race parts in its format: ${h(r.format(race.division))}. Stations: ${h(r.stations.join(', '))}. Half simulation = half the rounds. Use your division's official weights.</p></li>`;
}
function hybridPrep(nextEv = {}) {
  const cur = S.hybrid?.race, has = HYB.hasHybrid(S);
  countOnce('view:race-card');
  const one = (k, big) => {
    const r = RACES[k], on = cur?.event === k, div = on ? cur.division : 'open'; // both races have Open, the main race
    return `<div class="race-pick race-${k} ${big ? 'big' : ''} ${on ? 'on' : ''}">
        <div class="race-head"><span class="race-icon">${r.icon}</span><div><strong>Prepare for ${h(r.name)}</strong><span class="hint">${h(r.divisions.map(d => d[1]).join(' / '))} · ${h(r.share)}</span></div></div>
        ${big || on ? `<p class="hint">${h(r.format(div))}. ${h(r.firstTime)}</p>` : ''}
        ${nextEv[k] ? `<ul class="ev-list">${evRow(nextEv[k], true)}</ul>` : ''}
        ${on ? `<p class="race-on">✓ Preparing for ${h(r.name)} ${h(r.divisions.find(d => d[0] === div)?.[1] || '')}: your simulations follow its format.</p>` : ''}
        <div class="row wrap">${on ? `<button class="btn small" data-act="race-info" data-k="${k}">Race guide</button><button class="btn ghost small" data-act="race-stop">Stop</button>`
          : `<button class="btn ${big ? 'primary' : ''} small" data-act="race-start" data-k="${k}">${has ? `Prepare for ${h(r.name)}` : `Start ${h(r.name)} prep`}</button><button class="btn ghost small" data-act="race-info" data-k="${k}">What is it?</button>`}</div>
      </div>`;
  };
  return `${one('alphax', !cur || cur.event === 'alphax')}${one('hyrox', cur?.event === 'hyrox')}`;
}

// ---------- competition mode: a target race, an honest verdict, phases, race day ----------
const fmtRange = r => (r ? `${formatTime(r[0])}–${formatTime(r[1])}` : '');
const DIST_OF = { '5k': '5K', '10k': '10K', half: 'Half marathon', marathon: 'Marathon', '70.3': 'IRONMAN 70.3', full: 'Full-distance triathlon', tri: 'Triathlon', hyrox: 'Hyrox', alphax: 'Alpha X' };
const dateLong = ymd => new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
// Estimates are estimates: a month, not a day.
const monthYear = ymd => new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const pace = m => `${formatTime(m)} /km`;
// "How this was worked out", in plain words.
function howWorked(v, race) {
  const b = v.bd, n = TG.NEEDS[race.distance];
  if (!b || !n) return '';
  if (!b.weeks) return `<p class="hint">How this was worked out: you're already at Level ${b.cur}, where a ${n.label} is realistic. The rest is race prep and a taper.</p>`;
  const wk = x => `${x} week${x === 1 ? '' : 's'}`;
  return `<details class="how-worked"><summary class="hint">How this was worked out</summary><ul class="hint">
      <li>📈 You're at Level ${b.cur} and need Level ${b.goal}. Training <strong>${b.days} days a week</strong>, that's about ${wk(b.path)} of sessions.</li>
      <li>🦴 A ${n.label} also needs about ${wk(b.history)} of steady running behind you: tendons, joints and bones adapt slower than fitness.${b.credit ? ` <strong>Your running background counts</strong>: ${Math.round(b.credit * 100)}% of that is already banked.` : ''}${b.limit === 'history' ? ' This is what sets the date.' : ''}</li>
      ${b.deload ? `<li>😮‍💨 An easier week about every 4th week, to absorb the training: about ${wk(b.deload)}.</li>` : ''}
      ${b.buffer ? `<li>🤒 A buffer for a cold, travel or a missed week: about ${wk(b.buffer)}.</li>` : ''}
      <li>🏁 A taper before the race: about ${TG.TAPER[race.distance]} week${TG.TAPER[race.distance] === 1 ? '' : 's'}.</li>
      <li>So: <strong>best case about ${wk(Math.round(b.best))}, realistic about ${wk(Math.round(b.weeks))}</strong>. Train more consistently and it comes sooner; miss weeks and it moves later. That's normal.</li>
    </ul></details>`;
}
// Predictions are rough: whole minutes over an hour, nearest 15 s below.
const approx = m => (m >= 60 ? formatTime(Math.round(m)).replace(/:00$/, '') : formatTime(Math.round(m * 4) / 4));
function timeHtml(v, race) {
  const t = v.time;
  if (!t || race.goal !== 'time') return '';
  const g = `${formatTime(race.goalTime)} (${pace(t.pace)})`;
  if (t.kind === 'unknown') return `<p class="verdict tight">⏱️ Goal ${g}. To judge it, the app needs a recent 5K or 10K time. <button type="button" class="linkish" data-act="edit-bests">Add my bests</button></p>`;
  const P = approx(t.predicted);
  if (t.kind === 'easy') return `<p class="verdict ok">⏱️ <strong>${g} is comfortably within reach.</strong> Your bests predict about ${P}: you could aim a bit faster, around ${P}. Or keep ${formatTime(race.goalTime)} and enjoy the day.</p>`;
  if (t.kind === 'realistic') return `<p class="verdict ok">⏱️ <strong>${g} is realistic.</strong> Your bests predict about ${P}, so this goal is within reach. Go for it.</p>`;
  if (t.kind === 'stretch') return `<p class="verdict tight">⏱️ <strong>${g} is a stretch.</strong> Your bests predict about ${P}. Possible on a great day with even pacing; ${P} is the safer target.</p>`;
  return `<p class="verdict no">⏱️ <strong>${g} is faster than your bests support right now</strong> (about ${P} predicted). Realistic goal: <strong>${P}</strong>. Train well and ${approx(t.stretch)} could be in reach on the day. Beat your 5K best before the race and this updates.</p>`;
}
// Honest, never discouraging: every answer ends with what the athlete CAN do, and when.
function verdictHtml(v, race) {
  const weeks = w => `${Math.round(w)} week${Math.round(w) === 1 ? '' : 's'}`;
  if (v.kind === 'unknown') return '<p class="verdict">Pick the distance below and the app checks it against your level.</p>';
  if (v.kind === 'age') return `<p class="verdict no">🌱 <strong>Not yet: this distance is for ${v.need}+.</strong> Most races of this length set a minimum age of ${v.need} (check the race's own rules). Pick a shorter race for now: getting fast at it now makes the long ones easier later.</p>`;
  if (v.other) return v.kind === 'ok' ? `<p class="verdict ok">✅ <strong>Realistic.</strong> ${v.need ? `Your map gets you to race level in about ${weeks(v.need)}, with ${weeks(v.weeksLeft - v.need)} to spare.` : 'You\'re at race level already: keep your sessions going and taper in the last week.'}</p>`
    : v.kind === 'tight' ? `<p class="verdict tight">⚠️ <strong>Tight, but possible as a finish.</strong> You need about ${weeks(v.need)} and have ${weeks(v.weeksLeft)}. Aim to finish strong, not to race.</p>`
    : `<p class="verdict no">❌ <strong>Not yet.</strong> You need about ${weeks(v.need)} on your map and have ${weeks(v.weeksLeft)}. That's a "not yet", not a "never": a shorter race now, or this one's next edition, keeps you on the way.</p>`;
  if (v.kind === 'ok') return `<p class="verdict ok">✅ <strong>Realistic.</strong> ${v.need ? `At your pace you're race-ready around ${monthYear(v.readyOn)} (${v.bd?.best && v.bd.best < v.need ? `${Math.round(v.bd.best)}–${Math.round(v.need)} weeks` : `about ${weeks(v.need)}`})` : 'You are race-ready already'}, with time to taper.${v.range && race.goal !== 'time' ? ` Expect about <strong>${fmtRange(v.range)}</strong>.` : ''}</p>${howWorked(v, race)}`;
  if (v.kind === 'tight' && v.mode === 'runwalk') return `<p class="verdict tight">⚠️ <strong>Doable at a much slower pace: run-walk it</strong> (for example 1 minute walking every 3–4 minutes). Expect about <strong>${fmtRange(v.range)}</strong>. That's a real finish, and a great first race.</p>${howWorked(v, race)}`;
  if (v.kind === 'tight' && v.why === 'time-later') return `<p class="verdict tight">⚠️ <strong>You'll be ready to run it strong, but racing it all-out is a little early.</strong> Your level for a fast ${TG.NEEDS[race.distance].label} comes around ${monthYear(v.readyOn)}. Run it well, treat a fast time as a bonus, and go all-out at the next one.${v.range ? ` Expect about <strong>${fmtRange(v.range)}</strong>.` : ''}</p>${howWorked(v, race)}`;
  if (v.kind === 'tight') return `<p class="verdict tight">⚠️ <strong>Tight.</strong> You'll just about get there, without a full taper. Go out easy and aim to finish comfortably, not to race.${v.range ? ` Expect about <strong>${fmtRange(v.range)}</strong>.` : ''}</p>${howWorked(v, race)}`;
  const opts = [];
  if (v.shorter) opts.push(v.shorterMode === 'walk' ? `<li>🚶 <strong>Walk the 5K</strong> with a few easy jogs, if the event has one: a great way to be part of race day.</li>`
    : `<li>🏃 <strong>The ${TG.NEEDS[v.shorter].label}</strong> at this event, if it has one${v.shorterMode === 'runwalk' ? ', run-walking it at an easy pace' : ''}: realistic for you by then.</li>`);
  if (v.later) opts.push(`<li>📅 <strong>${h(v.later.name)}</strong> on ${dateLong(v.later.date)}: you'll be ready for it. <button class="linkish" data-act="target-pick" data-uid="${h(v.later.uid)}">Prepare for this one</button></li>`);
  opts.push(`<li>🎯 At your pace you'd be ready for a ${TG.NEEDS[race.distance].label} around <strong>${monthYear(v.readyOn)}</strong> (about ${weeks(v.need)} from now): look for one then.</li>`);
  return `<p class="verdict no">❌ <strong>Not safely by ${dateLong(race.date)}.</strong> You'd need about ${weeks(v.need)} and have ${weeks(v.weeksLeft)}. Rushing it is how injuries happen. This is a "not yet", and here's how to still get your race:</p><ul class="verdict-opts">${opts.join('')}</ul>${howWorked(v, race)}`;
}
const raceFrom = uid => (ui.events || []).find(e => e.uid === uid) || (S.target?.uid === uid ? S.target : null);
function targetCard(style = '') {
  const t = S.target;
  if (!t) return '';
  const ph = TG.phase(t, now());
  if (ph.id === 'done') return `<section class="card target-card" ${style}><p class="eyebrow">🏁 ${h(t.name)}</p><h3>${t.result ? `Finished in ${h(formatTime(t.result.time))} 🎉` : 'Race done 🎉'}</h3><p class="hint">Ready for the next one?</p><div class="row wrap"><button class="btn small" data-act="target-clear">Pick my next race</button></div></section>`;
  const v = TG.verdict(S, t, now(), ui.events || []);
  const when = ph.d > 1 ? `in ${ph.d} days` : ph.d === 1 ? 'tomorrow' : ph.d === 0 ? 'today!' : `${-ph.d} day${ph.d === -1 ? '' : 's'} ago`;
  const badge = { ok: '✅ on track', tight: v.mode === 'runwalk' ? '⚠️ run-walk it' : '⚠️ tight: aim to finish', no: '❌ not yet: see options' }[v.kind] || '';
  return `<section class="card target-card" ${style}><p class="eyebrow">🎯 My race · ${h(DIST_OF[t.distance] || 'Race')}</p>
      <h3>${h(t.name)} <span class="hint">${when}</span></h3>
      <p class="tc-phase"><strong>${ph.title}</strong>${badge ? ` · ${badge}` : ''}</p>
      <ul class="tc-focus">${ph.focus.map(f => `<li>${h(f)}</li>`).join('')}</ul>
      <div class="row wrap">${ph.id === 'race' || (ph.id === 'recover' && !t.result) ? '<button class="btn primary small" data-act="target-result">🏁 Log my result</button>' : ''}<button class="btn ghost small" data-act="target-pick" data-uid="${h(t.uid)}">Details</button></div></section>`;
}

// 🎯 Races: two featured races per sport the athlete trains for (from the Egypt Fitness Calendar),
// the rest folded under "Other competitions". Hybrid's two are the Alpha X / Hyrox prep cards.
const TRACK_RACES = { run: '🏃 Running', tri: '🏊🚴🏃 Triathlon', hybrid: '🏃🏋️ Hybrid' };
const evDate = (d, today) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
function evRow(e, compact = false) {
  const today = E.dayKey(now());
  if (e.expected) return `<li class="ev expected"><div><strong>${h(e.name)}</strong><span class="hint">Next edition expected ~${new Date(`${e.expected}-15T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} · date not announced yet</span></div>${e.url ? `<a class="btn ghost small" href="${h(e.url)}" target="_blank" rel="noopener" data-act="race-site" data-k="calendar">Info ↗</a>` : ''}</li>`;
  const d = EV.daysTo(e.date, now()), closed = e.closes && e.closes < today;
  const when = d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
  const note = closed ? '🔒 registration closed' : d < 14 ? 'too soon to prepare for: great to join for fun or cheer' : e.closes ? `registration closes ${evDate(e.closes, today)}` : '';
  const isTarget = S.target?.uid === e.uid;
  const prep = d >= 0 ? `<button class="btn ${isTarget ? 'primary' : 'ghost'} small" data-act="target-pick" data-uid="${h(e.uid)}">${isTarget ? '🎯 My race' : '🎯 Set as my race'}</button>` : '';
  return `<li class="ev ${closed ? 'closed' : ''} ${compact ? 'compact' : ''} ${isTarget ? 'target' : ''}"><div><strong>${h(e.name)}</strong><span class="hint">${evDate(e.date, today)} · ${when}${e.location ? ` · ${h(e.location.split(/,| — | - /)[0])}` : ''}${note ? ` · ${note}` : ''}</span></div><span class="ev-btns">${prep}${e.url && !closed ? `<a class="btn small" href="${h(e.url)}" target="_blank" rel="noopener" data-act="race-site" data-k="calendar">Register ↗</a>` : ''}</span></li>`;
}
function raceCard(style = '') {
  // The sport that leads the week comes first; the others keep their usual order.
  const lead = S.profile.primary || 'run';
  const tracks = (S.profile.tracks || ['run']).filter(t => TRACK_RACES[t]).sort((a, b) => (b === lead) - (a === lead));
  if (ui.events == null && !ui.eventsLoading) { ui.eventsLoading = true; EV.loadEvents().then(ev => { ui.events = ev; ui.eventsLoading = false; if (ui.tab === 'today' || ui.tab === 'map') render(); }); }
  const today = E.dayKey(now());
  const sec = tr => {
    if (ui.events == null) return `<div class="race-sec"><p class="q">${TRACK_RACES[tr]}</p>${tr === 'hybrid' ? hybridPrep({}) : ''}<p class="hint">Loading races…</p></div>`;
    const { picks, others } = EV.featured(ui.events, tr, today);
    const top = tr === 'hybrid' ? hybridPrep({ alphax: picks.find(e => /alpha ?x/i.test(e.name)), hyrox: picks.find(e => /hyrox/i.test(e.name)) })
      : picks.length ? `<ul class="ev-list">${picks.map(e => evRow(e)).join('')}</ul>` : '<p class="hint">No races in the calendar yet for this sport.</p>';
    const isLead = tracks.length > 1 && tr === lead;
    return `<div class="race-sec ${isLead ? 'lead' : ''}"><p class="q">${TRACK_RACES[tr]}${isLead ? ' <span class="lead-tag">⭐ Leads your week</span>' : ''}</p>${top}
      ${others.length ? `<details class="ev-more"><summary class="hint">Other competitions (${others.length})</summary><ul class="ev-list">${others.map(e => evRow(e, true)).join('')}</ul></details>` : ''}</div>`;
  };
  return `<section class="card race-card" ${style}><p class="eyebrow">🎯 Races in Egypt</p>${tracks.map(sec).join('')}
      <p class="hint">From the <a href="${CALENDAR_URL}" target="_blank" rel="noopener" data-act="race-site" data-k="calendar">Egypt Fitness Calendar</a>. Past races drop off by themselves.</p></section>`;
}

// Anonymous counters (no ID, no personal data) that show race organisers how many athletes train
// for their race. Off with the switch in Me.
const COUNT_KEY = 'stride-quest:counts';
const countsOn = () => { try { return localStorage.getItem(COUNT_KEY) !== 'off'; } catch { return false; } };
function count(key) {
  if (!countsOn() || !WORKER_URL) return;
  fetch(`${WORKER_URL.replace(/\/$/, '')}/count`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }), keepalive: true }).catch(() => {});
}
// Once per device (for "how many athletes", not "how many taps").
function countOnce(key) {
  try { const seen = JSON.parse(localStorage.getItem(`${COUNT_KEY}:seen`) || '{}'); if (seen[key]) return; seen[key] = 1; localStorage.setItem(`${COUNT_KEY}:seen`, JSON.stringify(seen)); } catch { return; }
  count(key);
}

function viewToday() {
  const t = now();
  const track = E.activeTrack(S);
  const steps = E.trackSteps(S, track);
  const lvl = E.runLevel(S.run.level);
  const prog = E.levelProgress(S);
  const pct = Math.min(100, Math.round(prog.earned / Math.max(1, prog.target) * 100));
  const orders = E.dailyOrders(t);
  const doneOrders = S.daily[E.dayKey(t)]?.orders || [];
  const restDone = S.daily[E.dayKey(t)]?.rest;
  const hello = S.profile.name ? `Hi ${h(S.profile.name)}!` : 'Hi!';
  const p = todayParts(t);
  const o = n => `style="order:${n}"`;
  const mode = primaryMode();
  const heroMain = mode === 'hyb' ? (() => { const w = HYB.hybWorld(S), b = S.hybrid.block.type, lim = HYB.limiter(S);
      return `<p class="eyebrow">${hello} · Hybrid</p><h2>${w.emoji} ${h(w.name)}</h2>
        <p class="hint">${b === 'deload' ? '😮‍💨 Deload week' : b === 'engine' ? '⚡ Engine block' : '🏋️ Strength block'} · ${lim ? `limiter: ${HYB.LANE_ICON[lim.lane]} ${HYB.LANE_LABEL[lim.lane]}` : S.rebuild.active ? 'race gate locked 🔒 (Rebuild)' : 'race gate open 🏁'} · Run Level ${lvl.n}</p>`; })()
    : mode === 'tri' ? (() => { const w = TRI.triWorld(S), lim = TRI.limiter(S);
      return `<p class="eyebrow">${hello} · Triathlon</p><h2>${w.emoji} ${h(w.name)}</h2>
        <p class="hint">${lim ? `limiter: ${TRI.LANE_ICON[lim.lane]} ${TRI.LANE_LABEL[lim.lane]}` : 'transition gate open 🌉'} · Run Level ${lvl.n}</p>`; })()
    : `<p class="eyebrow">${hello} · ${h(E.worldOf(lvl).name)}</p>
      <h2>Level ${lvl.n} · ${h(lvl.name)} <span class="stars">${'⭐'.repeat(S.run.stars[lvl.n] || 0)}</span></h2>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <p class="hint">${prog.earned}/${prog.target} level XP · the gate test opens at ${prog.target}${prog.fast ? ' · ⚡ comeback fast-track' : ''}</p>`;
  const hero = `<section class="card hero" ${o(2)}>${heroMain}
      ${S.profile.dream ? dreamLine(S.profile.dream, S.run.level, true) : ''}
      ${mode !== 'world' ? `<button class="btn small hero-btn" data-act="goto-${mode}-map">Open my map</button>` : ''}
    </section>`;
// A gate or boss logged today only counts after tomorrow morning's pain check: say so, and what opens then.
const waitingFor = steps.find(st => st.status === 'provisional' && (st.type === 'gate' || st.boss));
const waitCard = waitingFor ? `<section class="card wait-card" style="order:2"><p class="eyebrow">⏳ Almost there</p>
    <h3>${h(waitingFor.title)}: done!</h3>
    <p>${track === 'run' && S.run.level < RUN_LEVELS.length ? `<strong>Level ${S.run.level + 1}</strong> and its new sessions open` : 'It counts'} <strong>tomorrow morning</strong>, after a quick check of how you feel.</p>
    <p class="hint">Pain 2/10 or less clears it. Why wait: some strains only show up the next day, and this keeps you from levelling up on an injury.</p></section>` : '';
const credit = '<p class="byline credit">Developed by <button type="button" class="linkish" data-act="about-me">Abdullah Salama</button></p>';
  const simple = (S.profile.view || 'full') === 'simple';
  const toggle = `<div class="seg today-seg" role="tablist">${[['simple', '✨ Just next'], ['full', '📋 Full day']].map(([k, l]) =>
    `<button role="tab" class="${(simple ? 'simple' : 'full') === k ? 'on' : ''}" data-act="set-view" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (simple) {
    return `${toggle}<div class="simple">${banners()}${hero}${targetCard()}${waitCard}${p.today}${gettingStarted()}${raceCard()}
      <button class="btn ghost wide" data-act="set-view" data-v="full">See my week and more ▾</button></div>${credit}`;
  }
  const boost = `<section class="card boost" ${o(3)}>
      <p class="eyebrow">Daily boost</p>
      <p class="boost-line">${h(M.dailyBoost(S, t))}</p>
      ${M.progressLine(S) ? `<p class="hint">${h(M.progressLine(S))}</p>` : ''}
    </section>`;
  const install = S.history.some(x => x.kind === 'session') ? installCard('today').replace('<section class="card install"', `<section class="card install" ${o(4)}`) : '';
  // The whole level's sessions, not today's plan: folded into one line ("Level 8 checklist: 2 of 9 done").
  const doneN = steps.filter(st => st.status === 'done').length, waitN = steps.filter(st => st.status === 'provisional').length;
  const levelName = track === 'run' ? `Level ${S.run.level}` : trackTitle(track).replace(/^\S+\s/, '').split(' · ')[0];
  // What the next level needs beyond this checklist (today: body prep), with the way there right here.
  const nextLvl = track === 'run' && S.run.level < RUN_LEVELS.length ? E.runLevel(S.run.level + 1) : null;
  const prepShort = nextLvl && S.prep.level < nextLvl.needsPrep;
  const blockedNow = E.prepBlocksRun(S) != null;
  const prepSteps = prepShort ? E.trackSteps(S, 'prep') : [];
  const needs = nextLvl ? `<div class="needs"><p class="q">🔑 Needed for Level ${nextLvl.n} · ${h(nextLvl.name)}</p>
      <ul class="needs-list">
        <li class="${doneN === steps.length ? 'ok' : ''}"><span>${doneN === steps.length ? '✅' : waitN ? '⏳' : '⬜'}</span><span>Level ${S.run.level} sessions and boss: ${doneN} of ${steps.length}${waitN ? ' (boss confirmed tomorrow morning)' : ''}</span></li>
        <li class="${prepShort ? '' : 'ok'}"><span>${prepShort ? '🧱' : '✅'}</span><span>Body prep P${nextLvl.needsPrep}${prepShort ? `: you're at P${S.prep.level}${nextLvl.needsPrep - S.prep.level > 1 ? ` (${nextLvl.needsPrep - S.prep.level} stages to go: ${Array.from({ length: nextLvl.needsPrep - S.prep.level }, (_, i) => `P${S.prep.level + i + 1}`).join(' → ')})` : ''}` : ' ✓'}</span></li>
      </ul>
      ${prepShort ? `<p class="hint">Your Prep sessions now, P${S.prep.level} · ${h(PREP_STAGES[S.prep.level].name)}:</p><ul class="steps">${prepSteps.map(st => stepRow('prep', st)).join('')}</ul>
        <p class="hint">💡 Prep builds tendons and landing skills so the bigger running loads of Level ${nextLvl.n} don't get you hurt.</p>` : ''}
    </div>` : '';
  const summary = blockedNow ? `📋 Level ${S.run.level} checklist: done ✓ · 🧱 needs Prep P${nextLvl.needsPrep} for Level ${nextLvl.n}`
    : `📋 ${h(levelName)} checklist: ${doneN} of ${steps.length} done${waitN ? ` · ⏳ ${waitN} confirmed tomorrow` : ''}${prepShort ? ` · 🧱 Level ${nextLvl.n} also needs Prep P${nextLvl.needsPrep}` : ''}`;
  const levelSteps = `<details class="card level-check" ${o(9)} ${blockedNow ? 'open' : ''}>
      <summary><span class="lc-title">${summary}</span><span class="hint">${trackTitle(track)} · the whole level, spread over your weeks</span></summary>
      <ul class="steps">${steps.map(st => stepRow(track, st)).join('')}</ul>
      ${needs}
    </details>`;
  const daily = `<section class="card" ${o(10)}>
      <h3>Daily orders <span class="hint">+${E.XP.daily} XP each</span></h3>
      <ul class="orders">${orders.map(x => `<li><label class="choice"><input type="checkbox" data-act="order" data-i="${x.i}" ${doneOrders.includes(x.i) ? 'checked disabled' : ''}><span>${h(x.title)}</span></label></li>`).join('')}</ul>
      ${S.mode?.type === 'sick'
        ? `<button class="btn ghost" data-act="sick-checkin" ${S.daily[E.dayKey(t)]?.sick ? 'disabled' : ''}>${S.daily[E.dayKey(t)]?.sick ? 'Sick day logged ✓' : `🤒 Sick day check-in (+${E.XP.restDay} XP)`}</button>`
        : `<button class="btn ghost" data-act="rest" ${restDone ? 'disabled' : ''}>${restDone ? 'Rest day logged ✓' : `😴 Rest day check-in (+${E.XP.restDay} XP)`}</button>`}
    </section>`;
  const modes = S.mode ? '' : `<section class="card modes" ${o(11)}><p class="hint">Not feeling 100% or short on time?</p><div class="row wrap">
      <button class="btn small" data-act="sick-start">🤒 I'm sick</button><button class="btn small" data-act="busy-start">🧳 Busy or travelling</button></div></section>`;

  // Two columns on wide screens; on phones the wrappers dissolve and `order` restores one column.
  return `${toggle}<div class="cols">
      <div class="col-main"><div ${o(1)}>${banners()}</div>${waitCard}${p.today}${p.week}${p.nextWeek}${levelSteps}</div>
      <div class="col-side">${hero}${targetCard(o(3))}${gettingStarted(o(4))}${raceCard(o(5))}${boost}${install}${p.tracks}${daily}${modes}</div>
    </div>${credit}`;
}

const CLS_ICON = { long: '🛣️', hard: '⚡', test: '🏁', easy: '🏃', strength: '🧱', impact: '🦘', rest: '😴', done: '✅', swim: '🏊', bike: '🚴', upper: '💪' };

function todayParts(t) {
  const w = K.buildWeek(S, t);
  const todayItems = w.days[w.today].items.filter(i => !i.done);
  const win = K.buildWindow(S, t, 2, 7);
  const nextDay = win.days.slice(3).find(d => d.items.some(i => !i.done));
  const doneToday = w.days[w.today].items.filter(i => i.done);
  const itemBtn = it => it.sick || it.idx == null ? '' : `<button class="btn primary small" data-act="open-step" data-track="${it.track}" data-idx="${it.idx}">Start</button>`;
  const restDoneToday = S.daily[E.dayKey(t)]?.rest;
  const todayCard = todayItems.length
    ? `<section class="card next" style="order:5"><p class="eyebrow">Today · ${K.DAY_NAMES[w.today]}</p>
        ${todayItems.map(it => `<div class="today-item"><span class="cls">${CLS_ICON[it.cls] || '•'}</span><div><h3>${h(it.title)}</h3>${it.phaseNote ? `<p class="phase-note">🎯 ${h(it.phaseNote)}</p>` : ''}${it.detail ? `<p class="hint">${h(it.detail)}</p>` : ''}
          <p class="tags">${it.keySession ? '<span class="tag-fit ok">Key</span>' : ''}${it.optional ? '<span class="tag-fit goal">Optional</span>' : ''}${it.track === 'prep' ? '<span class="tag-fit info">Prep</span>' : ''}</p></div>${itemBtn(it)}</div>`).join('')}
      </section>`
    : `<section class="card next rest-day" style="order:5"><p class="eyebrow">Today · ${K.DAY_NAMES[w.today]}</p>
        <h3>${doneToday.length ? (doneToday.every(i => i.attempt) ? 'Logged for today 💛 Rest up, it\'s back on your next training day' : 'Done for today ✅') : S.mode?.type === 'sick' ? 'Rest and recover 💤' : 'Rest day 😴'}</h3>
        <p class="hint">${nextDay ? (() => { const it = nextDay.items.find(i => !i.done); return `Next: ${nextDay.name} · ${it.idx != null ? `<button class="linkish" data-act="open-step" data-track="${it.track}" data-idx="${it.idx}">${h(it.title)}</button>` : h(it.title)}`; })() : 'Next sessions appear as you progress.'}</p>
        ${!doneToday.length && S.mode?.type !== 'sick' ? `<button class="btn ghost small" data-act="rest" ${restDoneToday ? 'disabled' : ''}>${restDoneToday ? 'Rest day logged ✓' : `😴 Log rest day (+${E.XP.restDay} XP)`}</button>` : ''}</section>`;
  // Training outside the plan (gym, football…) is logged from here; it shows in the week and Nutrition counts it.
  const match = stravaMatches()[0];
  const actRow = `${match ? `<div class="strava-match"><p>🔗 <strong>From Strava:</strong> ${h(match.act.title.replace(/^🏃 /, ''))}. Count it as today's <strong>${h(match.step.title)}</strong>?${match.differs ? ' <span class="hint">(it looks different from the plan: log it as partly done if so)</span>' : ''}</p><div class="row wrap"><button class="btn small primary" data-act="strava-log" data-differs="${match.differs ? 1 : ''}" data-ts="${match.act.ts}" data-track="${match.step.track}" data-idx="${match.step.idx}">Log it</button><button class="btn ghost small" data-act="strava-skip" data-ts="${match.act.ts}">Not this one</button></div></div>` : ''}<div class="row wrap act-row"><button class="btn ghost small" data-act="extra-add">➕ Log another activity</button></div>`;
  const todayWithAct = todayCard.replace(/<\/section>\s*$/, `${actRow}</section>`);
  // Rolling view: two days back, today, four days ahead (into next week when needed).
  const dayRow = d => `<li class="wk-day ${d.today ? 'today' : ''} ${d.past ? 'past' : ''} ${d.available ? '' : 'off'} ${d.week === 'next' && d.i === 0 ? 'wk-new' : ''}">
        <span class="wk-name">${d.today ? 'Today' : d.name}<small>${new Date(d.date).getDate()}</small></span>
        <div class="wk-items">${d.items.length ? d.items.map(it => `<div class="wk-item ${it.done ? 'done' : ''} ${it.optional ? 'opt' : ''}">
            <span ${it.done && it.ts ? `class="wk-open" role="button" tabindex="0" data-act="log-info" data-ts="${it.ts}"` : it.idx != null && !it.sick ? `class="wk-open" role="button" tabindex="0" data-act="open-step" data-track="${it.track}" data-idx="${it.idx}"` : ''}>${it.done ? (it.attempt ? '✗' : it.partial ? '◐' : '✅') : CLS_ICON[it.cls] || '•'} ${h(it.title)}${it.phaseNote && !it.done ? ` <em class="hint phase-note">· ${h(it.phaseNote.split(':')[0])}</em>` : ''}${it.attempt ? ' <em class="hint">tried</em>' : it.partial ? ' <em class="hint">partly done</em>' : ''}${it.keySession && !it.done ? ' <b class="key">KEY</b>' : ''}</span>
            ${d.week === 'this' && !it.done && !it.sick && it.idx != null ? `<button class="link small" data-act="move-item" data-key="${h(it.key)}">Move</button>` : ''}</div>`).join('')
          : `<span class="hint">${d.past ? '–' : d.available ? 'Free' : 'Rest'}</span>`}</div></li>`;
  const week = `<section class="card week" style="order:6"><h3>Your week</h3>
      <ul class="wk">${win.days.slice(0, 7).map(dayRow).join('')}</ul>
      ${w.warnings.map(x => `<div class="fit-box warn">${h(x.text)}</div>`).join('')}
      ${w.notes.filter(n => !/No training days left/.test(n)).map(n => `<p class="hint">${h(n)}</p>`).join('')}
      <button class="link small" data-act="edit-days">Change training days</button>
    </section>`;
  const nextWeek = '';
  const coming = [];
  const tracksCard = coming.length ? `<section class="card info-card" style="order:8"><p>${coming.map(k => k === 'hybrid' ? '🏋️ <strong>Hybrid track</strong>' : '🏊 <strong>Triathlon track</strong>').join(' and ')} ${coming.length > 1 ? 'are' : 'is'} being built. Your training already counts toward ${coming.length > 1 ? 'them' : 'it'}: carry-over will show the moment ${coming.length > 1 ? 'they open' : 'it opens'}.</p></section>` : '';

  return { today: todayWithAct, week, nextWeek, tracks: hybridCard() + triCard() };
}

function viewMap() {
  if (runIntroPending() && !ui.mapRunning && ui.intro == null) ui.avatarAt = 0;
  // Each Prep stage opens: the current one with its sessions, the others with what they unlock.
  const prep = PREP_STAGES.map(p => `<li class="${p.n < S.prep.level || (p.n === 7 && S.prep.mastered) ? 'done' : p.n === S.prep.level ? 'current' : ''}"><button type="button" class="ladder-btn" data-act="prep-stage" data-n="${p.n}"><strong>P${p.n}</strong> ${h(p.name)}<span>${h(p.focus)}</span></button></li>`).join('');
  const rebuild = S.rebuild.active ? `<section class="card"><h3>🩹 Rebuild Track</h3><ol class="ladder">${REBUILD_STAGES.map((r, i) => `<li class="${i < S.rebuild.stage ? 'done' : i === S.rebuild.stage ? 'current' : ''}"><strong>R${r.n}</strong> ${h(r.name)}<span>${h(r.focus)}</span></li>`).join('')}</ol></section>` : '';
  if ((ui.mapMode === 'tri' && !TRI.hasTri(S)) || (ui.mapMode === 'hyb' && !HYB.hasHybrid(S))) ui.mapMode = 'world';
  const multi = TRI.hasTri(S) || HYB.hasHybrid(S);
  const modes = [['world', multi ? '🏃 Run' : '🗺️ World map'], ...(HYB.hasHybrid(S) ? [['hyb', '🏃🏋️ Hybrid']] : []), ...(TRI.hasTri(S) ? [['tri', '🏊🚴🏃 Triathlon']] : []), ['grid', multi ? '▦ Cards' : '▦ Level cards']];
  const toggle = `<div class="seg" role="tablist">${modes.map(([k, l]) =>
    `<button role="tab" class="${ui.mapMode === k ? 'on' : ''}" data-act="map-mode" data-mode="${k}">${l}</button>`).join('')}</div>`;
  const replayBtn = '<button class="btn ghost small replay-btn" data-act="replay-journey">🔁 Replay my journey</button>';
  const lvl = E.runLevel(S.run.level);
  const sideInfo = `<section class="card map-side-info"><p class="eyebrow">${E.worldOf(lvl).emoji} ${h(E.worldOf(lvl).name)}</p><h3>Level ${lvl.n} · ${h(lvl.name)}</h3>
      ${S.profile.dream ? dreamLine(S.profile.dream, S.run.level, true) : ''}<button class="btn primary small" data-act="open-level">Open level</button></section>`;
  if (ui.mapMode === 'hyb') {
    prepareLaneMap('hyb');
    return `${banners()}${toggle}<div class="map-cols"><div class="map-main">${renderLaneMap(S, ui, 'hyb')}${replayBtn}</div><div class="map-side">${raceCard()}${hybridCard(true)}</div></div>`;
  }
  if (ui.mapMode === 'tri') {
    const lim = TRI.limiter(S);
    const triSide = `<section class="card map-side-info"><p class="eyebrow">Triathlon · ${TRI.triWorld(S).emoji} ${h(TRI.triWorld(S).name)}</p><h3>${h(TRI.triWorld(S).race)}</h3>
      <p class="hint">${lim ? `${TRI.LANE_ICON[lim.lane]} <strong>${TRI.LANE_LABEL[lim.lane]}</strong> is your limiter.${lim.lane === 'run' ? ' Your running lives on the Run map.' : ''}` : S.rebuild.active ? gateLockedLine() : '🌉 All three lanes are ready: the transition gate is open!'}</p>
      ${lim?.lane === 'run' ? '<button class="btn primary small" data-act="goto-run-map">Go to Run map</button>' : lim ? `<button class="btn primary small" data-act="lane-step" data-lane="${lim.lane}">Next ${lim.lane} session</button>` : '<button class="btn primary small" data-act="open-step" data-track="triGate" data-idx="0">Start the gate</button>'}</section>`;
    prepareLaneMap('tri');
    return `${banners()}${toggle}<div class="map-cols"><div class="map-main">${renderLaneMap(S, ui, 'tri')}${replayBtn}</div><div class="map-side">${triSide}${triCard().replace('style="order:8"', '')}</div></div>`;
  }
  return `${banners()}${toggle}<div class="map-cols"><div class="map-main">${ui.mapMode === 'grid' ? levelGrid() : renderMap(S, ui) + replayBtn}</div><div class="map-side">${sideInfo}${rebuild}
    <section class="card"><h3>🧱 Prep Track</h3><p class="hint">Harder run work unlocks with your Prep stage: strides at P3, hills and intervals at P4.</p><ol class="ladder">${prep}</ol></section></div></div>`;
}

function levelGrid() {
  const cur = S.run.level;
  const worlds = WORLDS.map(w => {
    const nodes = RUN_LEVELS.filter(l => l.world === w.id).map(l => {
      const state = l.n < cur ? 'done' : l.n === cur ? 'current' : 'locked';
      const stars = S.run.stars[l.n] || 0;
      const skipped = state === 'done' && !stars;
      const reclaim = S.run.reclaim === l.n ? ' reclaim' : '';
      return `<button class="node ${state}${reclaim}" data-act="grid-node" data-n="${l.n}" title="${h(l.criteria)}">
          <span class="num">${l.n}</span><span class="name">${h(l.name)}</span>
          <span class="stars">${state === 'locked' ? (reclaim ? '🔒 Reclaim' : `Needs P${l.needsPrep}`) : skipped ? 'Placed past' : '⭐'.repeat(stars) + '☆'.repeat(3 - stars)}</span>
        </button>`;
    }).join('');
    return `<section class="world w-${w.id}"><h3>${w.emoji} ${h(w.name)}</h3><div class="nodes">${nodes}</div></section>`;
  }).join('');
  return `<div class="map">${worlds}</div>`;
}

// ---------- tri map ----------
// Scroll offset of map y inside a scrolling map frame (the clouded top may be cropped off).
function frameY(frame, svg, y, h) {
  const r = svg.getBoundingClientRect();
  return r.top - frame.getBoundingClientRect().top + frame.scrollTop + (y / h) * r.height;
}
function triFollow(y, smooth = false) {
  const frame = document.querySelector('.worldmap');
  if (!frame) return;
  const svg = frame.querySelector('svg');
  const behavior = smooth ? 'smooth' : 'auto';
  if (frame.scrollHeight > frame.clientHeight + 4) frame.scrollTo({ top: Math.max(0, frameY(frame, svg, y, LANE_H) - frame.clientHeight * 0.5), behavior });
  else { const r = svg.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, r.top + window.scrollY + (y / LANE_H) * r.height - window.innerHeight * 0.5), behavior }); }
}
// Where each lane character stood the last time the map was seen, so progress can be animated.
const SEEN_KEY = 'stride-quest:laneSeen';
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { return {}; } };
const writeSeen = v => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(v)); } catch { /* ignore */ } };
const laneNow = id => { const cfg = LANE_MAPS[id]; return { ...Object.fromEntries(cfg.lanes.map(l => [l, cfg.value(S, l)])), world: cfg.world(S) }; };

// Before drawing: put characters where they were last seen (if they have moved on since).
function prepareLaneMap(id) {
  if (ui.laneAnimating) return;
  const seen = readSeen()[id], cur = laneNow(id);
  // Never seen before: everyone starts at START and travels up to where they are now.
  const base = seen || Object.fromEntries(LANE_MAPS[id].lanes.map(l => [l, 0]));
  ui.laneShown = { ...(ui.laneShown || {}), [id]: Object.fromEntries(LANE_MAPS[id].lanes.map(l => [l, Math.min(base[l] ?? cur[l], cur[l])])) };
}

function afterTriRender() {
  const id = ui.mapMode === 'hyb' ? 'hyb' : 'tri', cfg = LANE_MAPS[id];
  const frame = document.querySelector('.worldmap');
  const cur = laneNow(id), all = readSeen(), seen = all[id];
  const shown = ui.laneShown?.[id];
  const moves = shown ? cfg.lanes.filter(l => cur[l] > shown[l]) : [];
  const focusLane = cfg.limiter(S)?.lane || cfg.lanes[0];
  const focusY = () => nodePoint(cfg, focusLane, cur[focusLane]).y;
  if (!moves.length) {
    if (ui.mapScroll || ui.frameTop == null) { ui.mapScroll = false; triFollow(focusY()); }
    else if (frame && frame.scrollHeight > frame.clientHeight + 4) frame.scrollTop = ui.frameTop;
    if (!seen || seen.world !== cur.world || cfg.lanes.some(l => seen[l] !== cur[l])) {
      if (seen && cur.world > seen.world) worldCleared(id, seen.world);
      all[id] = cur; writeSeen(all);
    }
    return;
  }
  // Something moved: show it where it was, with a Play button (the animation starts on tap).
  if (ui.mapScroll || ui.frameTop == null) { ui.mapScroll = false; triFollow(nodePoint(cfg, moves.includes(focusLane) ? focusLane : moves[0], shown[moves.includes(focusLane) ? focusLane : moves[0]]).y); }
  else if (frame && frame.scrollHeight > frame.clientHeight + 4) frame.scrollTop = ui.frameTop;
  ui.lanePlay = () => playLanes(id, cfg, cur, all, seen, shown, moves, focusLane, focusY);
  const first = moves[0], p0 = seen ? nodePoint(cfg, first, shown[first]) : START_POINT;
  if (!seen) triFollow(START_POINT.y - 120);
  playButton(seen ? '▶ See my progress' : '▶ Let\'s go!', 'play-lanes', { x: Math.min(300, Math.max(100, p0.x)), y: p0.y - (seen ? 60 : 105), w: LANE_W, h: LANE_H });
}

function playLanes(id, cfg, cur, all, seen, shown, moves, focusLane, focusY) {
  document.querySelector('.play-btn')?.remove();
  sfx.unlockAudio();
  // Skip: every character jumps straight to where it is now.
  ui.laneSkip = false;
  // The same top bar as the Run speedrun: who is moving, sound, Skip.
  const skipBtn = document.createElement('div');
  skipBtn.className = 'speedrun lane-skip';
  skipBtn.innerHTML = `<span class="sr-label">${seen ? '▶ PROGRESS' : '▶ YOUR JOURNEY'}</span><span class="sr-level"></span><button class="sr-mute" type="button" aria-label="Sound">${sfx.soundOn() ? '🔊' : '🔇'}</button><button class="sr-skip" type="button">Skip ⏩</button>`;
  skipBtn.querySelector('.sr-skip').onclick = () => { ui.laneSkip = true; skipBtn.remove(); };
  skipBtn.querySelector('.sr-mute').onclick = e => { const on = !sfx.soundOn(); sfx.setSound(on); e.currentTarget.textContent = on ? '🔊' : '🔇'; if (on) sfx.unlockAudio(); };
  document.body.appendChild(skipBtn);
  const fast = () => ui.laneSkip;
  const wait = (ms, fn) => { const t1 = Date.now(); const tick = () => (fast() || Date.now() - t1 >= ms ? fn() : setTimeout(tick, 100)); setTimeout(tick, 100); };
  // One character at a time, in lane order: the camera follows it up, then glides back down
  // to the next one still waiting, which then sets off.
  ui.laneAnimating = true; ui.mapScroll = false;
  const order = cfg.lanes.filter(l => moves.includes(l));
  const step = () => {
    const lane = order.shift();
    if (!lane) {
      skipBtn.remove();
      ui.laneAnimating = false; ui.laneShown = { ...ui.laneShown, [id]: null };
      if (seen && cur.world > seen.world) worldCleared(id, seen.world);
      if (!seen) { confetti(); sfx.fanfare(); toast(`You're placed at ${cfg.current(S).emoji} ${cfg.current(S).name}! Let's go 💪`); }
      all[id] = cur; writeSeen(all);
      if (fast()) { render(); triFollow(focusY()); return; }
      swapFog(laneFogParts(S, ui, id, {}));
      setTimeout(() => triFollow(focusY(), true), 1400);
      return;
    }
    if (fast()) { step(); return; }
    skipBtn.querySelector('.sr-level').textContent = `${cfg.icon[lane]} ${cfg.label[lane]}`;
    triFollow(nodePoint(cfg, lane, shown[lane]).y, true);
    wait(900, () => {
      if (fast()) { step(); return; }
      const stop = sfx.moveLoop(lane, { sex: S.profile.sex });
      // Walk up to the fog's edge, stop while the clouds clear, then carry on.
      let fogNow = laneFogParts(S, ui, id, shown);
      moveCharacter(id, lane, shown[lane], cur[lane], {
        follow: y => triFollow(y),
        gate: y => fogGate(fogNow, y, () => (fogNow = laneFogParts(S, ui, id, shown, fogNow.clear))),
        onNode: lane === 'engine' ? (v, pt) => pickPlate(id, v, pt) : null,
        skip: fast,
        onDone: pt => {
          stop();
          if (fast()) { step(); return; }
          shown[lane] = cur[lane];
          swapFog(laneFogParts(S, ui, id, shown));
          sfx.arrive(lane);
          signature(id, lane);
          if (pt) celebrate(pt.x, pt.y - 72, `${!seen ? (lane === 'strength' ? 'LIGHT WEIGHT! ' : '') : lane === 'strength' ? 'LIGHT WEIGHT! 💪 ' : ''}${arrivalLabel(cfg, lane, cur[lane])}`);
          wait(2800, step);
        },
      });
    });
  };
  step();
}

// "🚴 40 km ✓ → next 90 km": what the character just cleared and what it works on now.
function arrivalLabel(cfg, lane, v) {
  if (lane === 'run') return `🏃 Level ${v}`;
  const done = cfg.stageAt(lane, v), max = cfg.max(lane);
  const short = t => ST.sexText(String(t || ''), S.profile.sex).replace(/^(Swim|Ride|Run) /i, '');
  return `${cfg.icon[lane]} ${done ? `${short(done.target)} ✓` : 'Start'}${v < max ? ` → next ${short(cfg.stage(S, lane).target)}` : ' · path complete!'}`;
}

function worldCleared(id, fromWorld) {
  const cfg = LANE_MAPS[id];
  confetti(); sfx.fanfare();
  toast(`${cfg.worlds[fromWorld].name} cleared! Welcome to ${cfg.current(S).emoji} ${cfg.current(S).name}`);
}
function readTriForm(f) {
  const v = n => f.querySelector(`[name=${n}]:checked`)?.value;
  const out = { swimDist: v('swimDist'), freestyle: v('freestyle'), openWater: v('openWater'), bikeAccess: v('bikeAccess'), longestRide: v('longestRide'), poolPerWeek: v('poolPerWeek'),
    swimM: f.querySelector('[name=swimM]')?.value, rideKm: f.querySelector('[name=rideKm]')?.value };
  TRI_RACES.forEach(([k]) => { out[`race_${k}`] = !!f.querySelector(`[name=race_${k}]`)?.checked; });
  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
}

// ---------- map behaviour ----------
const AVATAR_KEY = 'stride-quest:avatar';
// { at: level the avatar stands on, seen: run level when the map was last shown }
function savedAvatar() { try { return JSON.parse(localStorage.getItem(AVATAR_KEY)) || {}; } catch { return {}; } }
function saveAvatar(at) { try { localStorage.setItem(AVATAR_KEY, JSON.stringify({ at, seen: S.run.level })); } catch { /* ignore */ } }
const validLevel = n => Number.isInteger(n) && n >= 1 && n <= RUN_LEVELS.length;
const INTRO_KEY = 'stride-quest:runIntro';
const runIntroPending = () => { try { return +localStorage.getItem(INTRO_KEY) || null; } catch { return null; } };
const setRunIntro = n => { try { n ? localStorage.setItem(INTRO_KEY, String(n)) : localStorage.removeItem(INTRO_KEY); } catch { /* ignore */ } };
const followY = y => {
  const frame = document.querySelector('.worldmap');
  if (frame && frame.scrollHeight > frame.clientHeight + 4) {
    const svg = frame.querySelector('svg');
    frame.scrollTop = Math.max(0, frameY(frame, svg, y, MAP_H) - frame.clientHeight * 0.55);
  } else window.scrollTo(0, Math.max(0, mapPageY(y) - window.innerHeight * 0.55));
};

function afterMapRender() {
  const pendingIntro = runIntroPending();
  if (pendingIntro && ui.intro == null && !ui.mapRunning) {
    followY(POINTS[0].y);
    playButton("▶ Let's go!", 'play-intro', { x: MAP_W / 2, y: POINTS[0].y - 10, w: MAP_W, h: MAP_H });
    return;
  }
  if (ui.intro != null && !ui.mapRunning) {
    const placed = ui.intro;
    ui.intro = null; ui.mapRunning = true;
    followY(POINTS[0].y);
    let fogNow = runFogParts(S, ui, 0);
    setTimeout(() => playPlacementIntro(placed, {
      follow: followY,
      gate: y => fogGate(fogNow, y, () => (fogNow = runFogParts(S, ui, 0, fogNow.clear))),
      onDone: res => {
        ui.mapRunning = false; ui.avatarAt = placed; saveAvatar(placed); ui.mapPopup = placed;
        swapFog(runFogParts(S, ui, placed));
        if (ui.replay) { ui.replay = false; render(); toast('That\'s your journey so far. Keep climbing! 💪'); return; }
        ui.modal = { type: 'placed', ...res }; renderModal();
      },
    }), 700);
    return;
  }
  if (ui.mapRunning) return;
  const saved = savedAvatar();
  if (ui.avatarAt == null) ui.avatarAt = validLevel(saved.at) ? saved.at : S.run.level;
  const frame = document.querySelector('.worldmap');
  const framed = frame && frame.scrollHeight > frame.clientHeight + 4;
  if (ui.mapScroll || (framed && ui.frameTop == null)) { ui.mapScroll = false; followY(POINTS[ui.avatarAt].y); }
  else if (framed) frame.scrollTop = ui.frameTop;
  const levelChanged = validLevel(saved.seen) && saved.seen !== S.run.level;
  if (!validLevel(saved.seen)) saveAvatar(ui.avatarAt);
  if (levelChanged && ui.avatarAt !== S.run.level && !ui.mapRunning) {
    // Level changed since the map was last shown: offer to play the run (starts on tap).
    playButton(`▶ Run to Level ${S.run.level}`, 'play-run', { x: Math.min(300, Math.max(100, POINTS[ui.avatarAt].x)), y: POINTS[ui.avatarAt].y - 60, w: MAP_W, h: MAP_H });
  } else if (levelChanged) saveAvatar(ui.avatarAt);
}

// A big Play button over the map; the animation starts only when the athlete taps it.
// `at` = { x, y, w, h } in map units: the button sits just above that spot (start line or a character).
function playButton(label, act, at) {
  const canvas = document.querySelector('.worldmap .map-canvas') || document.querySelector('.worldmap');
  if (!canvas || document.querySelector('.play-btn')) return;
  const b = document.createElement('button');
  b.className = 'play-btn at'; b.dataset.act = act; b.textContent = label;
  b.style.left = `${(at.x / at.w) * 100}%`; b.style.top = `${((at.y - 30) / at.h) * 100}%`;
  canvas.appendChild(b);
}

function playRun() {
  const from = ui.avatarAt, to = S.run.level;
  document.querySelector('.play-btn')?.remove();
  ui.mapRunning = true;
  sfx.unlockAudio();
  followY(POINTS[from].y);
  let fogNow = runFogParts(S, ui, from);
  setTimeout(() => runAvatar(from, to, {
    follow: followY,
    gate: y => fogGate(fogNow, y, () => (fogNow = runFogParts(S, ui, from, fogNow.clear))),
    onDone: () => { ui.mapRunning = false; ui.avatarAt = to; saveAvatar(to); ui.mapPopup = to; sfx.levelDing(to); render(); },
  }), 300);
}

function suggestionCards(m, mi) {
  if (!m.actions?.length) return '';
  return `<div class="suggestions">${m.actions.map((a, ai) => {
    const d = a.status === 'pending' ? ACT.describe(S, a, now()) : null;
    const done = a.status === 'pending' && !d ? ACT.alreadyDone(S, a, now()) : null;
    if (done) return `<div class="suggest applied"><div><strong>${h(done)}</strong></div><span class="hint">Done ✓</span></div>`;
    if (a.status === 'pending' && !d) return '';
    return `<div class="suggest ${a.status}">
      <div><strong>${h(d ? d.label : a.label || '')}</strong>${d?.detail ? `<p class="hint">${h(d.detail)}</p>` : ''}${(d?.warnings || []).map(w => `<p class="hint warn-text">⚠️ ${h(w)}</p>`).join('')}</div>
      ${a.status === 'pending' ? `<div class="row"><button class="btn primary small" data-act="sugg-apply" data-m="${mi}" data-a="${ai}">Apply</button><button class="btn ghost small" data-act="sugg-skip" data-m="${mi}" data-a="${ai}">No thanks</button></div>`
        : `<span class="hint">${a.status === 'applied' ? 'Applied ✓' : 'Skipped'}</span>`}
    </div>`;
  }).join('')}</div>`;
}

// Coach replies may use **bold** and *italics*; everything else stays escaped text.
const md = t => h(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,!?])/g, '$1<em>$2</em>');

// ---------- challenge tab ----------
const ago = ts => { const d = Math.floor((now() - ts) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
const hue = id => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const avatar = (id, name) => `<span class="av" style="background:hsl(${hue(id)} 65% 48%)">${h((name || '?').trim().charAt(0).toUpperCase())}</span>`;
const levelLabel = n => { const l = E.runLevel(n); return `${E.worldOf(l).emoji} Level ${n} · ${h(l.name)}`; };
const FIT_TAG = { ready: ['ok', 'Your level'], stretch: ['ok', 'Nice stretch'], big: ['warn', 'Big stretch'], way: ['goal', 'Future goal'], rebuild: ['warn', 'After Rebuild'], paused: ['warn', 'Paused'] };
const fitTag = f => FIT_TAG[f] ? `<span class="tag-fit ${FIT_TAG[f][0]}">${FIT_TAG[f][1]}</span>` : '';

function viewChallenge() {
  const seg = `<div class="seg" role="tablist">${[['challenges', '🏆 Challenges'], ['friends', '👥 Friends']].map(([k, l]) =>
    `<button role="tab" class="${ui.socialTab === k ? 'on' : ''}" data-act="social-tab" data-k="${k}">${l}</button>`).join('')}</div>`;
  return seg + (ui.socialTab === 'friends' ? viewFriends() : viewChallenges());
}

// Real competitions to enter: Egypt from the Egypt Fitness Events calendar, worldwide coming later.
const CALENDAR_URL = 'https://abdullahmsalama.github.io/egypt-fitness-calendar/';
function viewCompetitions() {
  const where = ui.compTab || 'egypt';
  const tabs = `<div class="seg mini" role="tablist">${[['egypt', '🇪🇬 Egypt'], ['world', '🌍 Worldwide']].map(([k, l]) =>
    `<button role="tab" class="${where === k ? 'on' : ''}" data-act="comp-tab" data-k="${k}">${l}</button>`).join('')}</div>`;
  const body = where === 'egypt'
    ? `<p>Every fitness event in Egypt we can verify, ordered by date: running, hybrid (Alpha X, Hyrox), CrossFit, strength, obstacle, cycling, swimming and triathlon.</p>
       <p class="hint">Open a row for format, cost, and whether it suits a first-timer. Add all events to your calendar in one tap.</p>
       <a class="btn primary" href="${CALENDAR_URL}" target="_blank" rel="noopener" data-act="race-site" data-k="calendar">🗓️ Open the Egypt Fitness Calendar ↗</a>`
    : `<p class="coming">🌍 Coming soon</p><p class="hint">Competitions worldwide are on the way. For now, see Egypt, or the official race websites in Race prep.</p>`;
  return `<section class="card comp-card"><h3>🗓️ Competitions Calendar</h3><p class="hint">Looking for a race to enter?</p>${tabs}${body}</section>`;
}

function viewFriends() {
  const friends = Object.values(S.friends).sort((a, b) => b.updated - a.updated);
  const mine = CH.me(S);
  return `
    <section class="card me-card">
      ${avatar(S.id, mine.name)}
      <div class="who"><strong>${h(S.profile.name || 'You')}</strong><span>${levelLabel(S.run.level)}</span></div>
      <button class="btn primary small" data-act="invite">Invite</button>
    </section>
    <section class="card">
      <h3>Running buddies</h3>
      ${friends.length ? `<ul class="friends">${friends.map(f => `<li>
          ${avatar(f.id, f.name)}
          <div class="who"><strong>${h(f.name)}</strong><span>${levelLabel(f.level)}${f.rebuild ? ' · 🩹 rebuilding' : ''}</span><em>updated ${ago(f.updated)}</em></div>
          <button class="btn small" data-act="challenge-friend" data-id="${h(f.id)}">Challenge</button>
        </li>`).join('')}</ul>`
      : `<p class="hint">No buddies yet. Send your invite link: when a friend opens it, you show up in their list, and they can send theirs back.</p>`}
      <p class="hint">Levels update each time a friend sends you a link (invite, challenge or result).</p>
    </section>`;
}

function viewChallenges() {
  const rec = S.challenges.received, sent = S.challenges.sent;
  const who = CH.me(S);
  const active = rec.filter(c => c.status === 'active'), later = rec.filter(c => c.status === 'later'), done = rec.filter(c => c.status === 'done');
  const card = c => {
    const pr = CH.progress(S, c, now());
    const left = Math.ceil((c.due - now()) / 864e5);
    const scaled = c.scaled ? `<p class="hint">Your version of “${h(c.originalTitle)}”</p>` : '';
    return `<li class="ch-card">
        <div class="ch-top"><span class="ch-icon">${CH.TEMPLATES[c.tpl].icon}</span><div><strong>${h(CH.challengeTitle(c))}</strong>
          <span class="hint">from ${h(c.from.name)} · ${left > 0 ? `${left} day${left > 1 ? 's' : ''} left` : 'time is up, finish anyway!'}</span></div></div>
        ${scaled}${c.msg ? `<p class="quote">“${h(c.msg)}”</p>` : ''}
        ${pr ? `<div class="bar ch-bar"><div style="width:${Math.min(100, pr.have / pr.need * 100)}%"></div></div><p class="hint">${Math.min(pr.have, pr.need)} / ${pr.need} logged since you accepted</p>` : ''}
        <div class="row">${pr && pr.have < pr.need ? '<span class="hint">Fills in as you log sessions on Today.</span>' : `<button class="btn primary small" data-act="ch-done" data-id="${h(c.id)}">Done ✓</button>`}<button class="btn ghost small" data-act="ch-drop" data-id="${h(c.id)}">Not this time</button></div>
      </li>`;
  };
  const goal = c => {
    const f = CH.fit(c, who);
    const L = CH.challengeLevel(c);
    const can = f === 'ready' || f === 'stretch' || f === 'big';
    return `<li class="ch-card goal">
        <div class="ch-top"><span class="ch-icon">${CH.TEMPLATES[c.tpl].icon}</span><div><strong>${h(CH.challengeTitle(c))}</strong><span class="hint">from ${h(c.from.name)}</span></div>${fitTag(f)}</div>
        <p class="hint">${can ? 'Within reach now. Ready when you are!' : f === 'way' ? `🎯 Suits Level ${L}. You're on Level ${S.run.level}: ${L - S.run.level} level${L - S.run.level > 1 ? 's' : ''} to go. Keep climbing!` : 'Waiting until you are back to running.'}</p>
        <div class="row">${can ? `<button class="btn small primary" data-act="ch-start" data-id="${h(c.id)}">Start now</button>` : ''}<button class="btn ghost small" data-act="ch-drop" data-id="${h(c.id)}">Remove</button></div>
      </li>`;
  };
  return `
    <button class="btn primary wide" data-act="new-challenge">＋ New challenge</button>
    <section class="card"><h3>Active</h3>${active.length ? `<ul class="ch-list">${active.map(card).join('')}</ul>` : '<p class="hint">No active challenges. Create one, or ask a friend to send you one.</p>'}</section>
    ${later.length ? `<section class="card"><h3>Saved goals</h3><ul class="ch-list">${later.map(goal).join('')}</ul></section>` : ''}
    <section class="card"><h3>Sent</h3>${sent.length ? `<ul class="sent">${sent.slice(0, 12).map(c => `<li>
        <span class="ch-icon">${CH.TEMPLATES[c.tpl].icon}</span>
        <div><strong>${h(CH.challengeTitle(c))}</strong><span class="hint">to ${h(c.to?.name || 'anyone with the link')} · ${ago(c.created)}</span>
        ${c.results.length ? c.results.map(r => `<span class="result">✅ ${h(r.name)} did it${r.scaled ? ' (their version)' : ''}</span>`).join('') : '<span class="hint">Waiting for results…</span>'}</div>
        <button class="btn ghost small" data-act="reshare" data-id="${h(c.id)}">Share</button></li>`).join('')}</ul>` : '<p class="hint">Nothing sent yet.</p>'}</section>
    ${done.length ? `<section class="card"><h3>Completed</h3><ul class="sent">${done.slice(0, 12).map(c => `<li><span class="ch-icon">✅</span><div><strong>${h(CH.challengeTitle(c))}</strong><span class="hint">from ${h(c.from.name)} · ${ago(c.doneAt)}</span></div></li>`).join('')}</ul></section>` : ''}`;
}

// ---------- sharing ----------
const baseUrl = () => location.origin + location.pathname;
function shareData(kind, payload) {
  const mine = CH.me(S);
  const lvl = E.runLevel(S.run.level);
  if (kind === 'invite') return { title: 'Run with me on Stride Quest', text: `${mine.name} is on Level ${lvl.n} (${lvl.name}) in Stride Quest. Join me and let's level up together! 🏃`, url: CH.encodeLink(baseUrl(), { t: 'f', from: mine }) };
  if (kind === 'challenge') return { title: 'Stride Quest challenge', text: `🏆 ${mine.name} challenges you: ${CH.challengeTitle(payload)}! You have ${payload.days} days.${payload.msg ? ` “${payload.msg}”` : ''}`, url: CH.encodeLink(baseUrl(), { ...payload, from: mine }) };
  return { title: 'Challenge done!', text: `✅ I did it: ${payload.title}${payload.scaled ? ' (my version)' : ''}! Your turn 😉`, url: CH.encodeLink(baseUrl(), payload) };
}

function openIncoming() {
  const inc = ui.incoming;
  if (!S.placedAt) return;
  ui.incoming = null;
  if (inc.from.id === S.id) { toast("That's your own link 😄 Share it with a friend."); return; }
  const t = now();
  if (inc.t === 'f') { S = CH.addFriend(S, inc.from, t); store.save(S); ui.modal = { type: 'incoming', inc }; }
  else if (inc.t === 'r') {
    const { state, matched } = CH.applyResult(S, inc, t);
    S = state; store.save(S);
    ui.modal = { type: 'incoming', inc, matched };
    setTimeout(confetti, 200);
  } else ui.modal = { type: 'incoming', inc };
}

function viewCoach() {
  const msgs = ui.chat.length ? ui.chat : [{ role: 'assistant', content: `Hey${S.profile.name ? ' ' + S.profile.name : ''}! I'm your coach. Ask me what to do today, how a drill works, or how you're feeling. I run on a free AI model, so give me a few seconds if I'm busy 🙂` }];
  const modeSeg = `<div class="seg coach-seg">${[[false, '⚡ Quick'], [true, '🧠 Smart · slower']].map(([v, l]) => `<button class="${!!ui.smartCoach === v ? 'on' : ''}" data-act="coach-mode" data-v="${v ? 1 : 0}">${l}</button>`).join('')}</div>
    <p class="hint coach-mode-hint">${ui.smartCoach ? '🧠 Smart coach thinks longer and is better at tricky questions like a wrong placement. Replies take about 5-30 seconds.' : '⚡ Quick coach answers in a couple of seconds. Switch to Smart for tricky questions.'}</p>`;
  return `<button class="btn ghost small coach-back" data-act="coach-back">◂ Back</button>${modeSeg}<section class="chat">
      <div class="chat-log">${msgs.map((m, mi) => `<div class="msg ${m.role}">${md(m.content)}${m.provider === 'offline' ? `<span class="tag warn">${m.reason ? `⚠️ ${h(AI_TROUBLE[m.reason] || AI_TROUBLE.down)} Meanwhile, this answer is from the built-in coach.` : 'built-in coach'}</span>` : m.role === 'assistant' && m.model ? `<span class="tag">${h(aiLabel(m.model, m.provider, m.tier))}</span>` : ''}</div>${m.role === 'user' && ui.chat.length && !(ui.thinking && mi === ui.chat.length - 1) ? `<div class="msg-tools"><button class="linkish" data-act="msg-edit" data-m="${mi}">✏️ Edit</button><button class="linkish" data-act="msg-del" data-m="${mi}">🗑 Delete</button></div>` : ''}${suggestionCards(m, mi)}`).join('')}
        ${ui.thinking ? `<div class="msg assistant typing"><span></span><span></span><span></span>${ui.smartCoach ? '<em class="slow-note">🧠 Thinking it through…</em>' : ''}${ui.slow ? `<em class="slow-note">${ui.smartCoach ? 'Still thinking… smart answers take a bit longer' : 'Still thinking… the AI is busy, a few more seconds'}</em>` : ''}</div>` : ''}</div>
      <div class="quick">${['What should I do today?', 'I feel sore', 'Explain my level', 'How fast should easy runs be?'].map(q => `<button class="pill" data-act="quick" data-q="${h(q)}">${h(q)}</button>`).join('')}</div>
      <form id="chat-form" class="chat-input">
        ${canListen ? `<button type="button" class="mic ${ui.listening ? 'on' : ''}" data-act="mic" aria-label="Speak">🎤</button>` : ''}
        <input name="msg" placeholder="${ui.listening ? 'Listening…' : 'Message your coach'}" autocomplete="off" maxlength="1000">
        ${ui.thinking ? '<button class="btn" type="button" data-act="chat-stop">⏹ Stop</button>' : '<button class="btn primary" type="submit">Send</button>'}
      </form>
      ${canSpeak ? `<label class="choice small"><input type="checkbox" data-act="speak-toggle" ${ui.speakReplies ? 'checked' : ''}><span>Read replies aloud</span></label>` : ''}
      <p class="hint">⏱️ The coach runs on a shared AI model, so replies can take a few seconds when it's busy. It can suggest changes; nothing changes until you tap Apply. Messages go to Google's Gemini AI to write replies. Not medical advice.</p>
    </section>`;
}

// What the app has saved for your lifts and how it read them: everything lives on this device only.
// "Since 3 Aug: bodyweight −2 kg, body fat −3 points" (same unit and method only).
function bodyTrend() {
  const log = S.bodyLog || [];
  if (log.length < 2) return '';
  const last = log.at(-1), first = log.find(b => b.unit === last.unit) || log[0];
  if (first === last) return '';
  const d = (x, y) => { const v = Math.round((x - y) * 10) / 10; return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}`; };
  const fat = first.bf && last.bf && first.method === last.method ? `, body fat ${d(last.bf, first.bf)} points` : '';
  const lift = (k, name) => (first[k] > 0 && last[k] > 0 && first.mode === last.mode && first[k] !== last[k] ? `, ${name} ${d(last[k], first[k])} ${last.unit}` : '');
  return `<br>📈 Since ${new Date(first.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: bodyweight ${d(last.bw, first.bw)} ${last.unit}${fat}${lift('sq', 'squat')}${lift('dl', 'deadlift')}.`;
}

function numbersCard() {
  const a = S.answers || {};
  const u = a.liftUnit === 'lb' ? 'lb' : 'kg';
  const mode = a.liftMode === '1' ? '1-rep max' : a.liftMode === 'unknown' ? "didn't know" : '5 reps';
  const val = v => (+v > 0 ? `${+v} ${u}` : '—');
  const r = HYB.readLifts(a, S.profile.sex);
  const cleared = S.hybrid.strength.stage > 0 ? STRENGTH_STAGES[S.hybrid.strength.stage - 1] : null;
  const working = HYB.strengthStage(S);
  const has = +a.squat5 > 0 || +a.deadlift5 > 0;
  return `<section class="card"><h3>📏 My numbers</h3>
      <p class="hint">Saved on this device only (no one else, including us, can see them).</p>
      <div class="kv"><span>Bodyweight</span><b>${val(a.bodyweight)}</b>${+a.bodyFat > 0 ? `<span>Body fat</span><b>${+a.bodyFat}%</b>` : ''}<span>Squat (${mode})</span><b>${val(a.squat5)}</b><span>Deadlift (${mode})</span><b>${val(a.deadlift5)}</b><span>Strict pull-ups</span><b>${a.pullups !== '' && a.pullups != null ? +a.pullups : '—'}</b></div>
      <p class="hint">${has && r.level ? `Read as: ${[r.sqRatio ? `squat ${r.sqRatio.toFixed(2)}× bodyweight` : '', r.dlRatio ? `deadlift ${r.dlRatio.toFixed(2)}×` : ''].filter(Boolean).join(', ')}${a.pullups == null || a.pullups === '' ? ' · no pull-ups given (caps the top stages)' : ''}.` : '⚠️ No lift numbers saved: your Strength lane was placed from experience and races only.'}
        ${has && r.level && +a.bodyFat > 0 ? `<br>Per kg of lean mass (estimate): ${[r.sqRatio ? `squat ${(r.sqRatio / (1 - a.bodyFat / 100)).toFixed(2)}×` : '', r.dlRatio ? `deadlift ${(r.dlRatio / (1 - a.bodyFat / 100)).toFixed(2)}×` : ''].filter(Boolean).join(', ')}${a.bodyFatMethod === 'dexa' ? '' : ' (only as good as your body-fat reading)'}.` : ''}
        ${bodyTrend()}
        <br>Strength now: ${cleared ? `cleared ${h(cleared.name)}, ` : ''}working on <strong>${h(working.name)}</strong> (${h(ST.sexText(working.target, S.profile.sex))}).</p>
      <button class="btn" data-act="edit-numbers">Update my numbers</button>
    </section>`;
}

// ---------- Strava (opt-in): your activities come in by themselves ----------
const STRAVA_KEY = 'stride-quest:strava';
const stravaState = () => { try { return JSON.parse(localStorage.getItem(STRAVA_KEY)) || {}; } catch { return {}; } };
const setStrava = v => { try { localStorage.setItem(STRAVA_KEY, JSON.stringify(v)); } catch { /* ignore */ } };
const STRAVA_RETURN = () => location.origin + location.pathname;
const stravaApi = async (path, body) => { try { const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}/strava/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: stravaDevice(), ...body }) }); return await r.json(); } catch { return { error: 'offline' }; } };
const stravaDevice = () => { const st = stravaState(); if (st.device) return st.device; const d = crypto.randomUUID(); setStrava({ ...st, device: d }); return d; };
async function stravaRefreshStatus() {
  const d = await stravaApi('status', {});
  if (!d.error) { ui.stravaStatus = d; if (d.admin && !ui.stravaAdmin) ui.stravaAdmin = await stravaApi('admin', { action: 'list' }); }
  if (ui.tab === 'me') render();
}
function stravaConnect() {
  const device = stravaDevice();
  location.href = `${WORKER_URL.replace(/\/$/, '')}/strava/connect?device=${device}&return=${encodeURIComponent(STRAVA_RETURN())}`;
}
// Back from Strava: ?strava=connected|denied|scope|limit|error
function stravaReturn() {
  const q = new URLSearchParams(location.search), r = q.get('strava');
  if (!r) return;
  history.replaceState(null, '', location.pathname + location.hash);
  const msg = { connected: '🔗 Strava connected! Your activities are coming in.', denied: 'Strava wasn\'t connected (you cancelled).', scope: 'Please allow "View data about your activities" so the app can read your runs.',
    limit: 'The shared Strava app is full right now. Ask the app owner (Abdullah Salama), or use your own Strava app.', error: 'Strava couldn\'t be connected. Try again in a minute.',
    'not-approved': 'Strava isn\'t open for you yet: send a request from Me, or use your own Strava app.' }[r];
  if (r === 'connected') { setStrava({ ...stravaState(), connected: true, since: Date.now() }); setTimeout(() => stravaSync(true), 300); }
  if (msg) setTimeout(() => toast(msg), 600);
}
// A logged activity from Strava (non-run: counts in the week and nutrition; run: also offered as today's session).
function fromStrava(a) {
  const run = STRAVA_RUN.has(a.type), age = +S.nutrition?.age || null;
  const effort = effortOf(a.hr, age), minutes = Math.round(a.minutes || a.elapsed || 0);
  const pace = a.km > 0 ? minutes / a.km : null;
  const item = run ? { title: `Run ${a.km} km`, cls: minutes >= 75 ? 'long' : effort === 'hard' ? 'hard' : 'easy', track: 'run', minutes, effort, km: a.km }
    : sessionItem({ kind: kindOfStrava(a.type), minutes, effort, name: a.name || a.type, ...(stravaMet(a.type, effort, a.climb, minutes) || {}) });
  const title = run ? `🏃 ${a.name || 'Run'} · ${a.km} km${pace ? ` · ${formatTime(pace)} /km` : ''}` : `${(otherOf(kindOfStrava(a.type)) || otherOf('other')).label.split(' ')[0]} ${a.name || a.type} · ${minutes} min`;
  return { ts: Date.parse(a.start) || now(), kind: 'activity', title, xp: 0, item, strava: { id: a.id, type: a.type, km: a.km, minutes: a.minutes || minutes, hr: a.hr, climb: a.climb }, run };
}
async function stravaSync(force = false) {
  const st = stravaState();
  if (!st.connected || !st.device || !WORKER_URL || ui.stravaSyncing) return;
  if (!force && st.lastSync && Date.now() - st.lastSync < 20 * 60000) return;
  ui.stravaSyncing = true;
  try {
    const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}/strava/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: st.device, after: st.lastSeen ? st.lastSeen / 1000 - 3600 : null, ...(st.byo?.secret ? { secret: st.byo.secret } : {}) }) });
    const d = await r.json();
    if (!d.connected) { setStrava({ ...st, connected: false }); if (d.error) toast(d.error); return; }
    if (d.error) { if (force || d.error === 'own-app-secret') toast(d.error === 'busy' ? 'Strava is busy right now. Try again soon.' : d.error === 'own-app-secret' ? 'Your own Strava app\'s secret is missing on this phone: connect again.' : "Strava couldn't be read right now."); return; }
    const known = new Set(S.history.filter(x => x.strava).map(x => x.strava.id));
    const fresh = (d.activities || []).filter(a => !known.has(a.id)).map(fromStrava);
    if (fresh.length) { S.history.push(...fresh.map(({ run, ...x }) => x)); S.history.sort((a, b) => a.ts - b.ts); store.save(S); }
    setStrava({ ...st, connected: true, name: d.name || st.name, lastSync: Date.now(), lastSeen: Math.max(st.lastSeen || 0, ...(d.activities || []).map(a => Date.parse(a.start) || 0)) });
    if (fresh.length) { toast(`🔗 ${fresh.length} new activit${fresh.length === 1 ? 'y' : 'ies'} from Strava`); render(); }
    else if (force) toast('Strava: nothing new.');
  } catch { if (force) toast('No connection to Strava right now.'); }
  finally { ui.stravaSyncing = false; if (ui.tab === 'me') render(); }
}
// A Strava run on a day with a planned run that isn't logged yet: offer to count it as that session.
function stravaMatches() {
  const w = K.buildWeek(S, now()), open = (w.days[w.today]?.items || []).filter(it => !it.done && it.track === 'run' && it.idx != null && (it.cls === 'easy' || it.cls === 'long' || it.cls === 'hard' || it.cls === 'test'));
  if (!open.length) return [];
  // The planned run that looks most like it: long for 75+ min, hard for a hard effort, else easy.
  const kindOf = x => (x.item?.cls === 'long' ? 'long' : x.item?.cls === 'hard' ? 'hard' : 'easy');
  const like = { long: ['long', 'easy'], hard: ['hard', 'test'], easy: ['easy', 'long'] };
  return S.history.filter(x => x.kind === 'activity' && x.strava && STRAVA_RUN.has(x.strava.type) && !x.linked && !x.dismissed && E.dayKey(x.ts) === ymdNow()).map(x => {
    const step = open.find(it => like[kindOf(x)].includes(it.cls));
    return { act: x, step: step || open[0], differs: !step };
  });
}
function stravaCard() {
  const st = stravaState(), ss = ui.stravaStatus;
  if (!st.connected && !ss && !ui.stravaStatusLoading) { ui.stravaStatusLoading = true; stravaRefreshStatus().finally(() => { ui.stravaStatusLoading = false; }); }
  const own = '<button class="linkish small" data-act="strava-own">Have your own Strava API app (paid Strava)? Use it</button>';
  let body;
  if (st.connected) body = `<p>Connected${st.name ? ` as <strong>${h(st.name)}</strong>` : ''}${st.byo ? ' (your own Strava app)' : ''}. ${st.lastSync ? `Last synced ${new Date(st.lastSync).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
        <p class="hint">Runs, rides, gym sessions and more come in by themselves: they show in your week, count in Nutrition, and a run can count as your planned session with one tap.</p>
        <div class="row wrap"><button class="btn small" data-act="strava-sync">${ui.stravaSyncing ? 'Syncing…' : '↻ Sync now'}</button><button class="btn ghost small" data-act="strava-disconnect">Disconnect</button></div>`;
  else if (!ss) body = '<p class="hint">Checking…</p>';
  else if (ss.status === 'approved') body = `<p class="hint">You're approved. Connect once and your workouts come in by themselves, from any watch or app that syncs to Strava (Garmin, Apple Watch, COROS, Runna…). Read-only: the app never posts to Strava.</p><button class="strava-btn" data-act="strava-connect">Connect with Strava</button>`;
  else if (ss.status === 'pending') body = `<p>⏳ <strong>Request sent.</strong> You can connect as soon as the app owner (Abdullah Salama) approves it.</p><div class="row wrap"><button class="btn small ghost" data-act="strava-check">Check again</button></div><p class="hint">${own}</p>`;
  else body = `<p class="hint">Bring your workouts in automatically from any watch or app that syncs to Strava. Strava limits how many people can share this app, so ask for access first${ss.status === 'declined' ? ' (your last request wasn\'t approved)' : ''}.</p>
        <div class="row wrap"><button class="btn small primary" data-act="strava-request">Request Strava access</button></div><p class="hint">${own}</p>`;
  const ad = ss?.admin && ui.stravaAdmin && !ui.stravaAdmin.error ? ui.stravaAdmin : null;
  const admin = ad ? `<div class="strava-admin"><p class="q">👑 Requests <span class="hint">· ${ad.used} of 10 shared slots in use</span></p>${ad.requests.length ? `<ul>${ad.requests.map(r => `<li><div><strong>${h(r.name)}</strong> <span class="hint">${h(r.status)}${r.strava ? ` · connected as ${h(r.strava)}` : ''}</span>${r.msg ? `<br><span class="hint">“${h(r.msg)}”</span>` : ''}</div>
        <div class="row">${r.status !== 'approved' ? `<button class="btn small primary" data-act="strava-decide" data-v="approve" data-d="${h(r.device)}">Approve</button>` : `<button class="btn small ghost" data-act="strava-decide" data-v="revoke" data-d="${h(r.device)}">Remove</button>`}${r.status === 'pending' ? `<button class="btn small ghost" data-act="strava-decide" data-v="decline" data-d="${h(r.device)}">Decline</button>` : ''}</div></li>`).join('')}</ul>` : '<p class="hint">No requests yet.</p>'}</div>` : '';
  return `<section class="card strava-card"><h3>🔗 Strava${ss?.admin && ss.pending ? ` <span class="count-badge">${ss.pending}</span>` : ''}</h3>${body}${admin}
      <p class="powered">Powered by Strava</p>${ss && !ss.admin ? '<p class="hint owner-link"><button class="linkish" data-act="strava-claim">App owner?</button></p>' : ''}</section>`;
}

// ---------- floating coach ----------
// A little coach in the corner of every screen (cap, whistle, friendly face). Waves now and then; a dot
// when the coach has said something you haven't seen.
function coachFab() {
  return `<button class="coach-fab ${ui.coachUnread ? 'unread' : ''}" data-act="coach-open" aria-label="Open your coach">
    <svg viewBox="0 0 64 64" width="58" height="58" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#ff6b35"/><circle cx="32" cy="32" r="31" fill="none" stroke="#fff" stroke-width="2.5"/>
      <path d="M14,60 Q32,44 50,60Z" fill="#1e88e5"/>
      <path d="M26,44 L32,52 L38,44" fill="none" stroke="#fff" stroke-width="1.6"/>
      <circle cx="32" cy="32" r="12" fill="#f1c49b"/>
      <path d="M19,28 Q32,12 45,28 Z" fill="#14213d"/><rect x="18" y="26.5" width="28" height="4" rx="2" fill="#14213d"/><path d="M44,28.5 L52,29.5 L44,31" fill="#14213d"/>
      <circle cx="27.5" cy="33" r="1.7" fill="#14213d"/><circle cx="36.5" cy="33" r="1.7" fill="#14213d"/>
      <path d="M27,38 Q32,42 37,38" fill="none" stroke="#14213d" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="24.5" cy="37" r="2" fill="#ff8a65" opacity=".6"/><circle cx="39.5" cy="37" r="2" fill="#ff8a65" opacity=".6"/>
      <path d="M25,44 Q32,50 39,44" fill="none" stroke="#ffd23f" stroke-width="1.4"/><rect x="36" y="45.5" width="7" height="3.6" rx="1.8" fill="#ffd23f" stroke="#c9a400" stroke-width=".6"/>
      <g class="fab-hand"><path d="M50,48 L55,38" stroke="#f1c49b" stroke-width="4" stroke-linecap="round"/><circle cx="55.5" cy="36.5" r="3" fill="#f1c49b"/></g>
    </svg>${ui.coachUnread ? '<i class="fab-dot"></i>' : ''}<span class="fab-label">Coach</span></button>`;
}

// ---------- Family mode (under 13) ----------
function kidPlays() { return S.history.filter(x => x.kind === 'play'); }
function viewKids() {
  const day = E.dayKey(now()), [m1, m2] = missionsFor(S.profile.likes, day);
  const plays = kidPlays(), todayDone = plays.filter(x => E.dayKey(x.ts) === day).map(x => x.mission);
  const got = new Set(plays.map(x => x.mission));
  const days = new Set(plays.map(x => E.dayKey(x.ts)));
  let streak = 0, d = days.has(day) ? now() : now() - E.DAY;
  while (days.has(E.dayKey(d)) && streak < 3650) { streak++; d -= E.DAY; }
  const card = (m, bonus) => `<section class="card kid-mission ${todayDone.includes(m.id) ? 'done' : ''}"><p class="eyebrow">${bonus ? '⭐ Bonus mission' : '🌟 Today\'s mission'} · about ${m.min} min</p>
      <h2>${m.icon} ${h(m.title)}</h2><p>${h(m.how)}</p>
      ${todayDone.includes(m.id) ? '<p class="kid-yay">🎉 Done! Sticker collected.</p>' : `<button class="btn primary" data-act="kid-done" data-id="${m.id}">We did it! ⭐</button>`}</section>`;
  const tip = KID_TIPS[(new Date(now()).getDate()) % KID_TIPS.length];
  return `<section class="card kid-hero"><h2>Hi${S.profile.name ? ` ${h(S.profile.name)}` : ''}! 👋</h2><p class="kid-stats"><span>⭐ ${plays.length} mission${plays.length === 1 ? '' : 's'}</span><span>🔥 ${streak} day${streak === 1 ? '' : 's'} in a row</span><span>🏅 ${got.size} / ${MISSIONS.length} stickers</span></p></section>
    ${card(m1)}${todayDone.includes(m1.id) ? card(m2, true) : ''}
    <section class="card"><h3>🏅 Sticker book</h3><div class="stickers">${MISSIONS.map(m => `<span class="${got.has(m.id) ? 'on' : ''}" title="${h(m.title)}">${m.icon}</span>`).join('')}</div><p class="hint">Do a mission to collect its sticker. New missions every day!</p></section>
    <section class="card"><h3>👨‍👩‍👧 For grown-ups</h3><p class="hint">${h(tip)}</p><p class="hint">Family mode has no training plans, times, calorie numbers, AI chat or sharing. Stop if your child feels pain, dizzy or unwell. At 13 the app moves on to Teen mode.</p></section>`;
}
function viewKidMe() {
  const a = AGE.ageOf(S);
  return `<section class="card"><h3>👤 ${h(S.profile.name || 'Me')}</h3><p>Family mode${a ? ` · ${a} years old` : ''}</p>
      <p class="q">Favourite kinds of play</p><div class="choices">${KID_LIKES.map(([k, l]) => `<label class="choice"><input type="checkbox" data-act="kid-like" data-k="${k}" ${(S.profile.likes || []).includes(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></section>
    <section class="card"><h3>Grown-ups</h3><p class="hint">Turned 13? Update the age to move to Teen mode. Stickers stay.</p><div class="row wrap"><button class="btn small" data-act="retake">Update age / start again</button><button class="btn ghost small" data-act="export">Back up</button><button class="btn ghost small" data-act="reset">Delete everything</button></div></section><p class="byline credit">Developed by <button type="button" class="linkish" data-act="about-me">Abdullah Salama</button></p>`;
}

// ---------- strength split ----------
// The best split for the strength days in the week, now and in competition mode. Shown to Hybrid athletes
// (it shapes their strength sessions) and to anyone who lifts outside the app (as advice for their gym days).
function splitCard() {
  const gym = (S.otherTraining || []).find(o => o.kind === 'weights');
  if (!HYB.hasHybrid(S) && !gym) return '';
  const td = K.schedule(S).days.length;
  const n = HYB.hasHybrid(S) ? SPL.strengthDays(S, td) : (gym.days || []).length || 2;
  const stage = S.hybrid?.strength?.stage ?? 3;
  const sp = HYB.hasHybrid(S) ? SPL.activeSplit(S, td) : { id: SPL.recommend(n, stage).id, auto: true };
  const rec = SPL.recommend(n, stage), ph = S.target ? TG.phase(S.target, now()) : null;
  const season = ph && ['peak', 'taper', 'raceweek', 'recover'].includes(ph.id) ? SPL.recommend(n, stage, ph.id) : null;
  const sessions = sp.id && STRENGTH_STAGES[Math.min(stage, STRENGTH_STAGES.length - 1)]?.parts ? SPL.splitSessions(sp.id, STRENGTH_STAGES[Math.min(stage, STRENGTH_STAGES.length - 1)].parts, n).map(x => x.title.split(':')[0]) : [];
  const table = [1, 2, 3, 4, 5, 6].map(d => `<tr class="${d === n ? 'on' : ''}"><td>${d}</td><td>${h(SPL.recommend(d, stage).label)}</td><td>${h(SPL.recommend(d, stage, 'peak').label)}</td></tr>`).join('');
  return `<section class="card split-card"><h3>🏋️ My strength split</h3>
      <p><strong>${h(SPL.SPLITS[sp.id]?.label || rec.label)}</strong> · ${n} strength day${n > 1 ? 's' : ''} a week${sp.auto ? ' <span class="hint">(recommended)</span>' : ''}${sp.stageDefault ? ' <span class="hint">(full body until the barbell stages)</span>' : ''}</p>
      ${sessions.length ? `<p class="hint">Rotation: ${h(sessions.join(' → '))}</p>` : ''}
      <p class="hint">${h((SPL.SPLITS[sp.id] || rec).why)}</p>
      ${!sp.auto && sp.id !== rec.id ? `<p class="hint">💡 For ${n} days we'd pick <strong>${h(rec.label)}</strong>.</p>` : ''}
      ${season ? `<div class="banner info">🎯 <strong>${h(ph.title)}: ${h(season.label)}.</strong> ${h(season.why)}</div>` : ''}
      ${gym && !HYB.hasHybrid(S) ? '<p class="hint">Advice for your gym days (from My other training). Your plan keeps hard runs off heavy-leg days.</p>' : ''}
      <details class="tip-box"><summary>Best split by strength days</summary><table class="split-table"><tr><th>Days</th><th>Normal</th><th>Race prep</th></tr>${table}</table>
        <p class="hint">Taper: one full-body session, half the sets. Race week: no heavy lifting (last heavy legs 7-10 days out). After the race: mobility first.</p></details>
      ${HYB.hasHybrid(S) ? '<button class="btn small" data-act="split-edit">Change split</button>' : ''}</section>`;
}

// ---------- nutrition ----------
// Who the athlete is, for the nutrition maths (weight from the latest weigh-in, then My numbers).
function nutriProfile() {
  const n = S.nutrition || {}, a = S.answers || {}, last = (S.bodyLog || []).at(-1);
  const toKg = (v, u) => (+v > 0 ? +v * (u === 'lb' ? 0.4536 : 1) : null);
  const kg = toKg(last?.bw, last?.unit) || toKg(a.bodyweight, a.liftUnit) || n.kg || null;
  const b5 = S.bests?.run5k || a.best5k;
  return { sex: S.profile.sex || 'x', age: +n.age || 30, heightCm: +n.heightCm || null, kg, bodyFat: +(last ? last.bf : a.bodyFat) || null,
    life: n.life || 'sit', easyPace: b5 > 0 ? b5 / 5 + 1.25 : 6.5, trains: true, strengthBlock: S.hybrid?.block?.type === 'strength' };
}
const ymdNow = () => E.dayKey(now());
// The goal in force today: the athlete's own, unless they applied a safer option for a while.
function nutriGoal() {
  const n = S.nutrition || {}, o = n.override;
  if (o && o.until >= ymdNow()) return { ...n.goal, type: o.mode === 'perform' ? 'maintain' : 'maintain', overridden: o };
  return n.goal || { type: 'maintain' };
}
// Today's training: the plan, plus regular outside sessions on this weekday, plus one-offs added today.
function nutriDay() {
  const w = K.buildWeek(S, now());
  const logged = S.history.filter(x => x.kind === 'activity' && !x.linked && E.dayKey(x.ts) === ymdNow()).map(x => ({ ...x.item, doneActivity: true }));
  // Done sessions keep counting: their kind comes from the title (a long run, intervals, strength…).
  const doneCls = it => (it.track === 'run' ? (/long/i.test(it.title) ? 'long' : /tempo|interval|hill|x \d|fartlek|race|time trial|boss|gate/i.test(it.title) ? 'hard' : 'easy') : it.track === 'swim' ? 'swim' : it.track === 'bike' ? 'bike' : it.track === 'engine' ? 'hard' : 'strength');
  const linkedToday = S.history.filter(x => x.kind === 'activity' && x.linked && x.strava && E.dayKey(x.ts) === ymdNow());
  const planned = (w.days[w.today]?.items || []).filter(x => !x.sick && !x.activity && !x.attempt).map(x => {
    if (!x.done) return x;
    const st = linkedToday.find(a => a.linked === x.key || a.linkedTitle === x.title)?.strava; // its real minutes/km from Strava
    return { ...x, cls: doneCls(x), doneActivity: true, ...(st ? { minutes: Math.round(st.minutes), title: `${x.title} (${st.km} km on Strava)`, km: st.km } : {}) };
  });
  // A regular outside session (e.g. gym on Mondays) logged today isn't counted twice.
  const regular = otherItems(S.otherTraining, w.today).filter(r => !logged.some(l => l.kind === r.kind));
  return [...planned, ...regular, ...logged];
}
// Same as collectOb, for the "My other training" pop-up.
function collectOther() {
  const f = document.getElementById('other-form');
  if (!f || !ui.modal?.a) return;
  const a = {};
  for (const el of f.elements) { if (!el.name) continue; if (el.type === 'checkbox') { if (el.checked) a[el.name] = true; } else if (el.type === 'radio') { if (el.checked) a[el.name] = el.value; } else a[el.name] = el.value; }
  ui.modal.a = a;
}
function nutriToday() {
  const p = nutriProfile();
  if (!p.kg || !p.heightCm) return null;
  const R = NU.rmr(p).kcal, items = nutriDay(), day = NU.dayLoad(items, p, R);
  const t = S.target, ph = t ? TG.phase(t, now()) : null;
  // Carb-loading the 2 days before a race over ~90 minutes.
  // Expected time: the verdict's range, else (verdict 'no', e.g. in race week) from the 5K best or a typical time.
  const v = t ? TG.verdict(S, t, now(), ui.events || []) : null, fr = v?.range || (t?.distance ? TG.finishRange(t.distance, S.bests?.run5k || S.answers?.best5k) : null), expected = fr ? (fr[0] + fr[1]) / 2 : null;
  const raceLoad = ph && (ph.d === 1 || ph.d === 2) && (expected || 0) > 90 ? 9 : 0;
  const reds = S.nutrition?.reds?.flags?.length > 0 && now() - S.nutrition.reds.ts < 60 * E.DAY;
  const goal = nutriGoal(), tg = NU.targets(p, day, goal, { raceLoad, reds });
  const own = S.nutrition?.goal || { type: 'maintain' };
  const tired = S.history.filter(h => h.ts > now() - 3 * E.DAY && (h.pain >= 3 || h.kind === 'attempt')).length > 0;
  const list = NU.checks({ goal: own.type === goal.type ? goal : own, phase: ph?.id, rebuild: S.rebuild?.active, sick: S.mode?.type === 'sick', spike: TG.loadSpike(S.history, now()), tired, t: tg, load: day.load,
    goalCheck: tg.held ? null : NU.goalCheck(p, own, now()), reds }).filter(x => !(goal.overridden && x.apply));
  return { p, day, t: tg, goal, own, list, ph, expected, raceLoad };
}
// Short line for the coach: today's targets and anything that clashes.
function nutritionContext() {
  const x = nutriToday();
  if (!x) return 'NUTRITION: not set up yet.';
  return `NUTRITION TODAY (computed by the app; use these numbers): ${x.day.label}, goal ${x.t.type}${x.goal.overridden ? ' (paused deficit)' : ''}. About ${x.t.kcal} kcal, protein ${x.t.protein} g, carbs ${x.t.carbs} g (${x.t.carbsPerKg} g/kg), fat ${x.t.fat} g.${x.raceLoad ? ' Carb-loading for the race.' : ''}${x.list.length ? ` Notes: ${x.list.map(c => c.title).join('; ')}.` : ''}`;
}
const LIFE = [['sit', 'Mostly sitting (desk job, study)'], ['feet', 'On my feet a lot (teaching, retail, walking)'], ['physical', 'Physical work']];
const GOALS_N = [['perform', '⚡ Fuel my training and races'], ['maintain', '⚖️ Stay at my weight'], ['cut', '🔥 Lose fat'], ['gain', '💪 Build muscle']];
function viewNutrition() {
  const n = S.nutrition;
  if (!n?.setup) return `<section class="card nutri-hero"><p class="eyebrow">🍽️ Nutrition</p><h2>Eat for your training</h2>
      <p>Daily targets that follow your plan: more carbs on long and hard days, steady protein, fuelling for long sessions and races, and a heads-up when your goal and your training clash.</p>
      <p class="hint">A one-minute setup. It's separate from the questionnaire and you can change it any time.</p>
      <button class="btn primary" data-act="nutri-setup">Set up my nutrition</button></section>`;
  const x = nutriToday();
  if (!x) return `<section class="card"><p>Add your height and weight to see your targets.</p><button class="btn primary" data-act="nutri-setup">Complete setup</button></section>`;
  const { t, day, list, own, goal } = x, teen = AGE.isTeen(S), hide = n.hideNumbers || teen, pt = NU.portions(t);
  const nums = hide
    ? `<p class="q">Per meal <span class="hint">(${pt.meals} meals a day)</span></p><div class="nutri-grid"><div><b>🥩 ${pt.protein}</b><span>palm${pt.protein > 1 ? 's' : ''} of protein</span></div><div><b>🍚 ${pt.carbs}</b><span>cupped hand${pt.carbs > 1 ? 's' : ''} of carbs</span></div><div><b>🥑 ${pt.fat}</b><span>thumb${pt.fat > 1 ? 's' : ''} of fats</span></div></div><p class="hint">Hands make good portion guides: palm = meat, fish, eggs; cupped hand = rice, pasta, bread, fruit; thumb = oil, nuts, butter.${day.load === 'hard' || day.load === 'very' ? ' Big day: add a carb snack or a sports drink around your session.' : ''}</p>`
    : `<p class="nutri-kcal"><b>${t.kcal.toLocaleString()}</b> kcal <span class="hint">(likely ${t.range[0].toLocaleString()}–${t.range[1].toLocaleString()})</span></p>
       <div class="nutri-grid"><div><b>${t.protein} g</b><span>protein · ${t.proteinDoses} × ~${t.doseG} g</span></div><div><b>${t.carbs} g</b><span>carbs · ${t.carbsPerKg} g/kg</span></div><div><b>${t.fat} g</b><span>fat</span></div></div>`;
  const why = `${day.label}${day.sessions.length ? `: ${day.sessions.map(se => h(se.title)).join(' + ')}` : ''}${x.raceLoad ? ' · <strong>carb-loading for your race</strong>' : ''}`;
  const goalLine = goal.overridden ? `<p class="nutri-paused">⏸️ Your ${GOALS_N.find(g => g[0] === own.type)?.[1].replace(/^\S+\s/, '').toLowerCase()} goal is paused until ${new Date(`${goal.overridden.until}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}. <button class="linkish" data-act="nutri-undo">Resume it now</button></p>` : '';
  const bubble = c => `<details class="nutri-check ${c.level}"><summary><span>${c.level === 'danger' ? '⛔' : c.level === 'warn' ? '⚠️' : '💡'} <strong>${h(c.title)}</strong></span><span class="hint">ⓘ why</span></summary>
      <p>${h(c.why)}</p>${c.apply ? `<div class="row wrap"><button class="btn small primary" data-act="nutri-apply" data-mode="${c.apply.mode}" data-today="${c.apply.today ? 1 : ''}">${h(c.apply.label)}</button><span class="hint">or keep your goal: your choice.</span></div>` : ''}</details>`;
  const long = day.longest >= 60 ? NU.sessionFuel(day.longest, x.p.kg, false) : null;
  const longDone = long && day.sessions.filter(se => se.minutes === day.longest).every(se => se.done);
  const fuel = long ? `<section class="card"><h3>🔋 ${longDone ? 'Recover from today\'s session' : 'Fuel today\'s session'} <span class="hint">(${day.longest} min)</span></h3><ul class="fuel">
      ${longDone ? '' : `<li><b>Before</b> ${h(long.before)}</li><li><b>During</b> ${h(long.during.text)}</li>`}<li><b>Fluids</b> ${longDone ? 'Drink to thirst over the next hours; a salty meal helps if you sweated a lot.' : h(long.fluids)}</li><li><b>After</b> ${h(long.after)}</li></ul></section>` : '';
  const ph = x.ph, rf = S.target && ph && ph.d >= 0 && ph.d <= 14 ? NU.raceFuel(x.expected, x.p.kg) : null;
  const race = rf ? `<section class="card race-fuel"><h3>🏁 Race fuelling · ${h(S.target.name)} <span class="hint">${ph.d === 0 ? 'today!' : ph.d === 1 ? 'tomorrow' : `in ${ph.d} days`}</span></h3><ul class="fuel">
      <li><b>2 days before</b> ${h(rf.load)}</li><li><b>Race morning</b> ${h(rf.breakfast)}</li><li><b>During</b> ${h(rf.during)}</li>${rf.rules.map(r => `<li>✅ ${h(r)}</li>`).join('')}</ul></section>` : '';
  // This week's carb level per day.
  const p = x.p, R = NU.rmr(p).kcal, wk = K.buildWeek(S, now());
  const week = `<section class="card"><h3>📅 Carbs this week</h3><div class="carb-week">${wk.days.map((d, i) => { const L = NU.dayLoad([...d.items.filter(it => !it.sick), ...otherItems(S.otherTraining, i)], p, R).load; const lvl = { rest: 1, light: 1, moderate: 2, hard: 3, very: 3 }[L];
      return `<div class="${i === wk.today ? 'today' : ''}"><span>${K.DAY_NAMES[i].slice(0, 3)}</span><i class="lv${lvl}"></i><em>${['', 'low', 'medium', 'high'][lvl]}</em></div>`; }).join('')}</div><p class="hint">Eat more carbs on long and hard days, fewer on rest days: "fuel for the work".</p></section>`;
  // Goal progress from weigh-ins.
  const rate = NU.weeklyRate(own, p), gc = NU.goalCheck(p, own, now());
  const progress = `<section class="card"><h3>🎯 Your goal</h3><p>${GOALS_N.find(g => g[0] === own.type)?.[1] || ''}${rate ? ` · about ${rate}% of bodyweight a week (≈ ${(p.kg * rate / 100).toFixed(2)} kg)` : ''}${own.weight ? ` · goal ${own.weight} kg${own.date ? ` by ${new Date(`${own.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}` : ''}</p>
      ${gc && gc.ok ? '<p class="hint">✅ That goal date is realistic at a safe pace.</p>' : ''}<p class="hint">${bodyTrend().replace('<br>', '') || 'Weigh in once a week, same time and conditions. If your trend is off the expected pace for 3 weeks or more, adjust by about 100-150 kcal a day: the formula is a starting point, your scale is the truth.'}</p>
      <div class="row wrap"><button class="btn small" data-act="nutri-weigh">⚖️ Log weight</button><button class="btn ghost small" data-act="nutri-setup">Edit my nutrition</button></div></section>`;
  const due = !n.reds || now() - n.reds.ts > 30 * E.DAY;
  const reds = `<section class="card"><h3>🩺 Monthly check-in</h3><p class="hint">Four quick questions that catch under-fuelling early (REDs). ${due ? 'Due now.' : `Last done ${new Date(n.reds.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`}</p><button class="btn small ${due ? 'primary' : 'ghost'}" data-act="nutri-reds">${due ? 'Do it now' : 'Do it again'}</button></section>`;
  return `<section class="card nutri-today"><p class="eyebrow">🍽️ Today · ${why}</p>${nums}
      ${goalLine}${t.raised && !hide ? '<p class="hint">Calories nudged up so fat stays at a healthy minimum.</p>' : ''}
      ${day.sessions.filter(se => se.met).length ? `<p class="hint">Counted: ${day.sessions.filter(se => se.met).map(se => h(se.title)).join(', ')}. Log other activities on Today.</p>` : ''}
      ${teen ? '<p class="hint">🌱 Under 18 we show portions, not calories: growing bodies need fuel, not counting.</p>' : `<label class="switch-row small"><input type="checkbox" data-act="nutri-hide" ${hide ? 'checked' : ''}> <span>Show portions instead of numbers</span></label>`}</section>
    ${list.map(bubble).join('')}${race}${fuel}${week}${progress}${reds}
    <details class="card how"><summary>How are these worked out?</summary><p class="hint">Resting energy: ${h(t.method)} formula (the most accurate for athletes in a 2023 review; uses your body fat when known), about ±10%. Plus your daily life, plus today's sessions (running ≈ 1 kcal per kg per km). Carbs by the day's training load (g per kg), protein 1.6–2.2 g/kg (more in a deficit), fat at least 20% of energy. A goal never pushes you below the energy your body needs to stay healthy (energy availability, IOC 2023). Estimates: trust your weigh-in trend over the formula. Not medical advice.</p></details>`;
}

// ---------- stats ----------
// The athlete's own numbers, in the units the norm tables use.
function myValues() {
  const a = S.answers || {}, b = S.bests || {};
  const toKg = a.liftUnit === 'lb' ? 0.4536 : 1, bwKg = +a.bodyweight * toKg;
  const anyKg = bwKg > 30 ? bwKg : nutriProfile().kg || 0; // FTP in W/kg also works from the Nutrition / weigh-in weight
  const oneRm = v => (+v > 0 && bwKg > 30 ? (+v * toKg * (a.liftMode === '1' ? 1 : 1 / 0.86)) / bwKg : null); // 5 reps ~ 86% of a 1-rep max
  const div = b.hyroxDiv === 'pro' ? 'hyrox_pro' : 'hyrox_open';
  return {
    run5k: b.run5k || a.best5k || null, run10k: b.run10k || a.best10k || null, half: b.half || null, marathon: b.marathon || null,
    squat: oneRm(a.squat5), deadlift: oneRm(a.deadlift5), pullups: a.pullups !== '' && a.pullups != null ? +a.pullups || null : null,
    [div]: b.hyrox || null, ftp: b.ftp && anyKg > 30 ? b.ftp / anyKg : null, bwKg,
  };
}
const fmtStat = (fmt, v) => (fmt === 'time' ? formatTime(v) : fmt === 'ratio' ? `${v.toFixed(2)}× bodyweight` : fmt === 'wkg' ? `${v.toFixed(2)} W/kg` : `${Math.round(v)}`);
const gapText = (st, bwKg = myValues().bwKg) => {
  if (st.target == null) return '';
  const d = st.target - st.value;
  const what = st.fmt === 'time' ? `${formatTime(Math.abs(d))} faster` : st.fmt === 'ratio' ? `+${Math.ceil(Math.abs(d) * bwKg / 2.5) * 2.5} kg on your 1-rep max` : st.fmt === 'wkg' ? `+${Math.abs(d).toFixed(2)} W/kg` : `+${Math.ceil(Math.abs(d))} rep${Math.ceil(Math.abs(d)) > 1 ? 's' : ''}`;
  return `${what} and you pass ${st.nextP === 50 ? 'half' : `${st.nextP}%`} of ${st.group}.`;
};

// ---------- compare with Stride Quest athletes (opt-in, anonymous) ----------
const SHARE_KEY = 'stride-quest:share';
const shareState = () => { try { return JSON.parse(localStorage.getItem(SHARE_KEY)) || {}; } catch { return {}; } };
const setShare = v => { try { localStorage.setItem(SHARE_KEY, JSON.stringify(v)); } catch { /* ignore */ } };
// The numbers sent: only the comparable values, in the same units as the tables.
function sharePayload() {
  const v = myValues(), sex = S.profile.sex;
  const values = Object.fromEntries(['run5k', 'run10k', 'half', 'marathon', 'hyrox_open', 'hyrox_pro', 'squat', 'deadlift', 'ftp', 'pullups']
    .filter(k => v[k] > 0).map(k => [k, Math.round(v[k] * 1000) / 1000]));
  const rare = STATS.hybridRarity(Object.keys(NORMS).map(k => STATS.statFor(k, v[k], sex, S.profile.ageGroup, { bwKg: v.bwKg })).filter(Boolean));
  return { sex, age: S.profile.ageGroup || null, values, pair: rare ? rare.basis.map(b => b.metric) : null };
}
async function fetchCommunity(force) {
  const sh = shareState();
  if (!sh.on || !WORKER_URL || !['m', 'f'].includes(S.profile.sex)) return;
  const body = sharePayload(), key = JSON.stringify(body);
  if (!force && ui.community?.key === key) return;
  ui.community = { key, loading: true };
  try {
    const r = await fetch(`${WORKER_URL.replace(/\/$/, '')}/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sh.id, ...body }) });
    const d = await r.json();
    ui.community = r.ok ? { key, data: d } : { key, error: d.error || 'Could not compare right now.' };
  } catch { ui.community = { key, error: 'Offline: comparisons with app athletes need a connection.' }; }
  if (ui.tab === 'stats') render();
}
function communityLine(metric) {
  const d = ui.community?.data?.metrics?.[metric];
  if (!shareState().on || !d) return '';
  const sexW = S.profile.sex === 'm' ? 'men' : 'women', age = S.profile.ageGroup, min = ui.community.data.min;
  const one = (g, who) => (g.p != null ? `better than <b>${g.p}%</b> of ${g.n} ${who}` : `${who}: ${g.n} of ${min} so far`);
  if (d.sex.p == null && d.age?.p == null) return '';
  return `<p class="community">👥 Stride Quest athletes: ${one(d.sex, sexW)}${d.age ? ` · ${one(d.age, `${sexW} aged ${h(age)}`)}` : ''}</p>`;
}
function communityBoth() {
  const b = ui.community?.data?.both;
  if (!shareState().on || !b) return '';
  return `<p class="community">👥 ${b.share != null ? `Of ${b.n} Stride Quest athletes with both numbers, only <b>${Math.max(1, Math.round(b.share * 100))}%</b> are at least as good at both.` : `Real rarity among app athletes appears once ${ui.community.data.min} have both numbers (${b.n} so far).`}</p>`;
}
function communityCard() {
  const sh = shareState();
  if (!WORKER_URL) return '';
  const c = ui.community;
  return `<section class="card"><h3>👥 Compare with Stride Quest athletes</h3>
      <p class="hint">Optional and anonymous. If you switch it on, only your comparable numbers (times, lifts ÷ bodyweight, FTP W/kg), sex and age group are stored, under a random ID. No name, email or location. Each group shows a percentage once it has ${c?.data?.min || 50} athletes. Switch it off any time and your numbers are deleted.</p>
      <label class="switch-row"><input type="checkbox" data-act="share-toggle" ${sh.on ? 'checked' : ''}> <span>${sh.on ? 'On: comparing with app athletes' : 'Off'}</span></label>
      ${sh.on && c?.data ? (() => { const ms = Object.values(c.data.metrics || {}); const n = Math.max(0, ...ms.map(m => m.sex.n)), na = Math.max(0, ...ms.map(m => m.age?.n || 0));
        return ms.length && ms.every(m => m.sex.p == null) ? `<p class="hint">👥 Still filling up: ${n + 1} ${S.profile.sex === 'm' ? 'men' : 'women'} with your numbers so far${S.profile.ageGroup ? `, ${na + 1} aged ${h(S.profile.ageGroup)}` : ''} (you included). Percentages appear at ${c.data.min + 1}.</p>` : ''; })() : ''}
      ${sh.on && c?.loading ? '<p class="hint">Comparing…</p>' : sh.on && c?.error ? `<p class="hint warn-text">${h(c.error)}</p>` : ''}
      ${sh.on && !['m', 'f'].includes(S.profile.sex) ? '<p class="hint">Pick men or women under <b>change</b> first.</p>' : ''}
    </section>`;
}

function viewStats() {
  setTimeout(() => fetchCommunity(false), 0);
  const pend = shareState();
  if (pend.pendingDelete && !pend.on && WORKER_URL) {
    fetch(`${WORKER_URL.replace(/\/$/, '')}/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pend.id, delete: true }) })
      .then(r => { if (r.ok) setShare({ on: false, id: pend.id }); }).catch(() => {});
  }
  const sex = S.profile.sex, age = S.profile.ageGroup || null;
  const vals = myValues();
  const stats = Object.keys(NORMS).map(k => STATS.statFor(k, vals[k], sex, age, { bwKg: vals.bwKg })).filter(Boolean);
  const shown = stats.filter(x => x.show).sort((x, y) => y.p - x.p || (x.median ? 1 : -1));
  const best = shown[0];
  const rare = STATS.hybridRarity(stats);
  const act = STATS.activityLine(S, now());
  const card = st => `<div class="stat ${st.show ? '' : 'climb'}">
      <div class="stat-top"><strong>${h(st.label)}</strong><span>${h(fmtStat(st.fmt, st.value))}</span></div>
      ${st.show && st.median ? `<p>Faster than <b>half</b> of ${h(st.group)}.</p>`
        : st.show ? `<div class="stat-bar"><i style="width:${st.p}%"></i></div><p>Better than <b>${st.p}%</b> of ${h(st.group)}.${st.nextP ? ` <span class="hint">${h(gapText(st))}</span>` : ''}</p>`
        : `<p>🎯 ${h(gapText(st))}</p>`}
      ${communityLine(st.metric)}
    </div>`;
  const history = S.history.filter(x => x.kind === 'session');
  const runLevels = history.filter(x => x.track === 'run' && x.level).map(x => x.level);
  const startLevel = Math.min(S.run.level, ...(runLevels.length ? runLevels : [S.run.level]));
  const since = S.placedAt ? new Date(S.placedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const cleared = Object.keys(S.run.stars).length;
  const sources = [...new Map([...stats.map(x => x.source), act?.source].filter(Boolean).map(x => [x.url, x])).values()].filter(x => x?.url);
  return `
    <section class="card stats-hero">
      <p class="eyebrow">📊 Your stats</p>
      ${best ? `<h2>${best.median ? 'Faster than half' : `Better than ${best.p}%`} of ${h(best.group)}</h2><p class="hint">${h(best.label)}: ${h(fmtStat(best.fmt, best.value))}. Your strongest number right now.</p>`
        : act ? `<h2>${h(act.text)}</h2>` : '<h2>Every stat starts with the first session 💪</h2><p class="hint">Log a session or add your bests to see how you compare.</p>'}
      ${sex !== 'm' && sex !== 'f' ? '<p class="banner info">The published data is split into men and women only. Pick one under <b>change</b> to see your comparisons (it only affects Stats and race standards).</p>' : ''}
      <p class="hint">Compared with: ${sex === 'm' ? 'men' : sex === 'f' ? 'women' : 'no group yet'}${age ? `, aged ${h(age)}` : ''} · <button class="linkish" data-act="edit-bests">change</button></p>
    </section>
    ${act && best ? `<section class="card"><p>💙 ${h(act.text)}</p></section>` : ''}
    ${rare ? `<section class="card rare"><h3>🧬 Hybrid rarity</h3><p class="big">At least <b>1 in ${rare.oneIn}</b> ${sex === 'm' ? 'men' : 'women'}</p>
      <p class="hint">${rare.basis.map(b => `${h(b.label)}: better than ${b.p}% of ${h(b.group)}`).join('; and ')}, both at once. The combination is what makes you rare.
      <br>Estimate, and a cautious one: each comparison group (race finishers, competitive powerlifters, power-meter riders) is already fitter than most people, so against all adults you are rarer still. It also assumes people good at one tend to be fairly good at the other (correlation ${RHO.value}).</p>
      ${communityBoth()}</section>` : ''}
    <section class="card"><h3>Your numbers</h3>
      ${stats.length ? `<div class="stat-list">${[...shown, ...stats.filter(x => !x.show)].map(card).join('')}</div>` : '<p class="hint">No numbers yet.</p>'}
      <button class="btn" data-act="edit-bests">Add or update my bests</button>
    </section>
    ${communityCard()}
    <section class="card"><h3>📈 You vs past you</h3>
      <div class="stats"><div><strong>${history.length}</strong><span>Sessions</span></div><div><strong>${S.xp}</strong><span>XP</span></div><div><strong>${cleared}</strong><span>Levels cleared</span></div></div>
      <p class="hint">${since ? `Since ${h(since)}: ` : ''}Run Level ${startLevel} → ${S.run.level}${HYB.hasHybrid(S) ? ` · Strength: ${h(HYB.strengthStage(S).name)}` : ''}.${bodyTrend().replace('<br>', ' ')}</p>
    </section>
    <details class="card how"><summary>How is this calculated?</summary>
      <p class="hint">Your numbers are compared with published results (and, if you switch it on, with other Stride Quest athletes), never by the AI. For each one we use the closest group the source has (your sex and age group when available). Below the middle of a group we show your next milestone instead of a percentage. Lifts are compared as an estimated 1-rep max (5 reps ≈ 86% of a 1-rep max).</p>
      <ul class="sources">${sources.map(x => `<li><a href="${h(x.url)}" target="_blank" rel="noopener">${h(x.name)}</a>${x.note ? ` · ${h(x.note)}` : ''}</li>`).join('')}${RHO.source ? `<li>Rarity correlation: <a href="${h(RHO.url || '#')}" target="_blank" rel="noopener">${h(RHO.source)}</a></li>` : ''}</ul>
    </details>`;
}

function viewMe() {
  const hist = S.history.filter(x => x.kind === 'session' || x.kind === 'event' || x.kind === 'bonus' || x.kind === 'challenge').slice(-15).reverse();
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
    ${HYB.hasHybrid(S) ? numbersCard() : ''}
    <section class="card"><h3>🏅 Sporting background</h3>
      <p class="hint">${S.background?.length ? h(BG.describe(S.background).join(' · ')) : 'Trained seriously in a sport before? Add it: former athletes get their technique credited and a comeback fast-track.'}</p>
      <button class="btn" data-act="edit-bg">${S.background?.length ? 'Edit' : 'Add my background'}</button>
    </section>
    <section class="card"><h3>Race category</h3>
      <div class="seg">${[['m', "Men's"], ['f', "Women's"], ['x', 'Prefer not']].map(([k, l]) => `<button class="${(S.profile.sex || '') === k ? 'on' : ''}" data-act="set-sex" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="hint">${S.profile.sex ? 'Times, lift targets and race standards use this category.' : '⚠️ Not set yet: standards use men\'s numbers until you pick.'}</p>
    </section>
    ${HYB.hasHybrid(S) ? `<section class="card"><h3>🏋️ Lifting shout</h3>
      <p class="hint">Your lifter plays this when it reaches a new stage. Without a clip, the device's voice says "Light weight, baby!". Record yourself (or a friend), or upload a clip. Up to 3 seconds, stays on this device.</p>
      <div class="row wrap"><button class="btn" data-act="shout-rec">${ui.recording ? '⏺ Recording…' : '🎤 Record (3 s)'}</button>
        <label class="btn">⬆️ Upload<input type="file" accept="audio/*" data-act="shout-file" hidden></label>
        <button class="btn" data-act="shout-play">▶ Play</button>${sfx.hasShout() ? '<button class="btn ghost" data-act="shout-clear">Remove my clip</button>' : ''}</div></section>` : ''}
    <section class="card"><h3>Theme</h3>
      <div class="seg">${[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['auto', '🖥️ Auto']].map(([k, l]) => `<button class="${theme() === k ? 'on' : ''}" data-act="set-theme" data-t="${k}">${l}</button>`).join('')}</div>
      <p class="hint">Auto follows your device's light/dark setting.</p>
    </section>
    <section class="card"><h3>Training</h3>
      <p>${(S.profile.tracks || ['run']).map(k => ({ run: '🏃 Running', hybrid: '🏃🏋️ Hybrid', tri: '🏊🚴🏃 Triathlon' })[k] + (k === (S.profile.primary || 'run') && (S.profile.tracks || []).length > 1 ? ' (leads your week)' : '')).join(' · ')}</p>
      <p class="hint">Days: ${K.schedule(S).days.map(d => K.DAY_NAMES[d]).join(', ')} · long session ${K.DAY_NAMES[K.schedule(S).longDay]}</p>
      <div class="row wrap"><button class="btn" data-act="edit-days">Change training days</button>${['hybrid', 'tri'].filter(k => !(S.profile.tracks || []).includes(k)).map(k => `<button class="btn" data-act="add-track" data-k="${k}">＋ ${k === 'hybrid' ? 'Hybrid' : 'Triathlon'} track</button>`).join('')}</div>
    </section>
    <section class="card"><h3>Body</h3>
      <div class="row wrap">
        <button class="btn" data-act="report-pain">🩹 Report pain or injury</button>
        ${S.rebuild.redFlag ? '<button class="btn" data-act="cleared">I\'ve been cleared by a professional</button>' : ''}
      </div></section>
    <section class="card"><h3>Recent activity</h3>${hist.length ? `<ul class="history">${hist.map(x =>
      `<li><span>${new Date(x.ts).toLocaleDateString()}</span>${h(x.title)}${x.pain != null ? ` <em>pain ${x.pain}/10</em>` : ''}<b>${x.xp ? `+${x.xp}` : ''}</b></li>`).join('')}</ul>` : '<p class="hint">Nothing yet. Your first step is on the Today tab.</p>'}</section>
    ${installCard('me')}
    ${WORKER_URL ? stravaCard() : ''}
    ${splitCard()}
    <section class="card"><h3>🏋️ My other training</h3>${(S.otherTraining || []).length ? `<ul class="ot-list">${S.otherTraining.map(o => `<li>${h(otherLine(o))}</li>`).join('')}</ul>` : '<p class="hint">Gym, football, padel…? Add it so your plan keeps hard runs off heavy-leg days and your nutrition counts it.</p>'}
      <button class="btn small" data-act="other-edit">${(S.otherTraining || []).length ? 'Edit' : 'Add other training'}</button></section>
    <section class="card"><h3>❓ Help</h3><p class="hint">How everything in the app works, with "Show me" buttons. Also under ❓ Help at the top of every screen.</p><button class="btn" data-act="help">Open Help</button></section>
    <section class="card"><h3>Your data</h3>
      <p class="hint">Progress is saved in this browser only. Export it to move to another device.</p>
      <label class="switch-row"><input type="checkbox" data-act="counts-toggle" ${countsOn() ? 'checked' : ''}> <span>Send anonymous counts</span></label>
      <p class="hint">Simple tallies with no ID and no personal data, like "one more athlete is preparing for Alpha X". They show race organisers how many people train for their race, which helps support the app.</p>
      <div class="row wrap">
        <button class="btn" data-act="export">Export progress</button>
        <label class="btn">Import<input type="file" accept="application/json" data-act="import" hidden></label>
        <button class="btn" data-act="retake">Retake assessment</button>
        <button class="btn" data-act="sound">${sfx.soundOn() ? '🔊 Sound on' : '🔇 Sound off'}</button>
        <button class="btn danger" data-act="reset">Reset everything</button>
      </div></section>
    <p class="byline credit">Developed by <button type="button" class="linkish" data-act="about-me">Abdullah Salama</button></p>`;
}

// ---------- modals ----------
function renderModal() {
  const root = $('#modal');
  const m = ui.modal;
  if (!m) { root.innerHTML = ''; root.hidden = true; if (ui.tour || ui.helpReturn) tourBar(); return; }
  root.hidden = false;
  root.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${MODALS[m.type](m)}</div>`;
  document.querySelector('.tour-bar')?.remove(); // the tour waits while a pop-up is open
}

const t0 = () => now();
const dayInput = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function actualHint(st) {
  const t = st.title || '';
  if (/\d+ x /.test(t)) return 'e.g. 6 of 8 reps, 4:40/km, last two slower';
  if (/ride|bike/i.test(t)) return 'e.g. 52 km in 2:05, avg 25 km/h';
  if (/swim/i.test(t)) return 'e.g. 1200 m, rests every 200 m';
  if (/squat|deadlift|press|lift/i.test(t)) return 'e.g. squat 100 kg 5x5, last set hard';
  return 'e.g. 35 min instead of 45, walked twice';
}

function painSlider(label = 'Pain during the session (0 = none, 10 = worst)') {
  return `<label class="field pain"><span>${h(label)}</span>
    <input type="range" name="pain" min="0" max="10" value="0" data-act="pain-range">
    <span class="pain-scale"><b id="pain-val">0</b>/10 · <em id="pain-hint">counts as normal</em></span></label>`;
}

// One tap logs the session with a pain rating (simple view).
function painButtons() {
  return `<p class="q">Done? How did your body feel?</p><div class="pain-buttons">
    ${[[0, '😀', 'Great, no pain'], [2, '🙂', 'A little sore'], [4, '😐', 'Uncomfortable'], [6, '😣', 'It hurts']].map(([v, e, l]) =>
      `<button type="submit" class="pain-btn" name="painTap" value="${v}"><span>${e}</span>${l}</button>`).join('')}</div>`;
}

const MODALS = {
  splitPick() {
    const td = K.schedule(S).days.length, cur = S.hybrid?.split || {}, stage = S.hybrid?.strength?.stage ?? 3;
    const days = [['auto', `Auto (${SPL.strengthDays({ hybrid: {} }, td)} with your ${td} training days)`], ...[1, 2, 3, 4, 5, 6].filter(d => d < td || d === 1).map(d => [String(d), `${d} a week`])];
    return `<form id="split-form"><h2>🏋️ Strength split</h2><p class="why">💡 How your lifting is grouped. More strength days means fewer runs and engine sessions in your week.</p>
      <p class="q">Strength days</p>${radio('spDays', days, cur.days ? String(cur.days) : 'auto')}
      <p class="q">Split</p>${radio('spId', [['auto', '⭐ Recommended for my days'], ...Object.entries(SPL.SPLITS).map(([k, v]) => [k, v.label])], cur.id || 'auto')}
      <p class="hint">${stage < 2 ? 'You\'re on the bodyweight / dumbbell stages: those stay full body. Your split starts at Barbell Basics.' : 'Changing the split starts this stage\'s sessions fresh (your stage stays).'} In race prep, taper and race week the app switches to full-body maintenance by itself.</p>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
  },
  stravaRequest() {
    return `<form id="strava-req-form"><h2>🔗 Request Strava access</h2><p class="why">💡 The app owner, Abdullah Salama, gets your request and approves it. Then you connect your own Strava account: only you see your activities.</p>
      <label class="field"><span>Your name</span><input type="text" name="rName" maxlength="60" value="${h(S.profile.name || '')}" placeholder="So Abdullah knows who you are"></label>
      <label class="field"><span>Message <em class="hint">optional</em></span><input type="text" name="rMsg" maxlength="300" placeholder="e.g. Hi, it's Ahmed from the running group"></label>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Send request</button></div></form>`;
  },
  stravaOwn() {
    return `<form id="strava-own-form"><h2>🔗 Use your own Strava app</h2><p class="why">💡 For people with a paid Strava subscription: connect through your own Strava API app instead of the shared one, no waiting.</p>
      <ol class="hint own-steps"><li>Go to <strong>strava.com/settings/api</strong> and create an app.</li><li>Set <strong>Authorization Callback Domain</strong> to <code>stride-quest-coach.stridequest.workers.dev</code>.</li><li>Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> below.</li></ol>
      <label class="field"><span>Client ID</span><input type="text" name="oCid" inputmode="numeric" autocomplete="off"></label>
      <label class="field"><span>Client Secret</span><input type="password" name="oSecret" autocomplete="off"></label>
      <p class="hint">🔒 Your secret stays on this phone. It's sent over an encrypted connection only to connect and to sync, and is never stored on our server (it's deleted right after connecting).</p>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Connect</button></div></form>`;
  },
  otherTraining(m) {
    return `<form id="other-form"><h2>🏋️ My other training</h2><p class="why">💡 Training outside Stride Quest. Your plan keeps hard runs off heavy-leg days (and the day after), and Nutrition counts it.</p>
      ${otherBlock(m.a)}<div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
  },
  extraSession() {
    return `<form id="extra-form"><h2>➕ Log another activity</h2><p class="why">💡 Training that isn't in your Stride Quest plan: gym, football, padel… It shows in your week, counts toward your training load, and Nutrition includes it.</p>
      <label class="field"><span>What</span>${select('xKind', OTHER.map(o => [o.k, o.label]), 'weights')}</label>
      <label class="field"><span>Minutes</span><span class="with-unit"><input type="number" inputmode="numeric" name="xMin" value="60" min="5" max="400"><em>min</em></span></label>
      <p class="q">How hard?</p>${radio('xEffort', EFFORT, 'moderate')}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Add</button></div></form>`;
  },
  nutriSetup() {
    const n = S.nutrition || {}, p = nutriProfile(), g = n.goal || {};
    const num = (name, label, v, unit, step = '1') => `<label class="field"><span>${label}</span><span class="with-unit"><input type="number" inputmode="decimal" name="${name}" value="${v ?? ''}" step="${step}" min="0">${unit ? `<em>${unit}</em>` : ''}</span></label>`;
    return `<form id="nutri-form"><h2>🍽️ Your nutrition</h2><p class="why">💡 About a minute. Your training, races and recovery are already known: this is just you and your goal.</p>
      <p class="q">Your goal</p>${radio('nGoal', GOALS_N, g.type || 'perform')}
      <div class="nutri-pace" ${['cut', 'gain'].includes(g.type) ? '' : 'hidden'}><p class="q">Pace</p>${radio('nPace', [['slow', 'Slowly (keeps the most muscle and performance)'], ['steady', 'Steadily']], g.pace || 'slow')}
        <div class="row wrap">${num('nGoalKg', 'Goal weight (optional)', g.weight, 'kg', '0.1')}<label class="field"><span>By (optional)</span><input type="date" name="nGoalDate" value="${g.date || ''}"></label></div></div>
      <div class="row wrap">${num('nHeight', 'Height', n.heightCm, 'cm')}${num('nAge', 'Age', n.age, 'years')}${num('nKg', 'Weight', p.kg ? Math.round(p.kg * 10) / 10 : '', 'kg', '0.1')}</div>
      <p class="q">Outside training, your day is…</p>${radio('nLife', LIFE, n.life || 'sit')}
      ${num('nBf', 'Body fat % (optional, makes it more accurate)', p.bodyFat || '', '%', '0.1')}
      <p class="hint">Calories follow your training each day. Nothing here changes your plan.</p>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
  },
  nutriWeigh() {
    const p = nutriProfile();
    return `<form id="weigh-form"><h2>⚖️ Log weight</h2><p class="why">💡 Same time of day, same conditions (e.g. morning, after the toilet). The weekly trend matters, not single days.</p>
      <label class="field"><span>Weight</span><span class="with-unit"><input type="number" inputmode="decimal" name="wKg" value="${p.kg ? Math.round(p.kg * 10) / 10 : ''}" step="0.1" min="20"><em>kg</em></span></label>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
  },
  nutriReds() {
    const qs = [['fatigue', 'Tired most days, even after rest days'], ['injury', 'A stress fracture or repeated bone/tendon injuries this year'],
      ...(S.profile.sex === 'm' ? [['libido', 'Much lower sex drive or fewer morning erections than usual']] : [['periods', 'Missed or irregular periods (not on hormonal contraception)']]),
      ['ill', 'Getting ill more often than usual']];
    return `<form id="reds-form"><h2>🩺 Monthly check-in</h2><p class="why">💡 Tick anything that's true for you lately. These can be signs of eating too little for your training. Private: stays on your phone.</p>
      ${qs.map(([k, l]) => `<label class="choice"><input type="checkbox" name="r_${k}"><span>${h(l)}</span></label>`).join('')}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Done</button></div></form>`;
  },
  target(m) {
    const e = raceFrom(m.uid);
    if (!e) return '<p>That race is no longer in the calendar.</p><div class="row end"><button class="btn ghost" data-act="close">Close</button></div>';
    const was = S.target?.uid === e.uid ? S.target : {};
    const race = { ...e, distance: m.distance || was.distance || e.distance, goal: m.goal || was.goal || 'finish', goalTime: m.goalTime ?? was.goalTime ?? null };
    const v = TG.verdict(S, race, now(), ui.events || []), isRun = !!TG.NEEDS[race.distance], mine = S.target?.uid === e.uid;
    const distPick = !race.distance || isRun ? `<label class="field"><span>Distance you'd run</span>${select('tDist', [['', 'Pick one'], ...Object.entries(TG.NEEDS).map(([k, n]) => [k, n.label[0].toUpperCase() + n.label.slice(1)])], race.distance || '')}</label>` : '';
    return `<form id="target-form" onsubmit="return false"><p class="eyebrow">🎯 Prepare for a race</p><h2>${h(e.name)}</h2>
      <p class="hint">${dateLong(e.date)} · in ${TG.daysUntil(e.date, now())} days${e.location ? ` · ${h(e.location.split(/,| — | - /)[0])}` : ''}</p>
      ${distPick}
      ${isRun ? `<p class="q">Your goal</p>${radio('tGoal', [['finish', 'Finish it, feeling good'], ['time', 'Race it for a time']], race.goal)}` : ''}
      ${isRun && race.goal === 'time' ? (() => {
        const mode = m.timeMode || 'time', km = TG.NEEDS[race.distance].km;
        const shown = race.goalTime ? formatTime(mode === 'pace' ? race.goalTime / km : race.goalTime) : '';
        const eg = mode === 'pace' ? ({ '5k': '5:30', '10k': '5:30', half: '5:40', marathon: '6:00' })[race.distance] : ({ '5k': '27:00', '10k': '55:00', half: '1:59:00', marathon: '4:15:00' })[race.distance];
        return `${timeField('tTime', mode === 'pace' ? 'Goal pace (per km)' : 'Goal finish time', shown, `e.g. ${eg}`, 'tTimeMode', mode)}
          ${race.goalTime ? `<p class="hint">= ${mode === 'pace' ? `${formatTime(race.goalTime)} finish time` : `${formatTime(race.goalTime / km)} per km`}</p>` : ''}`;
      })() : ''}
      <div class="verdict-box">${verdictHtml(v, race)}${timeHtml(v, race)}</div>
      <p class="hint">How it works: your plan stays your levels. The app counts down, and in the last 4 weeks your Today page switches to race prep, a taper and race week.</p>
      <div class="row end">${mine ? '<button type="button" class="btn ghost" data-act="target-clear">Stop preparing</button>' : ''}<button type="button" class="btn ghost" data-act="close">Close</button>
        ${!mine && race.distance ? `<button type="button" class="btn primary" data-act="target-set" data-uid="${h(e.uid)}">🎯 Make this my race</button>` : mine ? '<button type="button" class="btn primary" data-act="target-set" data-uid="' + h(e.uid) + '">Save</button>' : ''}</div></form>`;
  },
  raceResult() {
    const t = S.target;
    return `<form id="result-form"><h2>🏁 ${h(t.name)}</h2><p class="why">💡 However it went, you showed up and did it. That's the hardest part.</p>
      ${timeField('rTime', 'Your finish time', '', 'h:mm:ss, e.g. 2:05:30')}
      <label class="field"><span>How did it feel? <em class="hint">optional</em></span><input type="text" name="rNote" maxlength="200" placeholder="e.g. went out too fast, strong finish"></label>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Later</button><button class="btn primary" type="submit">Save my result</button></div></form>`;
  },
  // A logged session: when, how it went, the athlete's own words (and the exercises, if it's this level's).
  logInfo(m) {
    const x = S.history.find(e => e.ts === m.ts && (e.kind === 'session' || e.kind === 'attempt' || e.kind === 'activity'));
    if (!x) return '<p>That log is no longer here.</p><div class="row end"><button class="btn ghost" data-act="close">Close</button></div>';
    const steps = x.idx != null ? E.trackSteps(S, x.track) : [], st = steps[x.idx];
    const same = st && st.title === x.title;
    const when = new Date(x.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    const how = x.kind === 'activity' ? `✅ Other activity · ${h(x.item?.effort || '')}` : x.kind === 'attempt' ? '✗ Tried, but couldn\'t do it' : x.partial ? '◐ Partly done' : '✅ Done';
    return `<div class="step-info"><p class="eyebrow">${h(trackTitle(x.track) || '')}</p><h2>${h(x.title)}</h2>
      <p class="si-status">${how} · ${h(when)}${x.pain != null ? ` · pain ${x.pain}/10` : ''}${x.xp ? ` · +${x.xp} XP` : ''}</p>
      ${x.actual ? `<p><strong>What you did:</strong> ${h(x.actual)}</p>` : ''}${x.note ? `<p><strong>Notes:</strong> ${h(x.note)}</p>` : ''}
      ${same && st.detail ? `<p class="hint">${h(st.detail)}</p>` : ''}${same && st.ex?.length ? `<ul class="exercises">${exHtml(st)}</ul>` : ''}
      ${x.strava ? `<p><a class="strava-link" href="https://www.strava.com/activities/${encodeURIComponent(x.strava.id)}" target="_blank" rel="noopener">View on Strava ↗</a></p>` : ''}
      <div class="row end">${x.kind === 'activity' ? `<button type="button" class="btn ghost" data-act="activity-del" data-ts="${x.ts}">Remove</button>` : ''}<button type="button" class="btn ghost" data-act="close">Close</button></div></div>`;
  },
  stepInfo(m) {
    const st = E.trackSteps(S, m.track)[m.idx];
    if (!st) return '<p>This session has moved on.</p><div class="row end"><button class="btn ghost" data-act="close">Close</button></div>';
    const log = [...S.history].reverse().find(x => x.track === m.track && x.idx === m.idx && (x.kind === 'session' || x.kind === 'attempt'));
    const when = log ? new Date(log.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
    const status = st.status === 'done' ? `✅ Done${when ? ` on ${when}` : ''}${log?.partial ? ' (partly)' : ''}.${log?.actual ? ` You wrote: “${h(log.actual)}”` : ''}`
      : st.status === 'provisional' ? '⏳ Done: it counts after tomorrow morning\'s check (pain 2/10 or less).'
      : st.status === 'locked' ? `🔒 ${h(st.lockReason || 'Not open yet.')}` : '';
    return `<div class="step-info"><p class="eyebrow">${h(TYPE_LABEL[st.type] || '')}${st.boss ? ' · Boss' : ''} · ${trackTitle(m.track)}</p><h2>${h(st.title)}</h2>
      ${st.detail ? `<p>${h(st.detail)}</p>` : ''}${status ? `<p class="si-status">${status}</p>` : ''}
      ${st.ex?.length ? `<ul class="exercises">${exHtml(st)}</ul>` : ''}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Close</button></div></div>`;
  },
  prepStage(m) {
    const p = PREP_STAGES[m.n], cur = S.prep.level, done = m.n < cur || (m.n === 7 && S.prep.mastered);
    const needs = RUN_LEVELS.filter(l => l.needsPrep === m.n);
    const why = '💡 The Prep Track builds tendons, joints and landing skills, so harder running (strides, hills, intervals, long races) doesn\'t get you hurt.';
    const body = m.n === cur && !done
      ? `<p class="q">Your sessions in this stage</p><ul class="steps">${E.trackSteps(S, 'prep').map(st => stepRow('prep', st)).join('')}</ul>
         <p class="hint">They also come up in your week as "Prep Track step". Clear the last one (the gate) to move to P${m.n + 1}.</p>`
      : done ? '<p>✅ Cleared.</p>'
      : `<p>🔒 Opens after you clear P${m.n - 1}'s gate${m.n - cur > 1 ? ` (you're at P${cur}: ${m.n - cur} stages to go)` : ''}.</p>`;
    return `<div class="prep-modal"><h2>🧱 P${p.n} · ${h(p.name)}</h2><p class="hint">${h(p.focus)}</p><p class="why">${why}</p>${body}
      ${needs.length ? `<p class="hint">Needed for: ${needs.map(l => `Level ${l.n} · ${h(l.name)}`).join(', ')}.</p>` : ''}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Close</button></div></div>`;
  },
  help() { return helpPanel(); },
  aboutMe() {
    return `<div class="about-me"><h2><img class="brand-logo" src="icons/logo-96.png" alt="" width="36" height="36">Stride Quest</h2><p class="about-by">Developed by <b>Abdullah Salama</b></p>
      <p class="about-why">💙 I built Stride Quest to help people move, stay consistent and reach their goals: to become stronger, healthier and better.</p>
      <p class="about-bio">I'm a hybrid athlete who loves pushing my limits. I'm an AI Senior Manager with 13+ years in tech and 8+ in AI, an MSc from Hamburg University of Technology, and I'm now doing a PhD in AI focused on compact models. Always learning, and trying to help make the world a better place.</p>
      <a class="link-row" href="https://www.linkedin.com/in/abdullah-salama/" target="_blank" rel="noopener"><b>LinkedIn</b><span>Open ↗</span></a>
      <a class="link-row" href="https://www.instagram.com/abdu_salama/" target="_blank" rel="noopener"><b>Instagram</b><span>Open ↗</span></a>
      <a class="link-row" href="${CALENDAR_URL}" target="_blank" rel="noopener"><b>Egypt Fitness Calendar</b><span>Open ↗</span></a>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Close</button></div></div>`;
  },
  race(m) {
    const r = RACES[m.k], cur = S.hybrid?.race;
    return `<div class="race-modal race-${m.k}"><h2>${r.icon} ${m.info ? h(r.name) : `Prepare for ${h(r.name)}`}</h2>
      <p class="why">💡 ${h(r.name)} is ${h(r.share)}. Your Hybrid plan keeps real strength work on top, so you arrive strong as well as fit.</p>
      ${r.site ? `<p><a class="btn small race-site" href="${r.site}" target="_blank" rel="noopener" data-act="race-site" data-k="${m.k}">🌐 Official ${h(r.name)} website ↗</a></p>` : ''}
      ${r.divisions.map(([d, l]) => `<div class="race-div"><strong>${h(r.name)} ${h(l)}</strong><p class="hint">${h(r.format(d))}</p></div>`).join('')}
      <p class="q">Stations</p><ul class="race-stations">${r.stations.map(x => `<li>${h(x)}</li>`).join('')}</ul>
      <p class="hint">${h(r.firstTime)} Use your division's official weights (${S.profile.sex === 'f' ? "women's" : S.profile.sex === 'm' ? "men's" : "men's or women's"}).</p>

      ${m.info && cur?.event === m.k ? '' : `<p class="q">${m.info ? 'Want to prepare for it?' : 'Which division?'}</p><div class="row wrap">${r.divisions.map(([d, l]) => `<button class="btn primary" data-act="${HYB.hasHybrid(S) ? 'race-div' : 'race-start'}" data-k="${m.k}" data-div="${d}">${h(l)}</button>`).join('')}</div>`}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Close</button></div></div>`;
  },
  dream() {
    const d = S.profile.dream || {};
    return `<form id="dream-form"><h2>🎯 Your dream</h2>
      <p class="why">💡 It sits on the summit of your map and the plan works towards it. Dream big, or keep it simple: "run a 10K" is a great dream too.</p>
      <label class="field"><span>In your own words</span><textarea name="dText" rows="2" maxlength="160" placeholder="e.g. Run a sub-50 10K · Finish my first marathon · Hyrox Pro under 1:15">${h(d.text || '')}</textarea></label>
      <label class="field"><span>Event (optional)</span><input type="text" name="dEvent" value="${h(d.event || '')}" maxlength="60" placeholder="e.g. Berlin Marathon, Hyrox Dubai"></label>
      <label class="field"><span>Date (optional)</span><input type="date" name="dDate" value="${h(d.date || '')}"></label>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save my dream</button></div></form>`;
  },
  bests() {
    const b = S.bests || {}, a = S.answers || {};
    const t = (name, label, v, ph) => `<label class="field"><span>${label}</span><input type="text" name="${name}" value="${v ? formatTime(v) : ''}" placeholder="${ph}" autocomplete="off" inputmode="text"></label>`;
    return `<form id="bests-form"><h2>📊 My bests</h2>
      <p class="why">💡 Recent bests give the fairest comparison. Leave anything blank you haven't done.</p>
      <p class="q">Compare me with</p>${radio('bSex', [['m', 'Men'], ['f', 'Women'], ['x', 'Everyone']], S.profile.sex || 'x')}
      <label class="field"><span>Age group (optional)</span>${select('bAge', [['', 'Prefer not to say'], ...STATS.AGE_GROUPS], S.profile.ageGroup || '')}</label>
      ${t('b5k', '5K time', b.run5k || a.best5k, 'e.g. 24:30')}${t('b10k', '10K time', b.run10k || a.best10k, 'e.g. 52:10')}
      ${t('bHalf', 'Half marathon', b.half, 'e.g. 1:55:00')}${t('bMar', 'Marathon', b.marathon, 'e.g. 4:10:00')}
      ${t('bHyrox', 'Hyrox (solo) time', b.hyrox, 'e.g. 1:25:00')}
      <p class="q">Hyrox division</p>${radio('bHyDiv', [['open', 'Open'], ['pro', 'Pro']], b.hyroxDiv || 'open')}
      <label class="field"><span>Cycling FTP (watts)</span><span class="with-unit"><input type="number" inputmode="numeric" name="bFtp" value="${b.ftp || ''}" min="0" step="1"><em>W</em></span></label>
      <p class="hint">Lifts come from 📏 My numbers in the Me tab. Swimming and pull-ups aren't compared yet: we couldn't find reliable published data for them.</p>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
  },
  numbers() {
    const a = S.answers || {};
    const unit = a.liftUnit === 'lb' ? 'lb' : 'kg';
    const f = (name, label, v, suffix) => `<label class="field"><span>${label}</span><span class="with-unit"><input type="number" inputmode="decimal" name="${name}" value="${+v > 0 ? +v : ''}" min="0" step="0.5">${suffix ? `<em>${suffix}</em>` : ''}</span></label>`;
    return `<form id="numbers-form"><h2>📏 Update my numbers</h2>
      <p class="why">💡 Your Strength lane is re-placed with the same rules as the questionnaire. Recent, good-form numbers work best.</p>
      <p class="q">Units</p>${radio('nUnit', [['kg', 'kg'], ['lb', 'lb']], unit)}
      ${f('nBw', 'Bodyweight', a.bodyweight, '')}
      <p class="q">Your lifts are</p>${radio('nMode', [['5', 'Weight for 5 good reps'], ['1', '1-rep max']], a.liftMode === '1' ? '1' : '5')}
      ${f('nSq', 'Back squat', a.squat5, '')}${f('nDl', 'Deadlift', a.deadlift5, '')}
      <label class="field"><span>Strict pull-ups in a row</span><input type="number" inputmode="numeric" name="nPu" value="${a.pullups !== '' && a.pullups != null ? +a.pullups : ''}" min="0" step="1"></label>
      <details class="log-more" ${+a.bodyFat > 0 ? 'open' : ''}><summary>Body fat (optional)</summary>
        <p class="hint">Only for your own trend and the coach. It never changes your level or any ranking. Home scales can be off by 5+ points, so compare readings taken the same way.</p>
        ${f('nBf', 'Body fat', a.bodyFat, '%')}
        <label class="field"><span>Measured with</span>${select('nBfM', [['', 'Pick one'], ['scale', 'Smart scale / handheld'], ['calipers', 'Skinfold calipers'], ['dexa', 'DEXA scan'], ['guess', 'My best guess']], a.bodyFatMethod || '')}</label>
      </details>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Update</button></div></form>`;
  },
  painfree(m) {
    const checks = [
      ...(m.cleared ? ['A physio or doctor has cleared me to train'] : []),
      'Walking, stairs and daily life are pain-free',
      '10 single-leg hops on each leg: pain 2/10 or less',
      'No extra pain or stiffness the morning after activity',
    ];
    return `<form id="pf-form" onsubmit="return false"><h2>${m.cleared ? '🩺 Cleared to train?' : '💚 Pain-free now?'}</h2>
      <p class="why">💡 A quick safety check before the locks come off. Not medical advice: if in doubt, stay on the Rebuild Track.</p>
      ${checks.map((c, i) => `<label class="choice"><input type="checkbox" name="pf${i}"><span>${h(c)}</span></label>`).join('')}
      <p class="hint">Back to training puts you one level below your saved Run level (Level ${S.rebuild.savedRunLevel || S.run.level}), with a fast reclaim. Race gates and hard sessions unlock.</p>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Not yet</button>
        ${m.cleared ? '<button type="button" class="btn ghost" data-act="painfree-go" data-mode="gradual">Cleared, but go gradually</button>' : ''}
        <button type="button" class="btn primary" data-act="painfree-go">Back to training</button></div></form>`;
  },
  background(m) {
    return `<form id="bg-form"><h2>🏅 Sporting background</h2><p class="why">💡 Skills stay for life, fitness comes back faster. We credit your technique and open gates early while you climb back.</p>
      ${backgroundQuestions(m.a)}<div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
  },
  addHyb(m) {
    return `<form id="hyb-form"><h2>🏋️⚙️🏃 Add the Hybrid track</h2><p class="why">💡 Your running already counts: the run lane is your Run Track. These questions set the Strength and Engine lanes.</p>
      ${hybQuestions(m.a)}<div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Place me</button></div></form>`;
  },
  addTri(m) {
    return `<form id="tri-form"><h2>🏊🚴🏃 Add the Triathlon track</h2><p class="why">💡 Your running already counts: the run lane is your Run Track. These questions set the swim and bike lanes.</p>
      ${triQuestions(m.a)}<div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Place me</button></div></form>`;
  },
  move(m) {
    const w = K.buildWeek(S, now());
    const warns = m.day != null ? K.previewMove(S, m.key, m.day, now()).filter(x => x.day === m.day || x.day === m.day + 1 || x.day === m.day - 1) : [];
    return `<h2>Move session</h2><p>${h(m.title)}</p>
      <div class="day-picker">${w.days.map(d => `<button type="button" class="day-chip btn-chip ${m.day === d.i ? 'on' : ''}" ${d.past ? 'disabled' : ''} data-act="move-day" data-day="${d.i}"><span>${d.name}</span><small>${d.available ? '' : 'off'}</small></button>`).join('')}</div>
      ${warns.map(x => `<div class="fit-box warn">${h(x.text)}</div>`).join('')}
      ${m.day != null && !warns.length ? '<div class="fit-box ok">Looks good: no clashes.</div>' : ''}
      <div class="row end"><button class="btn ghost" data-act="close">Cancel</button><button class="btn primary" data-act="move-confirm" ${m.day == null ? 'disabled' : ''}>Move it</button></div>`;
  },
  sick() {
    return `<h2>🤒 Get well soon</h2><p>Quick check: where are your symptoms?</p>
      <div class="stack">
        <button class="btn" data-act="sick-where" data-where="above">Only above the neck<br><small class="hint">runny nose, mild sore throat</small></button>
        <button class="btn" data-act="sick-where" data-where="below">Below the neck, or fever<br><small class="hint">chest, body aches, stomach, temperature</small></button>
        <button class="btn ghost" data-act="close">Cancel</button>
      </div>
      <p class="hint">Not medical advice. Chest pain, trouble breathing or a high fever: see a doctor.</p>`;
  },
  days() {
    const sc = K.schedule(S);
    return `<form id="days-form"><h2>Training days</h2>
      <div class="day-picker">${K.DAY_NAMES.map((d, i) => `<label class="day-chip"><input type="checkbox" name="d_${i}" ${sc.days.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div>
      <label class="field"><span>Longest session on</span><select name="longDay">${K.DAY_NAMES.map((d, i) => `<option value="${i}" ${sc.longDay === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
  },
  incoming({ inc, matched }) {
    const fromLvl = inc.from.level ? levelLabel(Math.min(13, Math.max(1, inc.from.level))) : '';
    if (inc.t === 'f') return `<div class="center">
        ${avatar(inc.from.id, inc.from.name)}
        <h2>${h(inc.from.name)} wants to run with you!</h2><p class="hint">${fromLvl}</p>
        <p>Added to your running buddies. Send yours back so they see you too.</p>
        <div class="row center"><button class="btn ghost" data-act="close">Later</button><button class="btn primary" data-act="invite">Share mine back</button></div></div>`;
    if (inc.t === 'r') return `<div class="center"><div class="big-emoji">🎉</div>
        <h2>${h(inc.from.name)} did it!</h2><p><strong>${h(inc.title)}</strong>${inc.scaled ? ' (their version)' : ''}</p>
        <p class="hint">${matched ? 'Marked on your sent challenge.' : 'Nice! (This challenge was sent from another device.)'}</p>
        <div class="row center"><button class="btn primary" data-act="close">Awesome</button></div></div>`;
    const who = CH.me(S);
    const m = CH.fitMessageForMe(inc, who);
    const tone = { ready: 'ok', stretch: 'ok', big: 'warn', way: 'goal', rebuild: 'warn', paused: 'warn' }[m.fit];
    const scaledTitle = m.scaled ? CH.versionTitle(inc, m.scaled) : null;
    const buttons = {
      ready: ['<button class="btn primary" data-act="inc-choice" data-choice="original">Accept 💪</button>', '<button class="btn ghost" data-act="inc-choice" data-choice="later">Save for later</button>'],
      stretch: ['<button class="btn primary" data-act="inc-choice" data-choice="original">Accept the stretch 💪</button>', '<button class="btn ghost" data-act="inc-choice" data-choice="later">Save for later</button>'],
      big: [scaledTitle ? `<button class="btn primary" data-act="inc-choice" data-choice="scaled">Accept: ${h(scaledTitle)}</button>` : '', '<button class="btn" data-act="inc-choice" data-choice="original">Go for the full one</button>', '<button class="btn ghost" data-act="inc-choice" data-choice="later">Save for later</button>'],
      way: [scaledTitle ? `<button class="btn primary" data-act="inc-choice" data-choice="scaled">Accept: ${h(scaledTitle)}</button>` : '', '<button class="btn" data-act="inc-choice" data-choice="later">🎯 Save the big one as a goal</button>'],
      rebuild: ['<button class="btn primary" data-act="inc-choice" data-choice="later">Save for later</button>'],
      paused: ['<button class="btn primary" data-act="inc-choice" data-choice="later">Save for later</button>'],
    }[m.fit].filter(Boolean);
    return `<div class="incoming">
      <div class="from">${avatar(inc.from.id, inc.from.name)}<div><strong>${h(inc.from.name)} challenged you!</strong><span class="hint">${fromLvl}</span></div></div>
      <div class="ch-hero"><span class="ch-icon big">${CH.TEMPLATES[inc.tpl].icon}</span><h2>${h(CH.challengeTitle(inc))}</h2><p class="hint">${inc.days} days to do it</p>
        ${inc.msg ? `<p class="quote">“${h(inc.msg)}”</p>` : ''}</div>
      <div class="fit-box ${tone}">${h(m.text)}</div>
      <div class="stack">${buttons.join('')}<button class="btn ghost" data-act="inc-choice" data-choice="decline">Not now</button></div>
    </div>`;
  },
  newChallenge(m) {
    const d = m.draft;
    const tpl = CH.TEMPLATES[d.tpl];
    const friends = Object.values(S.friends);
    const to = d.to ? S.friends[d.to] : null;
    const c = { tpl: d.tpl, p: d.p, days: d.days };
    const notes = CH.fitMessageForSender(c, to, CH.me(S));
    const toneOf = f => ({ ready: 'ok', stretch: 'ok', big: 'warn', way: 'goal', rebuild: 'warn', paused: 'warn', anyone: 'info', self: 'info' }[f]);
    return `<form id="nc-form">
      <h2>New challenge</h2>
      ${S.profile.name ? '' : `<label class="field"><span>Your name (friends see it)</span><input type="text" name="myName" value="${h(d.myName || '')}" maxlength="30" required></label>`}
      <p class="q">Type</p>
      <div class="tpl-grid">${Object.entries(CH.TEMPLATES).map(([k, t]) => `<label class="tpl ${d.tpl === k ? 'on' : ''}"><input type="radio" name="tpl" value="${k}" ${d.tpl === k ? 'checked' : ''} hidden><span>${t.icon}</span>${h(t.name)}</label>`).join('')}</div>
      <label class="field"><span>Target</span><select name="p">${tpl.opts.map(([v, l], i) => `<option value="${i}" ${d.p === i ? 'selected' : ''}>${h(tpl.title(v, d.days))} · suits Level ${l}</option>`).join('')}</select></label>
      <p class="q">Time to do it</p>
      <div class="chips-row">${CH.DAY_OPTIONS.map(n => `<label class="chip-opt ${d.days === n ? 'on' : ''}"><input type="radio" name="days" value="${n}" ${d.days === n ? 'checked' : ''} hidden>${n} days</label>`).join('')}</div>
      <label class="field"><span>Who</span><select name="to"><option value="">Anyone with the link</option>${friends.map(f => `<option value="${h(f.id)}" ${d.to === f.id ? 'selected' : ''}>${h(f.name)} · Level ${f.level}</option>`).join('')}</select></label>
      <label class="field"><span>Message (optional)</span><input type="text" name="msg" value="${h(d.msg || '')}" maxlength="140" placeholder="Bet you can't! 😜"></label>
      <div class="ch-preview"><span class="ch-icon">${tpl.icon}</span><strong>${h(CH.challengeTitle(c))}</strong></div>
      ${notes.map(n => `<div class="fit-box ${toneOf(n.fit)}">${h(n.text)}${n.scaled ? `<button type="button" class="btn small" data-act="nc-scale" data-tpl="${n.scaled.tpl}" data-p="${n.scaled.p}">Use “${h(CH.versionTitle(c, n.scaled))}”</button>` : ''}</div>`).join('')}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary" type="submit">Create & share</button></div>
    </form>`;
  },
  share(m) {
    const data = shareData(m.kind, m.payload);
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    return `<div>
      <h2>${{ invite: 'Invite running buddies', challenge: 'Send your challenge', result: `Tell ${h(m.payload?.toName || 'them')}` }[m.kind]}</h2>
      <p class="share-text">${h(data.text)}</p>
      <input class="share-url" readonly value="${h(data.url)}" aria-label="Link">
      <div class="stack">
        ${navigator.share ? '<button class="btn primary" data-act="share-native">Share…</button>' : ''}
        <a class="btn" href="https://wa.me/?text=${encodeURIComponent(`${data.text} ${data.url}`)}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="btn" data-act="share-copy">Copy link</button>
        <button class="btn ghost" data-act="close">Done</button>
      </div>
      ${local ? '<p class="hint">Testing locally: this link opens on this computer only. Once the site is on GitHub Pages, anyone can open it.</p>' : ''}
    </div>`;
  },
  placed(m) {
    const l = m.level, w = E.worldOf(l);
    const how = l.n === 1 ? 'Every legend starts at the Starting Line. Let\'s build something great.'
      : `${m.secs ? `Blitzed through ${m.skippedLevels} level${m.skippedLevels > 1 ? 's' : ''} in ${m.secs}s.` : `Skipped ${m.skippedLevels} level${m.skippedLevels > 1 ? 's' : ''}.`} ${m.line}`;
    return `<div class="placed-card">
      <div class="placed-flag">🏁</div>
      <h2>PLACED!</h2>
      <p class="eyebrow">${w.emoji} ${h(w.name)}</p>
      <h3>Level ${l.n} · ${h(l.name)}</h3>
      <p>${h(how)}</p>
      ${S.rebuild.active ? '<div class="banner warn">First stop: the Rebuild Track. Your level is saved right here.</div>' : ''}
      <div class="row end"><button class="btn primary" data-act="close">Let's go 🏃</button></div></div>`;
  },
  level() {
    const track = E.activeTrack(S);
    const note = track !== 'run' ? `<div class="banner info">${track === 'rebuild' ? 'Rebuild Track first.' : 'Refresher course first.'} These steps open afterwards.</div>` : '';
    return `<p class="eyebrow">${h(E.worldOf(E.runLevel(S.run.level)).name)}</p><h2>${trackTitle('run')}</h2>${note}
      <ul class="steps">${E.trackSteps(S, 'run').map(st => stepRow(track === 'run' ? 'run' : 'none', st)).join('')}</ul>
      <div class="row end"><button class="btn" data-act="close">Close</button></div>`;
  },
  step(m) {
    const st = E.trackSteps(S, m.track)[m.idx];
    const exs = exHtml(st);
    const passQ = st.type === 'proveit' ? `<p class="q">Did you hit it?</p>${radio('passed', [['1', 'Yes, I hit it'], ['0', 'Not quite']], '1')}` : '';
    const raceQ = m.track === 'hyGate' && st.boss ? `<p class="q">Your race</p>
        <label class="field"><span>Race</span>${select('raceEvent', [['alphax:open', 'Alpha X Open'], ['alphax:base', 'Alpha X Base'], ['hyrox:open', 'Hyrox Open'], ['hyrox:pro', 'Hyrox Pro'], ['sim', 'Simulation (no race)']], S.hybrid?.race ? `${S.hybrid.race.event}:${S.hybrid.race.division}` : 'alphax:open')}</label>
        <label class="field"><span>Format</span>${select('raceFormat', [['solo', 'Solo'], ['pair', 'Pair / Doubles'], ['relay', 'Relay']], 'solo')}</label>
        ${timeField('raceTime', 'Finish time', '', 'h:mm:ss, e.g. 1:24:30')}<p class="hint">Stars come from your time against ${S.profile.sex ? ST.SEX_LABEL[S.profile.sex].toLowerCase() : 'your category\'s'} standards. Any finish counts.</p>`
      : m.track === 'triGate' && st.boss ? `${timeField('raceTime', 'Finish time', '', 'h:mm:ss, e.g. 5:42:10')}<p class="hint">Stars come from your time; 70.3 and full distance must be inside the official cut-off.</p>` : '';
    const gateNote = st.type === 'gate' ? `<p class="hint">${st.nextDay ? 'Gate result is confirmed by tomorrow morning\'s pain check (2/10 or less).' : 'Only log it once you have done the test.'}</p>` : '';
    // When it was done, how it went, and the athlete's own words (read by the coach).
    const nextDay = st.type === 'run' || st.type === 'proveit' || (st.type === 'gate' && st.nextDay);
    const today = dayInput(t0()), min = dayInput(t0() - 14 * E.DAY);
    const logQ = st.type === 'rest' ? '' : `
      <p class="q">When did you do it?</p>${radio('when', [['today', 'Today'], ['yesterday', 'Yesterday'], ['date', 'Another day']], 'today')}
      <label class="field when-date" hidden><span>Date</span><input type="date" name="whenDate" min="${min}" max="${today}" value="${today}"></label>
      ${nextDay ? `<div class="when-morning" hidden><p class="q">How did you feel the morning after?</p>${radio('morning', [['ok', 'Fine (pain 2/10 or less)'], ['sore', 'Sore or painful (3/10 or more)']], 'ok')}</div>` : ''}
      ${st.type === 'proveit' ? '' : `<p class="q">How did it go?</p>${radio('result', [['full', 'Finished it all ✅'], ['partial', 'Partly: cut it short or stopped early'], ['none', 'Tried, but couldn\'t do it today']], 'full')}`}
      <label class="field"><span>What did you actually do? <em class="hint">optional</em></span><input type="text" name="actual" maxlength="300" placeholder="${h(actualHint(st))}"></label>
      <label class="field"><span>Anything else? <em class="hint">optional</em></span><textarea name="note" rows="2" maxlength="300" placeholder="e.g. hot day, legs heavy from Saturday, felt strong at the end"></textarea></label>
      <p class="hint">🤖 Your coach reads these two and replies in the Coach tab.</p>`;
    const simple = S.profile.view === 'simple';
    // Already trained (or tried) today: say so, so a second log is a choice, not an accident.
    const todays = S.history.filter(x => (x.kind === 'session' || x.kind === 'attempt') && E.dayKey(x.ts) === E.dayKey(t0()));
    const already = st.type !== 'rest' && todays.length ? `<div class="banner warn">You already logged <strong>“${h(todays.at(-1).title)}”</strong> today. Log this one too only if you really did a second session, or if you did it on another day (pick the day below). Otherwise rest: recovery is training too 💛</div>` : '';
    return `<form id="step-form">
      <p class="eyebrow">${trackTitle(m.track)} · ${TYPE_LABEL[st.type]}</p>
      <h2>${h(st.title)}</h2>
      ${st.detail ? `<p>${h(st.detail)}</p>` : ''}
      ${exs ? `<ul class="exercises">${exs}</ul>` : ''}
      ${already}${gateNote}${passQ}${raceQ}
      ${logQ && simple ? `<details class="log-more" ${already ? 'open' : ''}><summary>Not today, not all of it, or want to add notes? Tap here</summary>${logQ}</details>` : logQ}
      ${st.type === 'rest' ? '' : simple ? painButtons() : painSlider()}
      <div class="row end"><button type="button" class="btn ghost" data-act="close">Cancel</button>${st.type !== 'rest' && S.profile.view === 'simple' ? '' : `<button class="btn primary" type="submit">Log it (+${st.xp} XP)</button>`}</div>
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
      if (s.reason === 'busy' && s.tier === 'none') return `<h2>All good 👍</h2><p>Carry on where you left off.</p><div class="row end"><button class="btn primary" data-act="close">Let's go</button></div>`;
      if (s.reason === 'illness' && s.sickDays != null) return `<h2>💛 Welcome back!</h2>
        <p>You were sick for ${s.sickDays} day${s.sickDays > 1 ? 's' : ''}. Here's your recovery plan:</p>
        <ul class="plain">${s.steps ? `<li>${s.steps} easy session${s.steps > 1 ? 's' : ''} to ease back in, starting with a gentle health check</li>` : ''}
          ${s.toLevel !== s.fromLevel ? `<li>Level ${s.fromLevel} → Level ${s.toLevel} for now. Level ${s.fromLevel} is marked Reclaim on your map</li>` : `<li>Then straight back to Level ${s.fromLevel} on your map</li>`}
          ${s.streak ? `<li>🔥 Your ${s.streak}-day streak was frozen and is waiting. One check-in today keeps it going!</li>` : ''}</ul>
        <p class="hint">Any fever or chest symptoms coming back? Rest again: the plan waits for you.</p>
        <div class="row end"><button class="btn primary" data-act="close">Let's ease back in</button></div>`;
      return `<h2>Your comeback plan</h2>
        <p>Away ${s.gapDays} days.${s.effectiveDays < s.gapDays ? ` Thanks to the training you kept up, that counts as about ${s.effectiveDays} days off.` : ''}</p>
        ${s.toLevel !== s.fromLevel ? `<p>Level ${s.fromLevel} → <strong>Level ${s.toLevel}</strong> for now.</p>` : ''}
        <ul class="plain">${s.notes.map(n => `<li>${h(n)}</li>`).join('')}</ul>
        <div class="row end"><button class="btn primary" data-act="close">Let's go</button></div>`;
    }
    const { short } = E.returnCheck(S, now());
    if (short) return `<form id="return-form">
      <h2>👋 Missed a few days?</h2>
      <p>${gapDays} days since your last session. No stress, what happened?</p>
      ${radio('reason', [['busy', 'Just busy, all good'], ['illness', 'I was sick'], ['injury', 'Pain or injury']], 'busy')}
      <p class="hint">Sick? Your streak gets saved, and you ease back in with one gentle session.</p>
      <input type="hidden" name="easyMin" value=""><input type="hidden" name="hardMin" value=""><input type="hidden" name="crossMin" value="">
      <div class="row end"><button class="btn primary" type="submit">Continue</button></div>
    </form>`;
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
  tab(el) { if (ui.laneAnimating) ui.laneSkip = true; document.querySelector('.lane-skip')?.remove(); ui.tab = el.dataset.tab; ui.mapPopup = null; ui.frameTop = null; ui.mapScroll = ui.tab === 'map'; render(); if (ui.tab !== 'map') window.scrollTo(0, 0); },
  // Retake with the same answers: straight to the result screen (still editable with Back).
  'ob-same'() {
    ui.ob = { step: obSteps(S.answers || {}).length - 1, a: { ...(S.answers || {}) } };
    checkAnswers(); renderOnboarding(); window.scrollTo(0, 0);
  },
  'ob-back'() { collectOb(); ui.ob.step--; renderOnboarding(); },
  'ob-finish'() {
    if (+ui.ob.a.age > 0 && +ui.ob.a.age < 13) { // Family mode
      const a = ui.ob.a, st = E.newState(now());
      st.placedAt = now(); st.history = (S.history || []).filter(h => h.kind === 'play'); st.xp = st.history.length * 10; // stickers stay
      st.profile = { ...st.profile, name: String(a.name || '').trim().slice(0, 40), kid: true, birthYear: new Date(now()).getFullYear() - +a.age, likes: KID_LIKES.map(([k]) => k).filter(k => a[`kl_${k}`]), tracks: ['run'], view: 'simple' };
      st.profile.days = a.days || [0, 1, 2, 3, 4, 5, 6];
      ui.retake = false; ui.ob = { step: 0, a: {} }; ui.tab = 'today';
      commit(st); confetti(); return;
    }
    const fresh = !S.placedAt || ui.retake;
    sfx.unlockAudio(); // inside the click, so the intro can play sound
    const a = normalize(ui.ob.a);
    let { state, placed } = E.placeFromAnswers(S, a, now());
    state = K.setSchedule(state, a.days || K.defaultDays(3), +(a.longDay ?? 5));
    const tracks = a.tracks?.length ? a.tracks : ['run'];
    state.profile.tracks = tracks;
    state.otherTraining = otherFrom(ui.ob.a);
    state.profile.primary = tracks.includes(a.primary) ? a.primary : tracks[0];
    state.profile.view = a.view === 'full' ? 'full' : 'simple';
    if (+ui.ob.a.age >= 13 && +ui.ob.a.age < 18) { const cap = +ui.ob.a.age < 16 ? 8 : 10; if (state.run.level > cap) { state.run.level = cap; state.run.done = {}; } }
    if (+ui.ob.a.age > 0) { state.profile.birthYear = new Date(now()).getFullYear() - +ui.ob.a.age; state.profile.kid = false; state.profile.ageGroup = state.profile.ageGroup || AGE.ageGroupOf(+ui.ob.a.age); state.nutrition = { ...(state.nutrition || {}), age: state.nutrition?.age || +ui.ob.a.age }; }
    state.tri = tracks.includes('tri') ? TRI.placeTri(state, a) : state.tri || null;
    state.hybrid = tracks.includes('hybrid') ? HYB.refreshHybrid({ ...state, hybrid: HYB.placeHybrid(state, a, now()) }, now(), E.weekKey(now())).hybrid : state.hybrid || null;
    state = E.applyBackground(state, backgroundOf(ui.ob.a)); // former athletes: technique credited, fast-track on
    const ai = a.dreamAI?.accepted ? a.dreamAI : null;
    state.profile.dream = { text: String(a.dream || '').trim().slice(0, 160), event: String(a.dreamEvent || ai?.event || '').trim().slice(0, 60),
      date: a.dreamDate || (/^\d{4}-\d{2}-\d{2}$/.test(ai?.date || '') ? ai.date : ''), summary: ai?.summary || '',
      target: (ai && targetFromAI(ai)) || dreamTarget(`${a.dream || ''} ${a.dreamEvent || ''}`) };
    ui.retake = false; ui.ob = { step: 0, a: {} }; ui.tab = 'today';
    if (fresh) {
      // Every map starts again at START; each plays when the athlete taps ▶ on it.
      ui.tab = 'map'; ui.avatarAt = 0; ui.mapPopup = null; ui.mapScroll = true; ui.frameTop = null;
      ui.mapMode = state.profile.primary === 'hybrid' ? 'hyb' : state.profile.primary === 'tri' ? 'tri' : 'world';
      setRunIntro(placed);
    }
    // A new placement (first time or a retake) replays every lane map from START.
    if (fresh) { writeSeen({}); ui.laneShown = {}; ui.laneAnimating = false; }
    commit(state);
    ui.mapMode = primaryMode();
    if (!fresh) window.scrollTo(0, 0); // a new placement scrolls the map to its START line instead
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
  'map-node'(el) {
    if (ui.mapRunning) return;
    const n = +el.dataset.n;
    if (n > S.run.level || n === ui.avatarAt) { ui.mapPopup = ui.mapPopup === n ? null : n; render(); return; }
    const from = ui.avatarAt;
    ui.mapPopup = null; ui.mapRunning = true; render();
    runAvatar(from, n, { onDone: () => { ui.mapRunning = false; ui.avatarAt = n; saveAvatar(n); ui.mapPopup = n; render(); } });
  },
  'map-mode'(el) { ui.mapMode = el.dataset.mode; ui.mapScroll = ui.mapMode !== 'grid'; ui.frameTop = null; ui.lanePopup = null; ui.mapPopup = null; render(); },
  'grid-node'(el) {
    const n = +el.dataset.n, l = E.runLevel(n);
    if (n === S.run.level) { ui.modal = { type: 'level' }; renderModal(); }
    else if (n < S.run.level) toast(`${l.name}: ${'⭐'.repeat(S.run.stars[n] || 0) || 'placed past'}`);
    else toast(`${l.name} · ${ST.sexText(l.criteria, S.profile.sex)} · needs Prep P${l.needsPrep}`);
  },
  'map-bg'() { if (ui.mapPopup && !ui.mapRunning) { ui.mapPopup = null; render(); } },
  'map-me'() { followY(POINTS[ui.avatarAt ?? S.run.level].y); },
  'open-level'() { ui.modal = { type: 'level' }; renderModal(); },
  cleared() { ui.modal = { type: 'painfree', cleared: true }; renderModal(); },
  async 'share-toggle'(el) {
    const sh = shareState();
    if (el.checked) {
      setShare({ on: true, id: sh.id || crypto.randomUUID() }); ui.community = null; render(); fetchCommunity(true);
    } else {
      setShare({ on: false, id: sh.id }); ui.community = null; render();
      if (sh.id && WORKER_URL) {
        try { await fetch(`${WORKER_URL.replace(/\/$/, '')}/stats`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sh.id, delete: true }) }); toast('Your shared numbers were deleted.'); }
        catch { toast('Offline: your numbers will be deleted next time you switch this off online.'); setShare({ on: false, id: sh.id, pendingDelete: true }); }
      }
    }
  },
  'race-start'(el) {
    const k = el.dataset.k;
    if (!HYB.hasHybrid(S)) { ui.pendingRace = k; ui.modal = { type: 'addHyb', a: { ...(S.answers || {}) } }; renderModal(); return; }
    ui.modal = { type: 'race', k }; renderModal();
  },
  'race-div'(el) {
    const { k } = ui.modal, div = el.dataset.div;
    S.hybrid.race = { event: k, division: div, since: now() };
    ui.modal = null; commit(S); countOnce(`prep:${k}`); countOnce(`prep:${k}:${div}`);
    toast(`${RACES[k].icon} Preparing for ${RACES[k].name} ${RACES[k].divisions.find(d => d[0] === div)[1]}. Let's go!`);
  },
  'race-stop'() { S.hybrid.race = null; commit(S); toast('Race prep stopped. Your Hybrid plan carries on.'); },
  'show-me'(el) { showMe(el.dataset.f); },
  // Stop a reply on its way: the message comes back into the box, as if never sent.
  'chat-stop'() {
    const last = ui.chat.at(-1);
    if (last?.role === 'user') { ui.chat.pop(); ui.chatDraft = last.content; }
    ui.chatAbort?.abort();
  },
  // Delete one of your messages (and the coach's reply to it): the coach no longer sees either.
  'msg-del'(el) { chatRemove(+el.dataset.m); toast('Message deleted. The coach won\'t see it.'); },
  'msg-edit'(el) { const i = +el.dataset.m; ui.chatDraft = ui.chat[i]?.content || ''; chatRemove(i); },
  'dismiss-banner'(el) { ui.dismissed.add(el.dataset.key); render(); },
  'coach-open'() { ui.prevTab = ui.tab === 'coach' ? ui.prevTab : ui.tab; ui.coachUnread = false; ui.tab = 'coach'; render(); },
  'coach-back'() { ui.tab = ui.prevTab || 'today'; render(); },
  'strava-connect'() { stravaConnect(); },
  'split-edit'() { ui.modal = { type: 'splitPick' }; renderModal(); },
  'kid-done'(el) {
    const m = MISSIONS.find(x => x.id === el.dataset.id); if (!m) return;
    const first = !kidPlays().some(x => x.mission === m.id);
    S.history.push({ ts: now(), kind: 'play', mission: m.id, title: `${m.icon} ${m.title}`, xp: 10 }); S.xp += 10;
    commit(S); confetti(); sfx.fanfare?.(); toast(first ? `🏅 New sticker: ${m.icon} ${m.title}!` : '⭐ Brilliant! +10 stars');
  },
  'kid-like'(el) { const k = el.dataset.k, l = new Set(S.profile.likes || []); el.checked ? l.add(k) : l.delete(k); S.profile.likes = [...l]; commit(S); },
  'strava-request'() { ui.modal = { type: 'stravaRequest' }; renderModal(); },
  'strava-own'() { ui.modal = { type: 'stravaOwn' }; renderModal(); },
  'strava-check'() { ui.stravaStatus = null; stravaRefreshStatus(); },
  async 'strava-decide'(el) { ui.stravaAdmin = await stravaApi('admin', { action: el.dataset.v, target: el.dataset.d }); ui.stravaStatus = await stravaApi('status', {}); render(); toast(el.dataset.v === 'approve' ? '✅ Approved. They can connect now.' : el.dataset.v === 'revoke' ? 'Removed.' : 'Declined.'); },
  async 'strava-claim'() {
    const code = prompt('Owner code (the one you set on the Worker):');
    if (!code) return;
    const d = await stravaApi('claim', { code });
    if (d.admin) { ui.stravaStatus = null; ui.stravaAdmin = null; stravaRefreshStatus(); toast('👑 This phone is now the admin.'); } else toast(d.error || 'Not right.');
  },
  'strava-sync'() { stravaSync(true); render(); },
  async 'strava-disconnect'() {
    const st = stravaState();
    if (!confirm('Disconnect Strava? Activities already brought in stay; nothing new comes in.')) return;
    try { await fetch(`${WORKER_URL.replace(/\/$/, '')}/strava/disconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: st.device }) }); } catch { /* offline: tokens expire anyway */ }
    setStrava({ device: st.device }); render(); toast('Strava disconnected.');
  },
  // Count a Strava run as today's planned session: the usual log pop-up, filled in from Strava.
  'strava-log'(el) {
    const act = S.history.find(x => x.ts === +el.dataset.ts && x.strava);
    ui.modal = { type: 'step', track: el.dataset.track, idx: +el.dataset.idx, fromStrava: act?.ts }; renderModal();
    const f = document.getElementById('step-form'), a = act?.strava;
    if (f && a) { const inp = f.querySelector('[name=actual]'); if (inp) inp.value = `${a.km} km in ${formatTime(a.minutes)}${a.hr ? `, avg HR ${Math.round(a.hr)}` : ''} (Strava)`;
      if (el.dataset.differs) { const r = f.querySelector('[name=result][value=partial]'); if (r) r.checked = true; } }
  },
  'strava-skip'(el) { const act = S.history.find(x => x.ts === +el.dataset.ts && x.strava); if (act) { act.dismissed = true; commit(S); } },
  'other-edit'() { ui.modal = { type: 'otherTraining', a: otherToAnswers(S.otherTraining) }; renderModal(); },
  'extra-add'() { ui.modal = { type: 'extraSession' }; renderModal(); },
  'activity-del'(el) { const i = S.history.findIndex(x => x.kind === 'activity' && x.ts === +el.dataset.ts); if (i >= 0) { S.history.splice(i, 1); ui.modal = null; commit(S); toast('Removed.'); } },
  'nutri-setup'() { ui.modal = { type: 'nutriSetup' }; renderModal(); },
  'nutri-weigh'() { ui.modal = { type: 'nutriWeigh' }; renderModal(); },
  'nutri-reds'() { ui.modal = { type: 'nutriReds' }; renderModal(); },
  'nutri-hide'(el) { S.nutrition = { ...(S.nutrition || {}), hideNumbers: el.checked }; commit(S); },
  'nutri-apply'(el) {
    // Until the clash is over: the race (+2 days), the end of Rebuild / illness (re-checked daily), or just today.
    const until = el.dataset.today ? ymdNow() : el.dataset.mode === 'perform' && S.target ? E.dayKey(new Date(`${S.target.date}T12:00:00`).getTime() + 2 * E.DAY) : E.dayKey(now() + 7 * E.DAY);
    S.nutrition = { ...S.nutrition, override: { mode: el.dataset.mode, until, set: now() } }; commit(S);
    toast(el.dataset.mode === 'perform' ? '⚡ Fuelling for performance. Your goal resumes afterwards.' : '⏸️ Deficit paused. Your goal resumes afterwards.');
  },
  'nutri-undo'() { S.nutrition = { ...S.nutrition, override: null }; commit(S); toast('Your goal is back on.'); },
  'target-pick'(el) { ui.modal = { type: 'target', uid: el.dataset.uid }; renderModal(); },
  'target-set'(el) {
    const f = document.getElementById('target-form'), e = raceFrom(el.dataset.uid);
    if (!e) return;
    const distance = f?.tDist?.value || e.distance, goal = f?.querySelector('[name=tGoal]:checked')?.value || 'finish';
    const km = TG.NEEDS[distance]?.km, mode = f?.querySelector('[name=tTimeMode]:checked')?.value || 'time';
    const goalTime = goal === 'time' ? raceMinutes(f?.tTime?.value || '', mode, km) : null;
    if (goal === 'time' && !goalTime) return toast('Type your goal time, for example 1:59:00.');
    if (!distance) return toast('Pick the distance first.');
    S.target = { uid: e.uid, name: e.name, date: e.date, distance, track: e.track, url: e.url, location: e.location, goal, goalTime, setAt: now() };
    ui.modal = null; commit(S);
    toast(`🎯 ${e.name} is your race. Countdown on Today!`);
  },
  'target-clear'() { S.target = null; ui.modal = null; commit(S); toast('Race cleared. Pick another whenever you like.'); },
  'target-result'() { ui.modal = { type: 'raceResult' }; renderModal(); },
  'log-info'(el) { ui.modal = { type: 'logInfo', ts: +el.dataset.ts }; renderModal(); },
  async videos(el) {
    const li = el.closest('.ex'), ex = el.dataset.ex, q = EXERCISES[ex]?.search || EXERCISES[ex]?.name;
    let panel = li.querySelector('.vid-panel');
    if (panel) { panel.remove(); return; } // tap again to close
    panel = document.createElement('div'); panel.className = 'vid-panel'; panel.dataset.q = q;
    panel.innerHTML = '<p class="hint">Finding demo videos…</p>';
    li.appendChild(panel);
    const d = vidCache[q] || await videoApi({ q });
    if (d.error) { panel.innerHTML = `<p class="hint">⚠️ ${d.reason === 'busy' ? 'Videos are busy right now (free YouTube limit).' : "Videos can't be loaded right now."} <a href="${videoLink(ex)}" target="_blank" rel="noopener">Search YouTube instead ↗</a></p>`; return; }
    vidCache[q] = d;
    if (!d.videos.length) { panel.innerHTML = `<p class="hint">No demo found. <a href="${videoLink(ex)}" target="_blank" rel="noopener">Search YouTube ↗</a></p>`; return; }
    count('view:videos');
    videoList(panel, q, d.videos);
  },
  'vid-play'(el) { const panel = el.closest('.vid-panel'), q = panel.dataset.q; const v = vidCache[q]?.videos.find(x => x.id === el.dataset.id); if (v) videoPlayer(panel, q, v); },
  'vid-back'(el) { const panel = el.closest('.vid-panel'), q = panel.dataset.q; videoList(panel, q, vidCache[q]?.videos || []); },
  'vid-vote'(el) {
    const panel = el.closest('.vid-panel'), q = panel.dataset.q, id = el.dataset.id, v = +el.dataset.v, k = `${q}|${id}`;
    const prev = myVotes()[k] || 0, next = prev === v ? 0 : v; // tap again to take it back
    setMyVote(k, next);
    videoApi({ q, id, vote: next, undo: prev });
    const item = vidCache[q]?.videos.find(x => x.id === id);
    if (item) { item.up += (next === 1) - (prev === 1); item.down += (next === -1) - (prev === -1); videoPlayer(panel, q, item); }
    if (next) toast(next === 1 ? '👍 Thanks! Helpful videos move up for everyone.' : '👎 Thanks! Unhelpful videos move down.');
  },
  async 'vid-suggest'(el) {
    const panel = el.closest('.vid-panel'), q = panel.dataset.q, url = el.previousElementSibling?.value.trim();
    if (!url) return toast('Paste a YouTube link first.');
    el.disabled = true;
    const d = await videoApi({ q, suggest: url });
    el.disabled = false;
    if (d.error) return toast(d.error === 'offline' ? 'No connection right now.' : d.error);
    const list = vidCache[q]?.videos || [];
    if (!list.some(x => x.id === d.video.id)) list.unshift({ ...d.video, up: 0, down: 0, suggested: 1 });
    toast('Thanks! It shows for others once another athlete suggests it too.');
    videoPlayer(panel, q, list.find(x => x.id === d.video.id));
  },
  'step-info'(el) { ui.modal = { type: 'stepInfo', track: el.dataset.track, idx: +el.dataset.idx }; renderModal(); },
  'prep-stage'(el) { ui.modal = { type: 'prepStage', n: +el.dataset.n }; renderModal(); },
  'tour-start'() { ui.modal = null; renderModal(); startTour(0); },
  'tour-step'(el) { ui.tour.i = Math.max(0, ui.tour.i + +el.dataset.d); tourGo(); },
  'tour-end'() { endTour(false); },
  'help-back'() { ui.helpReturn = false; document.querySelector('.tour-bar')?.remove(); ui.modal = { type: 'help' }; renderModal(); },
  help() { document.querySelector('.tip-bubble')?.remove(); document.querySelectorAll('.tip-target').forEach(x => x.classList.remove('spotlight', 'tip-target')); ui.modal = { type: 'help' }; renderModal(); },
  'tour-offer'(el) {
    const t = tourLocal(); setTourLocal({ ...t, offered: true });
    el.closest('.tip-bubble')?.remove();
    if (el.dataset.v === 'go') startTour(0); else toast('Any time: tap ❓ Help at the top.');
  },
  'tour-open'(el) { ui.tourOpen = !el.parentElement.open; }, // the browser opens/closes it; remember for redraws
  'tour-hide'() { S.tour = { ...(S.tour || {}), hidden: true }; commit(S); toast('Getting started hidden. You can bring it back in Me → How it works.'); },
  'tour-unhide'() { S.tour = { ...(S.tour || {}), hidden: false }; commit(S); if (ui.modal?.type === 'help') renderModal(); toast('Getting started is back on Today.'); },
  'tips-toggle'(el) { const t = tourLocal(); setTourLocal({ ...t, tipsOff: !el.checked }); toast(el.checked ? 'Tips on.' : 'Tips off.'); },
  'tip-ok'(el) {
    const t = tourLocal(); setTourLocal({ ...t, seen: { ...(t.seen || {}), [el.dataset.f]: true } });
    el.closest('.tip-bubble')?.remove();
    document.querySelectorAll('.tip-target').forEach(x => x.classList.remove('spotlight', 'tip-target'));
  },
  'race-info'(el) { tourFlag('race_info'); ui.modal = { type: 'race', k: el.dataset.k, info: true }; renderModal(); },
  'race-site'(el) { count(`site:${el.dataset.k}`); },
  'comp-tab'(el) { ui.compTab = el.dataset.k; render(); },
  'about-me'() { ui.modal = { type: 'aboutMe' }; renderModal(); },
  'counts-toggle'(el) { try { localStorage.setItem(COUNT_KEY, el.checked ? 'on' : 'off'); } catch { /* ignore */ } toast(el.checked ? 'Anonymous counts on. Thank you!' : 'Anonymous counts off.'); },
  'edit-bests'() { ui.modal = { type: 'bests' }; renderModal(); },
  'edit-numbers'() { ui.modal = { type: 'numbers' }; renderModal(); },
  painfree() { ui.modal = { type: 'painfree', cleared: false }; renderModal(); },
  'painfree-go'(el) {
    const f = el.closest('form');
    if ([...f.querySelectorAll('input[type=checkbox]')].some(c => !c.checked)) { toast('Tick every box first, or keep going with the Rebuild Track 💛'); return; }
    if (S.rebuild.redFlag) S = E.clearRedFlag(S, now());
    if (el.dataset.mode === 'gradual') { ui.modal = null; renderModal(); commit(S); toast('Cleared ✅ Rebuild sessions are open again. Step by step 💪'); return; }
    const saved = S.rebuild.savedRunLevel;
    ui.modal = null; renderModal();
    commit(E.leaveRebuild(S, now()));
    toast(`Welcome back! Run Level ${S.run.level} now, with a fast reclaim to Level ${saved} 💪`);
  },
  'report-pain'() { ui.modal = { type: 'rebuildPrompt' }; renderModal(); },
  export() { store.exportFile(S); },
  retake() { if (confirm('Retake the assessment? Your XP and badges stay; your level is set again from your new answers.')) { ui.retake = true; ui.ob = { step: 0, a: {} }; render(); } }, // a fresh questionnaire: new answers, new result
  reset() { if (confirm('Delete all progress in this browser? This also disconnects Strava on this phone.')) { const st = stravaState(); if (st.connected && WORKER_URL) fetch(`${WORKER_URL.replace(/\/$/, '')}/strava/disconnect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: st.device }) }).catch(() => {}); localStorage.removeItem(STRAVA_KEY); ui.stravaStatus = null; store.clear(); localStorage.removeItem(CHAT_KEY); localStorage.removeItem(AVATAR_KEY); ui.avatarAt = null; ui.chat = []; S = E.newState(now()); render(); } },
  sound() { sfx.setSound(!sfx.soundOn()); if (sfx.soundOn()) { sfx.unlockAudio(); sfx.pop(); } render(); },
  quick(el) { sendChat(el.dataset.q); },
  'edit-bg'() {
    const a = {};
    (S.background || []).forEach(b => { a[`bg_${b.sport}`] = true; a[`bglvl_${b.sport}`] = b.level; a[`bgyrs_${b.sport}`] = b.years; a[`bgsince_${b.sport}`] = b.since; });
    ui.modal = { type: 'background', a }; renderModal();
  },
  'coach-mode'(el) { ui.smartCoach = el.dataset.v === '1'; try { localStorage.setItem('stride-quest:smartCoach', ui.smartCoach ? '1' : '0'); } catch { /* ignore */ } render(); },
  async 'shout-rec'() {
    if (ui.recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('Recording is not supported in this browser. Try uploading a clip.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream), chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const fr = new FileReader();
        fr.onload = () => { try { sfx.saveShout(fr.result); toast('Shout saved 💪 Your lifter will use it.'); } catch { toast('That clip is too big to store.'); } ui.recording = false; render(); };
        fr.readAsDataURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      ui.recording = true; render(); toast('Recording… shout now!');
      rec.start(); setTimeout(() => rec.state !== 'inactive' && rec.stop(), 3000);
    } catch { ui.recording = false; toast('Microphone permission is needed to record.'); render(); }
  },
  'shout-play'() { sfx.unlockAudio(); sfx.playShout(); },
  'shout-clear'() { sfx.clearShout(); toast('Shout removed.'); render(); },
  'set-sex'(el) { S.profile.sex = el.dataset.v; commit(S); toast(`Using ${ST.SEX_LABEL[el.dataset.v].toLowerCase()} standards.`); },
  'play-run'() { playRun(); },
  // Watch the whole climb again from START, clouds and all.
  'replay-journey'() {
    if (ui.mapRunning || ui.laneAnimating) return;
    tourFlag('replay');
    ui.mapPopup = null; ui.lanePopup = null; ui.frameTop = null; ui.mapScroll = true;
    if (ui.mapMode === 'hyb' || ui.mapMode === 'tri') {
      const all = readSeen(); delete all[ui.mapMode]; writeSeen(all);
      ui.laneShown = { ...(ui.laneShown || {}), [ui.mapMode]: null };
    } else { ui.replay = true; setRunIntro(S.run.level); ui.avatarAt = 0; }
    render();
  },
  'play-intro'() { document.querySelector('.play-btn')?.remove(); sfx.unlockAudio(); ui.intro = runIntroPending(); setRunIntro(null); ui.avatarAt = 0; afterMapRender(); },
  'play-lanes'() { ui.lanePlay?.(); },
  'lane-focus'(el) {
    const cfg = LANE_MAPS[el.dataset.map], lane = el.dataset.lane;
    triFollow(nodePoint(cfg, lane, Math.min(cfg.value(S, lane), cfg.worlds.at(-1)[lane])).y);
    ui.lanePopup = { map: el.dataset.map, kind: 'lane', lane }; ui.frameTop = document.querySelector('.worldmap')?.scrollTop ?? null;
    const before = window.scrollY; render(); window.scrollTo(0, before);
  },
  'set-theme'(el) { try { localStorage.setItem(THEME_KEY, el.dataset.t); } catch { /* ignore */ } applyTheme(el.dataset.t); render(); },
  'lifts-ai'(el) { if (ui.ob.a.liftsAI) { ui.ob.a.liftsAI.accepted = el.dataset.v === '1'; renderOnboarding(); } },
  'fix-field'(el) {
    const steps = obSteps(ui.ob.a), i = steps.findIndex(st => (st.body || '').includes(`name="${el.dataset.field}"`));
    if (i >= 0) { ui.ob.step = i; renderOnboarding(); window.scrollTo(0, 0); setTimeout(() => document.querySelector(`[name="${el.dataset.field}"]`)?.focus(), 50); }
  },
  async 'ai-fix'(el) {
    const task = el.dataset.task, note = $(`#ai-note-${task}`)?.value.trim();
    if (!note) { toast('Type a few words for the AI first.'); return; }
    el.disabled = true; el.textContent = 'Reading…';
    collectOb();
    await (task === 'dream' ? readDream(note) : task === 'lifts' ? readLifts(note) : checkAnswers(note));
    if (document.querySelector('.result')) renderOnboarding();
  },
  // After a hiccup: drop the warning and ask again (the athlete's last message, if any, is still in the thread).
  'check-retry'() {
    const c = ui.ob.a.check;
    if (!c) return;
    c.chat = (c.chat || []).filter(m => !m.trouble);
    const lastUser = [...c.chat].reverse().find(m => m.role === 'user');
    if (lastUser) { c.chat.splice(c.chat.lastIndexOf(lastUser), 1); checkAnswers(lastUser.content); }
    else { c.for = null; checkAnswers(); }
  },
  'check-apply'(el) {
    const m = ui.ob.a.check?.chat?.[+el.dataset.m], ch = m?.changes?.[+el.dataset.c];
    if (!ch || ch.applied) return;
    ui.ob.a[ch.field] = ch.value; ch.applied = true;
    ui.ob.a.check.for = checkKey(ui.ob.a); // keep the conversation going with the new answer
    renderOnboarding(); toast(`Changed: ${ch.label} → ${ch.value}`);
    checkAnswers(`(I applied: ${ch.label} = ${ch.value}.)`); // the AI sees the new answer and updates what's left to check
  },
  'dream-ai'(el) { if (ui.ob.a.dreamAI) { ui.ob.a.dreamAI.accepted = el.dataset.v === '1'; renderOnboarding(); } },
  'sugg-apply'(el) {
    const m = ui.chat[+el.dataset.m], a = m?.actions?.[+el.dataset.a];
    if (!a || a.status !== 'pending') return;
    if (!ACT.describe(S, a, now())) {
      const done = ACT.alreadyDone(S, a, now());
      if (done) { a.status = 'applied'; a.label = done; saveChat(); toast(done); render(); return; }
      a.status = 'skipped'; a.label = 'No longer fits your plan'; saveChat(); render();
      return toast('Your plan changed since the coach suggested this. Ask again and it will look at the new plan.');
    }
    const label = ACT.describe(S, a, now()).label;
    const { state, message, open } = ACT.apply(S, a, now());
    a.status = 'applied'; a.label = label; saveChat();
    S = state; store.save(S);
    if (open) ui.modal = open;
    toast(message); render();
  },
  'sugg-skip'(el) { const a = ui.chat[+el.dataset.m]?.actions?.[+el.dataset.a]; if (a) { a.label = ACT.describe(S, a, now())?.label || ''; a.status = 'skipped'; saveChat(); render(); } },
  'lane-node'(el) { if (ui.laneAnimating) return; const p = { map: el.dataset.map, kind: el.dataset.kind, lane: el.dataset.lane, world: el.dataset.world, v: el.dataset.v }; ui.lanePopup = ui.lanePopup && JSON.stringify(ui.lanePopup) === JSON.stringify(p) ? null : p; render(); },
  'fog-summit'() { ui.modal = { type: 'dream' }; renderModal(); },
  fog() { toast('☁️ Up there is still a mystery. Keep climbing and the clouds clear as you go.'); },
  'fog-peek'(el) {
    const map = el.closest('.worldmap');
    if (!map) return;
    // Keep what's on screen in place while the cropped top grows back (or shrinks away).
    const canvas = map.querySelector('.map-canvas'), before = canvas.getBoundingClientRect().bottom;
    const on = map.classList.toggle('peek');
    el.textContent = on ? '☁️ Hide again' : '👀 Look ahead';
    const shift = canvas.getBoundingClientRect().bottom - before;
    if (map.scrollHeight > map.clientHeight + 4) map.scrollTop += shift; else window.scrollBy(0, shift);
  },
  'lane-bg'() { if (ui.lanePopup) { ui.lanePopup = null; render(); } },
  'block-switch'(el) { S = HYB.switchBlock(S, el.dataset.b, now()); S = HYB.refreshHybrid(S, now(), E.weekKey(now())); store.save(S); toast(el.dataset.b === 'deload' ? 'Deload week: recover and come back stronger 😮‍💨' : `${el.dataset.b === 'engine' ? '⚡ Engine' : '🏋️ Strength'} block started: ${BLOCK_WEEKS} weeks.`); render(); },
  'lane-step'(el) {
    const lane = el.dataset.lane, st = E.trackSteps(S, lane).find(x => x.status === 'open');
    if (!st) return toast('Two sessions done: your gate test is next, or wait for the lane to unlock.');
    ui.lanePopup = null; ui.modal = { type: 'step', track: lane, idx: st.idx }; renderModal();
  },
  'goto-run-map'() { ui.tab = 'map'; ui.mapMode = 'world'; ui.lanePopup = null; ui.mapScroll = true; ui.frameTop = null; render(); },
  'goto-hyb-map'() { ui.tab = 'map'; ui.mapMode = 'hyb'; ui.mapScroll = true; ui.frameTop = null; render(); },
  'goto-tri-map'() { ui.tab = 'map'; ui.mapMode = 'tri'; ui.mapScroll = true; ui.frameTop = null; render(); },
  'set-view'(el) { S.profile.view = el.dataset.v; commit(S); window.scrollTo(0, 0); },
  async install() { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice.catch(() => {}); installEvent = null; render(); },
  'install-hide'() { try { localStorage.setItem(INSTALL_KEY, 'hide'); } catch { /* ignore */ } render(); },
  'move-item'(el) {
    const it = K.buildWeek(S, now()).days.flatMap(d => d.items).find(x => x.key === el.dataset.key);
    ui.modal = { type: 'move', key: el.dataset.key, title: it?.title || '', day: null }; renderModal();
  },
  'move-day'(el) { ui.modal.day = +el.dataset.day; renderModal(); },
  'move-confirm'() { const { key, day } = ui.modal; ui.modal = null; commit(K.moveItem(S, key, day, now())); toast(`Moved to ${K.DAY_NAMES[day]}.`); },
  'add-track'(el) {
    if (el.dataset.k === 'tri') { ui.modal = { type: 'addTri', a: { ...(S.answers || {}) } }; renderModal(); return; }
    if (el.dataset.k === 'hybrid') { ui.modal = { type: 'addHyb', a: { ...(S.answers || {}) } }; renderModal(); return; }
    S.profile.tracks = [...new Set([...(S.profile.tracks || ['run']), el.dataset.k])]; commit(S); toast('Added! It opens as soon as it is built, and your training already counts.');
  },
  'edit-days'() { ui.modal = { type: 'days' }; renderModal(); },
  'sick-start'() { ui.modal = { type: 'sick' }; renderModal(); },
  'sick-where'(el) { ui.modal = null; commit(E.startMode(S, { type: 'sick', where: el.dataset.where }, now())); toast('Sick mode on. Rest is training too 💤'); },
  'busy-start'() { commit(E.startMode(S, { type: 'busy' }, now())); toast('Busy mode on: only Key sessions this week.'); },
  'sick-checkin'() { commit(E.sickCheckIn(S, now())); toast(`+${E.XP.restDay} XP · Get well soon 💛`); },
  'mode-end'() {
    const wasSick = S.mode?.type === 'sick';
    const { state, summary } = E.endMode(S, now());
    S = state; store.save(S);
    if (wasSick && summary) { ui.modal = { type: 'return', summary }; toast('Welcome back! Easy does it 💪'); }
    render();
  },
  'social-tab'(el) { ui.socialTab = el.dataset.k; render(); },
  invite() { ui.modal = { type: 'share', kind: 'invite' }; renderModal(); },
  'new-challenge'(el) { ui.modal = { type: 'newChallenge', draft: { tpl: 'distance', p: 1, days: 7, to: '', msg: '' } }; renderModal(); },
  'challenge-friend'(el) {
    const f = S.friends[el.dataset.id];
    const c = { tpl: 'distance', days: 7 };
    const p = Math.max(0, CH.TEMPLATES.distance.opts.findLastIndex(([, l]) => l <= f.level));
    ui.modal = { type: 'newChallenge', draft: { ...c, p, to: f.id, msg: '' } }; renderModal();
  },
  'nc-scale'(el) { readDraft(); Object.assign(ui.modal.draft, { tpl: el.dataset.tpl, p: +el.dataset.p }); renderModal(); },
  'inc-choice'(el) {
    const inc = ui.modal.inc, choice = el.dataset.choice;
    const m = CH.fitMessageForMe(inc, CH.me(S));
    ui.modal = null;
    commit(CH.receive(S, inc, choice, m.scaled, now()));
    if (choice === 'decline') toast(`No worries. ${inc.from.name} is still in your buddies.`);
    else { ui.tab = 'challenge'; ui.socialTab = 'challenges'; render(); toast(choice === 'later' ? 'Saved. It will wait for you 🎯' : 'Challenge accepted! 💪'); }
  },
  'ch-done'(el) {
    const id = el.dataset.id;
    const firstWin = !S.badges.challenger;
    const next = CH.completeReceived(S, id, now());
    const c = next.challenges.received.find(x => x.id === id);
    commit(next);
    confetti(); sfx.fanfare();
    toast([`Challenge complete! +${CH.CHALLENGE_XP} XP`, ...(firstWin ? [`Badge unlocked: ${E.BADGES.challenger.emoji} ${E.BADGES.challenger.name}`] : [])]);
    ui.modal = { type: 'share', kind: 'result', payload: { ...CH.resultPayload(S, c), toName: c.from.name } }; renderModal();
  },
  'ch-drop'(el) { commit(CH.dropReceived(S, el.dataset.id)); toast('Removed. Plenty more where that came from.'); },
  'ch-start'(el) { commit(CH.startSaved(S, el.dataset.id, now())); toast("Let's go! 💪"); },
  reshare(el) { const c = S.challenges.sent.find(x => x.id === el.dataset.id); ui.modal = { type: 'share', kind: 'challenge', payload: c }; renderModal(); },
  async 'share-native'() {
    const data = shareData(ui.modal.kind, ui.modal.payload);
    try { await navigator.share(data); } catch { /* cancelled */ }
  },
  async 'share-copy'() {
    const data = shareData(ui.modal.kind, ui.modal.payload);
    try { await navigator.clipboard.writeText(`${data.text} ${data.url}`); toast('Link copied 📋'); }
    catch { const i = $('.share-url'); i.select(); document.execCommand('copy'); toast('Link copied 📋'); }
  },
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

// After a log with the athlete's own words (or an unfinished session), the coach replies in the Coach tab.
async function sessionFeedback(st, { when, ts, result, pain, actual, note }) {
  if (ui.thinking) return;
  const day = when === 'today' ? 'today' : when === 'yesterday' ? 'yesterday' : new Date(ts).toDateString();
  const how = result === 'partial' ? 'I only partly did it' : result === 'none' ? 'I tried but couldn\'t do it' : 'I finished it';
  const msg = `📝 Session log: "${st?.title || 'session'}" (${day}). ${how}. Pain ${pain}/10.${actual ? ` What I did: ${actual}.` : ''}${note ? ` Notes: ${note}.` : ''} Any feedback or changes for my plan?`;
  await sendChat(msg);
  if (ui.tab !== 'coach') toast('💬 Your coach replied about that session: see the Coach tab.');
}

function chatRemove(i) {
  if (ui.chat[i]?.role !== 'user') return;
  const n = ui.chat[i + 1]?.role === 'assistant' ? 2 : 1; // its reply goes too
  ui.chat.splice(i, n); saveChat(); render();
}

async function sendChat(text) {
  text = text.trim();
  if (!text || ui.thinking) return;
  ui.chat.push({ role: 'user', content: text });
  ui.thinking = true; ui.slow = false; render();
  const slowTimer = setTimeout(() => { if (ui.thinking) { ui.slow = true; if (ui.tab === 'coach') render(); } }, ui.smartCoach ? 9000 : 4000);
  const history = ui.chat.slice(-12).map(({ role, content }) => ({ role, content }));
  ui.chatAbort = new AbortController();
  const res = await askCoach(history, `${E.coachContext(S, now())}\n${ACT.weekContext(S, now())}\n${nutritionContext()}`, S, ui.smartCoach, FEATURE_BRIEF, ui.chatAbort.signal);
  ui.chatAbort = null;
  if (res.aborted) { clearTimeout(slowTimer); ui.thinking = false; ui.slow = false; saveChat(); render(); return; } // stopped: the message is already back in the box
  const { reply, provider, actions = [], model, tier, reason } = res;
  const valid = actions.filter(a => ACT.describe(S, a, now()));
  ui.chat.push({ role: 'assistant', content: reply, provider, model, tier, reason, actions: valid.map(a => ({ ...a, status: 'pending' })) });
  if (ui.tab !== 'coach') ui.coachUnread = true;
  clearTimeout(slowTimer);
  ui.thinking = false; ui.slow = false; saveChat(); render();
  if (ui.speakReplies) speak(reply);
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT' && el.type === 'range') return;
  if (el.type === 'checkbox' && el.dataset.act === 'speak-toggle') return;
  if (el.dataset.act === 'import' || el.dataset.act === 'shout-file') return;
  if (e.target === $('#modal')) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  // Real links still open, checkboxes still tick and folded sections still open: the action only adds to them.
  const native = (el.tagName === 'A' && el.href) || el.type === 'checkbox' || el.tagName === 'SUMMARY';
  if (!native) e.preventDefault();
  fn(el, e);
});

function readDraft() {
  const f = $('#nc-form');
  if (!f || ui.modal?.type !== 'newChallenge') return;
  const d = ui.modal.draft;
  const tpl = f.querySelector('input[name=tpl]:checked')?.value || d.tpl;
  if (tpl !== d.tpl) { d.tpl = tpl; d.p = Math.min(1, CH.TEMPLATES[tpl].opts.length - 1); }
  else d.p = +f.p.value;
  d.days = +(f.querySelector('input[name=days]:checked')?.value || d.days);
  d.to = f.to.value;
  d.msg = f.msg.value;
  if (f.myName) d.myName = f.myName.value;
}

// Enter in an AI correction box sends it (instead of submitting the questionnaire).
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.closest?.('.ai-fix')) return;
  e.preventDefault();
  e.target.closest('.ai-fix').querySelector('button')?.click();
}, true);

// Tapping the selected answer of a single-choice question again clears it.
document.addEventListener('pointerdown', e => {
  const r = e.target.closest('label.choice')?.querySelector('input[type=radio]');
  if (r) r.dataset.was = r.checked ? '1' : '';
}, true);
document.addEventListener('click', e => {
  const r = e.target;
  if (r.type !== 'radio' || !r.closest('label.choice')) return;
  if (r.dataset.was === '1') { r.checked = false; r.dispatchEvent(new Event('change', { bubbles: true })); }
  r.dataset.was = '';
}, true);

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.closest('#nutri-form') && el.name === 'nGoal') { el.form.querySelector('.nutri-pace')?.toggleAttribute('hidden', !['cut', 'gain'].includes(el.value)); return; }
  if (el.closest('#target-form') && el.name === 'tTimeMode' && ui.modal?.type === 'target') { ui.modal.timeMode = el.value; renderModal(); return; }
  if (el.closest('#target-form') && ['tDist', 'tGoal', 'tTime'].includes(el.name) && ui.modal?.type === 'target') {
    if (el.name === 'tDist') ui.modal.distance = el.value || null;
    else if (el.name === 'tGoal') ui.modal.goal = el.value;
    else { const km = TG.NEEDS[ui.modal.distance || raceFrom(ui.modal.uid)?.distance]?.km || 1, tm = raceMinutes(el.value, ui.modal.timeMode || 'time', km); if (!tm && el.value.trim()) return toast('Use h:mm:ss or mm:ss, for example 1:59:00 or 5:30.'); ui.modal.goalTime = tm; }
    renderModal(); return;
  }
  if (el.closest('#step-form') && el.name === 'when') {
    const f = el.form;
    const w = f.querySelector('[name=when]:checked')?.value || 'today';
    f.querySelector('.when-date')?.toggleAttribute('hidden', w !== 'date');
    f.querySelector('.when-morning')?.toggleAttribute('hidden', w === 'today');
    return;
  }
  if (el.closest('#nc-form') && el.name !== 'msg' && el.name !== 'myName') { readDraft(); renderModal(); return; }
  if (el.closest('#bg-form') && el.name?.startsWith('bg_')) { ui.modal.a = { ...ui.modal.a, ...Object.fromEntries(new FormData(el.form).entries()), [el.name]: el.checked }; BG.SPORTS.forEach(([k]) => { if (!el.form.querySelector(`[name=bg_${k}]`)?.checked) delete ui.modal.a[`bg_${k}`]; }); renderModal(); return; }
  if (el.closest('#ob-form, #other-form') && /^ot_/.test(el.name || '')) { if (el.closest('#other-form')) { collectOther(); renderModal(); } else { collectOb(); renderOnboarding(); } return; }
  if (el.closest('#ob-form') && (el.name?.startsWith('bg_') || el.name?.startsWith('tr_') || el.name?.startsWith('hx_') || /Mode$/.test(el.name || '') || el.name === 'swimDist' || el.name === 'bikeAccess' || el.name === 'liftMode' || el.name === 'liftUnit')) { collectOb(); renderOnboarding(); return; }
  if (el.closest('#tri-form') && (el.name === 'swimDist' || el.name === 'bikeAccess')) { ui.modal.a = { ...ui.modal.a, ...readTriForm(el.closest('form')) }; renderModal(); return; }
  if (el.dataset.act === 'speak-toggle') ui.speakReplies = el.checked;
  if (el.dataset.act === 'shout-file' && el.files[0]) {
    const f = el.files[0];
    if (f.size > 400 * 1024) { toast('Please use a clip under 400 KB (about 3 seconds).'); return; }
    const fr = new FileReader();
    fr.onload = () => { try { sfx.saveShout(fr.result); toast('Shout saved 💪'); } catch { toast('That clip is too big to store.'); } render(); };
    fr.readAsDataURL(f);
    return;
  }
  if (el.dataset.act === 'import' && el.files[0]) {
    try { commit(await store.importFile(el.files[0])); toast('Progress imported.'); }
    catch (err) { toast(/version|newer|older/i.test(err.message) ? err.message : "That file isn't a Stride Quest backup."); }
  }
});

document.addEventListener('input', e => {
  // Typing an exact distance clears the multiple choice it replaces.
  const pair = { swimM: 'swimDist', rideKm: 'longestRide' }[e.target.name];
  if (pair && e.target.value.trim()) e.target.form?.querySelectorAll(`[name=${pair}]`).forEach(r => { r.checked = false; });
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
  if (f.id === 'ob-form') {
    collectOb();
    if (f.querySelector('[name^=tr_]') && !(ui.ob.a.tracks || []).length) return toast('Pick at least one thing you train for.');
    if (f.age && !(+f.age.value >= 4 && +f.age.value <= 99)) { f.age.focus(); return toast('Add your age: it keeps the plan safe for kids and teens.'); }
    if (f.guardian && !f.guardian.checked) return toast('A parent or guardian needs to tick the box to set up Family mode.');
    if (f.querySelector('[name^=d_]') && (ui.ob.a.days || K.defaultDays(3)).length < 2) return toast('Pick at least 2 training days.');
    if (f.bodyweight && (ui.ob.a.liftUnit || 'kg') === 'kg' && +f.bodyweight.value > 130 && !ui.ob.lbWarned) { ui.ob.lbWarned = true; f.bodyweight.focus(); return toast('Bodyweight over 130 kg: did you mean lb? Switch to lb above, or tap Next again to keep kg.'); }
    if (f.squat5 && f.bodyweight && +f.bodyweight.value > 0 && +f.squat5.value / +f.bodyweight.value > 3.2 && !ui.ob.ratioWarned) { ui.ob.ratioWarned = true; return toast('That squat is over 3x your bodyweight: are the units the same (kg or lb) for both? Tap Next again to keep it.'); }
    const badTime = [...f.querySelectorAll('.time-field input[type=text]')].find(i => i.value.trim() && parseTime(i.value) == null);
    if (badTime) { badTime.focus(); return toast('Use mm:ss or h:mm:ss, for example 27:30 or 1:05:00.'); }
    if (f.querySelector('[name=dream]')) readDream();
    if (f.querySelector('[name=otherLifts]')) readLifts();
    ui.ob.step++;
    if (obSteps(ui.ob.a)[ui.ob.step]?.result && !obSteps(ui.ob.a)[ui.ob.step]?.kid) checkAnswers();
    renderOnboarding(); window.scrollTo(0, 0); return;
  }
  if (f.id === 'bg-form') {
    const a = { ...Object.fromEntries(new FormData(f).entries()) };
    BG.SPORTS.forEach(([k]) => { a[`bg_${k}`] = !!f.querySelector(`[name=bg_${k}]`)?.checked; });
    ui.modal = null;
    commit(E.applyBackground(S, backgroundOf(a)));
    toast(BG.isFormerAthlete(S) ? 'Background saved: technique credited, comeback fast-track on ⚡' : 'Background saved.');
    return;
  }
  if (f.id === 'hyb-form') {
    const fd = Object.fromEntries(new FormData(f).entries());
    const a = { ...(S.answers || {}), ...fd, row1000: parseTime(fd.row1000Text) || null };
    S.profile.tracks = [...new Set([...(S.profile.tracks || ['run']), 'hybrid'])];
    S.answers = a;
    S.hybrid = HYB.placeHybrid(S, a, t);
    S = HYB.refreshHybrid(S, t, E.weekKey(t));
    ui.modal = null; ui.tab = 'map'; ui.mapMode = 'hyb'; ui.mapScroll = true; ui.frameTop = null;
    commit(S);
    toast(`Welcome to ${HYB.hybWorld(S).emoji} ${HYB.hybWorld(S).name}!`);
    if (ui.pendingRace) { ui.modal = { type: 'race', k: ui.pendingRace }; ui.pendingRace = null; renderModal(); }
    return;
  }
  if (f.id === 'split-form') {
    const d = f.querySelector('[name=spDays]:checked')?.value || 'auto', id = f.querySelector('[name=spId]:checked')?.value || 'auto';
    if (id === 'bro' && !confirm('Bro split: each muscle once a week, and very sore legs on leg day, which clashes with running. Use it anyway?')) return;
    const was = JSON.stringify(S.hybrid.split || {});
    S.hybrid.split = { id, days: d === 'auto' ? null : +d };
    if (JSON.stringify(S.hybrid.split) !== was) S.hybrid.strength.done = {};
    ui.modal = null; commit(S); toast('🏋️ Split saved. Your strength sessions follow it.');
    return;
  }
  if (f.id === 'strava-req-form') {
    const name = f.rName.value.trim(), msg = f.rMsg.value.trim();
    if (!name) return toast('Add your name.');
    (async () => {
      const d = await stravaApi('request', { name, msg });
      if (d.error) return toast(d.error === 'offline' ? 'No connection right now.' : d.error);
      ui.modal = null; renderModal(); ui.stravaStatus = { status: d.status || 'pending' }; render(); toast('📨 Request sent to Abdullah.');
    })();
    return;
  }
  if (f.id === 'strava-own-form') {
    const cid = f.oCid.value.trim(), secret = f.oSecret.value.trim();
    if (!/^\d+$/.test(cid) || secret.length < 20) return toast('Check the Client ID (a number) and the Client Secret.');
    (async () => {
      const d = await stravaApi('byo', { cid, secret });
      if (d.error) return toast(d.error === 'offline' ? 'No connection right now.' : d.error);
      setStrava({ ...stravaState(), byo: { cid, secret } });
      stravaConnect();
    })();
    return;
  }
  if (f.id === 'other-form') {
    collectOther();
    S.otherTraining = otherFrom(ui.modal.a);
    S.answers = { ...(S.answers || {}), ...otherToAnswers(S.otherTraining) };
    ui.modal = null; commit(S); toast(S.otherTraining.length ? '🏋️ Saved. Your plan and nutrition count it now.' : 'Saved.');
    return;
  }
  if (f.id === 'extra-form') {
    const minutes = +f.xMin.value;
    if (!(minutes >= 5 && minutes <= 400)) return toast('Add the minutes, e.g. 60.');
    const item = sessionItem({ kind: f.xKind.value, minutes, effort: f.querySelector('[name=xEffort]:checked')?.value || 'moderate' });
    S.history.push({ ts: now(), kind: 'activity', title: `${(otherOf(item.kind) || otherOf('other')).label.split(' ')[0]} ${item.title}`, xp: 0, item });
    ui.modal = null; commit(S); toast('✅ Logged. It counts toward your week and nutrition.');
    return;
  }
  if (f.id === 'nutri-form') {
    const v = n => f[n]?.value?.trim(), num = n => (v(n) ? +v(n) : null);
    const type = f.querySelector('[name=nGoal]:checked')?.value || 'perform', kg = num('nKg'), heightCm = num('nHeight'), age = num('nAge');
    if (!(heightCm > 120 && heightCm < 230)) return toast('Add your height in cm, e.g. 175.');
    if (!(age > 0)) return toast('Add your age.');
    if (!(age >= 14 && age <= 90)) return toast('Nutrition targets are for ages 14 to 90.');
    if (!(kg > 30 && kg < 250)) return toast('Add your weight in kg, e.g. 72.5.');
    const bf = num('nBf');
    if (bf != null && !(bf >= 3 && bf <= 60)) return toast('Body fat should be a percentage between 3 and 60, or empty.');
    const goal = { type: type === 'perform' ? 'perform' : type, pace: f.querySelector('[name=nPace]:checked')?.value || 'slow', weight: num('nGoalKg'), date: v('nGoalDate') || null };
    S.nutrition = { ...(S.nutrition || {}), setup: true, heightCm, age, kg, life: f.querySelector('[name=nLife]:checked')?.value || 'sit', goal };
    const last = (S.bodyLog || []).at(-1);
    const hadBf = last?.bf || S.answers?.bodyFat, clearedBf = !bf && hadBf; // an emptied field removes it
    if (!last || Math.abs((last.unit === 'lb' ? last.bw * 0.4536 : last.bw) - kg) > 0.05 || (bf && last.bf !== bf) || clearedBf) S.bodyLog = [...(S.bodyLog || []), { ts: now(), bw: kg, unit: 'kg', bf: bf || null, method: bf ? last?.method || '' : '' }].slice(-60);
    if (bf) S.answers = { ...(S.answers || {}), bodyFat: bf };
    else if (clearedBf) { const { bodyFat, ...rest } = S.answers || {}; S.answers = rest; }
    ui.modal = null; commit(S); toast('🍽️ Your nutrition follows your training now.');
    return;
  }
  if (f.id === 'weigh-form') {
    const kg = +f.wKg.value;
    if (!(kg > 30 && kg < 250)) return toast('Add your weight in kg.');
    const last = (S.bodyLog || []).at(-1);
    S.bodyLog = [...(S.bodyLog || []), { ts: now(), bw: kg, unit: 'kg', bf: last?.bf || null, method: last?.method || '' }].slice(-60);
    S.nutrition = { ...(S.nutrition || {}), kg };
    ui.modal = null; commit(S); toast('⚖️ Logged. The weekly trend is what counts.');
    return;
  }
  if (f.id === 'reds-form') {
    const flags = [...f.querySelectorAll('input[type=checkbox]:checked')].map(x => x.name.slice(2));
    S.nutrition = { ...(S.nutrition || {}), reds: { ts: now(), flags } };
    ui.modal = null; commit(S);
    toast(flags.length ? 'Thanks for being honest. Please read the note at the top of Nutrition.' : '✅ All clear. See you next month.');
    return;
  }
  if (f.id === 'result-form') {
    const tm = parseTime(f.rTime.value);
    if (!tm) return toast('Use h:mm:ss or mm:ss, for example 2:05:30 or 27:40.');
    const t = S.target, key = { '5k': 'run5k', '10k': 'run10k', half: 'half', marathon: 'marathon' }[t.distance];
    t.result = { time: tm, note: f.rNote.value.trim().slice(0, 200), ts: now() };
    if (key && !(S.bests?.[key] > 0 && S.bests[key] <= tm)) S.bests = { ...(S.bests || {}), [key]: tm };
    if (/hyrox/i.test(t.name) && !(S.bests?.hyrox > 0 && S.bests.hyrox <= tm)) S.bests = { ...(S.bests || {}), hyrox: tm };
    S.history.push({ ts: now(), kind: 'event', title: `🏁 ${t.name}: ${formatTime(tm)}`, xp: 0 });
    ui.modal = null; commit(S); confetti(); sfx.fanfare();
    toast(`🏁 ${formatTime(tm)} at ${t.name}. Huge! Rest up this week.`);
    return;
  }
  if (f.id === 'dream-form') {
    const text = f.dText.value.trim().slice(0, 160), event = f.dEvent.value.trim().slice(0, 60), date = f.dDate.value || '';
    if (!text && !event) return toast('Write your dream in a few words first.');
    S.profile.dream = { ...(S.profile.dream || {}), text, event, date, summary: '', target: dreamTarget(`${text} ${event}`) };
    S.answers = { ...(S.answers || {}), dream: text, dreamEvent: event, dreamDate: date };
    ui.modal = null; commit(S); toast('Dream saved: it\'s on your summit now 🎯');
    return;
  }
  if (f.id === 'bests-form') {
    const tm = n => { const v = f[n].value.trim(); return v ? parseTime(v) : null; };
    const fields = { run5k: tm('b5k'), run10k: tm('b10k'), half: tm('bHalf'), marathon: tm('bMar'), hyrox: tm('bHyrox') };
    const bad = Object.entries(fields).find(([k, v]) => v === null && f[{ run5k: 'b5k', run10k: 'b10k', half: 'bHalf', marathon: 'bMar', hyrox: 'bHyrox' }[k]].value.trim());
    if (bad) return toast('Use mm:ss or h:mm:ss for times, for example 24:30 or 1:55:00.');
    S.bests = { ...fields, hyroxDiv: f.querySelector('[name=bHyDiv]:checked')?.value || 'open', ftp: +f.bFtp.value || null };
    S.profile.sex = f.querySelector('[name=bSex]:checked')?.value || S.profile.sex;
    S.profile.ageGroup = f.bAge.value || null;
    ui.modal = null; commit(S); toast('Bests saved 📊');
    return;
  }
  if (f.id === 'numbers-form') {
    const unit = f.querySelector('[name=nUnit]:checked')?.value || 'kg', mode = f.querySelector('[name=nMode]:checked')?.value || '5';
    const num = n => (f[n].value.trim() === '' ? null : +f[n].value);
    const bw = num('nBw'), sq = num('nSq'), dl = num('nDl'), pu = num('nPu'), bf = num('nBf'), bfm = f.nBfM?.value || '';
    if (!(bw > 0) || !(sq > 0 || dl > 0)) return toast('Add your bodyweight and at least one lift.');
    if (bf != null && !(bf >= 3 && bf <= 60)) return toast('Body fat should be a percentage between 3 and 60, or leave it empty.');
    // Body log: one entry per change, for the trend.
    const last = (S.bodyLog || []).at(-1);
    if (!last || last.bw !== bw || last.unit !== unit || (last.bf ?? null) !== bf || last.sq !== sq || last.dl !== dl) S.bodyLog = [...(S.bodyLog || []), { ts: t, bw, unit, bf, method: bfm, sq, dl, mode }].slice(-60);
    const before = S.hybrid.strength.stage;
    const ans = { ...(S.answers || {}), bodyweight: bw, squat5: sq ?? '', deadlift5: dl ?? '', pullups: pu ?? '', liftUnit: unit, liftMode: mode, bodyFat: bf ?? '', bodyFatMethod: bf != null ? bfm : '' };
    const fresh = HYB.placeHybrid(S, { ...ans, liftExp: ans.liftExp || 'lt1' }, t);
    S.answers = ans;
    if (fresh.strength.stage !== before) S.hybrid.strength = { stage: fresh.strength.stage, done: {} };
    ui.modal = null; commit(S);
    toast(fresh.strength.stage === before ? `Numbers saved. Strength stays at ${HYB.strengthStage(S).name}.` : `🏋️ Strength: now working on ${HYB.strengthStage(S).name} (was ${STRENGTH_STAGES[Math.min(before, HYB.STR_MAX - 1)].name}).`);
    return;
  }
  if (f.id === 'tri-form') {
    const a = { ...(ui.modal.a || {}), ...readTriForm(f) };
    a.triRaces = TRI_RACES.map(([k]) => k).filter(k => a[`race_${k}`]);
    S.profile.tracks = [...new Set([...(S.profile.tracks || ['run']), 'tri'])];
    S.answers = { ...(S.answers || {}), ...a };
    S.tri = TRI.placeTri(S, a);
    ui.modal = null; ui.tab = 'map'; ui.mapMode = 'tri'; ui.mapScroll = true; ui.frameTop = null;
    commit(S);
    toast(`Welcome to ${TRI.triWorld(S).emoji} ${TRI.triWorld(S).name}!`);
    return;
  }
  if (f.id === 'days-form') {
    const days = K.DAY_NAMES.map((_, i) => i).filter(i => f[`d_${i}`].checked);
    if (days.length < 2) return toast('Pick at least 2 training days.');
    ui.modal = null;
    commit(K.setSchedule(S, days, +f.longDay.value));
    toast('Training days saved.');
    return;
  }
  if (f.id === 'nc-form') {
    readDraft();
    const d = ui.modal.draft;
    if (d.myName) S.profile.name = d.myName.trim().slice(0, 30);
    const c = CH.newChallenge(S, { tpl: d.tpl, p: d.p, days: d.days, msg: d.msg, to: d.to ? S.friends[d.to] : null }, t);
    commit(CH.recordSent(S, c));
    ui.modal = { type: 'share', kind: 'challenge', payload: c }; renderModal();
    return;
  }
  if (f.id === 'chat-form') { const v = f.msg.value; f.msg.value = ''; if (v.trim()) tourFlag('coach_asked'); sendChat(v); return; }
  if (f.id === 'step-form') {
    const m = ui.modal;
    const tapped = e.submitter?.name === 'painTap' ? +e.submitter.value : null;
    const pain = tapped != null ? tapped : f.pain ? +f.pain.value : 0;
    const passed = f.passed ? f.passed.value === '1' : undefined;
    const raceTime = f.raceTime ? parseTime(f.raceTime.value) : null;
    if (f.raceTime && f.raceTime.value.trim() && raceTime == null) return toast('Use h:mm:ss for your finish time, e.g. 1:24:30.');
    const [ev, div] = (f.raceEvent?.value || '').split(':');
    const race = f.raceTime ? { event: ev || 'tri', division: div || null, format: f.raceFormat?.value || 'solo', time: raceTime } : undefined;
    // When: today keeps the time; an earlier day is logged at midday of that day.
    const when = f.querySelector('[name=when]:checked')?.value || 'today';
    let ts = t;
    if (when !== 'today') {
      const [y, mo, d] = (when === 'yesterday' ? dayInput(t - E.DAY) : f.whenDate?.value || '').split('-').map(Number);
      ts = new Date(y, mo - 1, d, 12).getTime();
      if (!ts || ts > t) return toast('Pick a day in the past two weeks.');
      if (t - ts > 15 * E.DAY) return toast('Sessions older than two weeks can\'t be logged.');
    }
    const backdated = when !== 'today';
    const result = f.querySelector('[name=result]:checked')?.value || 'full';
    const actual = f.actual?.value.trim() || '', note = f.note?.value.trim() || '';
    const st = E.trackSteps(S, m.track)[m.idx];
    const { state, outcome } = E.completeStep(S, m.track, m.idx, { pain, passed, race, now: ts, result, actual, note, backdated,
      morningOk: f.querySelector('[name=morning]:checked')?.value !== 'sore' });
    if (m.fromStrava) { const act = state.history.find(x => x.ts === m.fromStrava && x.strava); if (act) { act.linked = true; act.linkedTitle = st?.title; } } // counted once, as the session
    ui.modal = null; S = state; store.save(S);
    handleOutcome(outcome);
    if (actual || note || result !== 'full') sessionFeedback(st, { when, ts, result, pain, actual, note });
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

// A link opened while the app is already open (same tab) only changes the hash.
window.addEventListener('hashchange', () => {
  const inc = CH.decodeHash(location.hash);
  if (!inc) return;
  history.replaceState(null, '', location.pathname + location.search);
  ui.incoming = inc;
  if (!ui.modal) render();
});

$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && ['step', 'level', 'share', 'newChallenge', 'move', 'days', 'sick', 'addTri', 'addHyb', 'background', 'painfree', 'numbers', 'aboutMe', 'race', 'dream', 'bests', 'help', 'prepStage', 'stepInfo', 'logInfo', 'target', 'raceResult', 'nutriSetup', 'nutriWeigh', 'nutriReds', 'otherTraining', 'extraSession', 'stravaRequest', 'stravaOwn', 'splitPick'].includes(ui.modal?.type)) { ui.modal = null; renderModal(); } });

// ---------- installable app ----------
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const INSTALL_KEY = 'stride-quest:installHint';
const installHidden = () => { try { return localStorage.getItem(INSTALL_KEY) === 'hide'; } catch { return false; } };
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; if (S.placedAt) render(); });
window.addEventListener('appinstalled', () => { installEvent = null; toast('Installed! Find Stride Quest on your home screen 📲'); render(); });

function installCard(where) {
  if (standalone()) return '';
  if (where === 'today' && installHidden()) return '';
  if (installEvent) return `<section class="card install"><div><strong>📲 Install Stride Quest</strong><p class="hint">One tap from your home screen, works offline, and keeps your progress safe.</p></div>
    <div class="row"><button class="btn primary small" data-act="install">Install</button>${where === 'today' ? '<button class="btn ghost small" data-act="install-hide">Later</button>' : ''}</div></section>`;
  if (isIOS()) return `<section class="card install"><div><strong>📲 Add to your Home Screen</strong>
    <p class="hint">In Safari tap <b>Share</b> <span aria-hidden="true">⬆️</span>, then <b>Add to Home Screen</b>. It opens like an app and keeps your progress safe (Safari can clear websites after a week away).</p></div>
    ${where === 'today' ? '<div class="row"><button class="btn ghost small" data-act="install-hide">Got it</button></div>' : ''}</section>`;
  if (/android/i.test(navigator.userAgent)) return `<section class="card install"><div><strong>📲 Add to your Home Screen</strong>
    <p class="hint">Open your browser menu <b>⋮</b>, then tap <b>Install app</b> or <b>Add to Home screen</b>. It opens like an app and keeps your progress safe.</p></div>
    ${where === 'today' ? '<div class="row"><button class="btn ghost small" data-act="install-hide">Got it</button></div>' : ''}</section>`;
  return '';
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // When a new version takes over, reload once so the new code runs (not on the very first install).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    try { sessionStorage.setItem('stride-quest:updated', '1'); } catch { /* ignore */ }
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}
setTimeout(() => { try { if (sessionStorage.getItem('stride-quest:updated')) { sessionStorage.removeItem('stride-quest:updated'); toast('Updated to the latest version ✨'); } } catch { /* ignore */ } }, 600);
navigator.storage?.persist?.().catch(() => {});

// ---------- toasts ----------
function renderToasts() {
  $('#toasts').innerHTML = ui.toasts.map(t => `<div class="toast">${h(t.m)}</div>`).join('');
}

stravaReturn();
render();
// Strava: bring new activities in on open, and when coming back to the app (at most every 20 min).
setTimeout(() => stravaSync(), 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') stravaSync(); });
