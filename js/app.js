import * as E from './engine.js';
import { RUN_LEVELS, PREP_STAGES, REBUILD_STAGES, WORLDS } from './data/tracks.js';
import { EXERCISES, videoLink } from './data/exercises.js';
import * as store from './store.js';
import { askCoach, understand, canListen, canSpeak, listen, speak } from './coach.js';
import * as ACT from './actions.js';
import * as M from './motivation.js';
import { renderMap, runAvatar, mapPageY, POINTS, H as MAP_H } from './map.js';
import { playPlacementIntro } from './intro.js';
import * as sfx from './sound.js';
import * as CH from './challenges.js';
import * as K from './calendar.js';
import { parseTime, formatTime, raceMinutes, estimateKm } from './time.js';
import { dreamTarget, weeksUntil, targetFromAI } from './goal.js';
import * as ST from './standards.js';
import * as TRI from './tri.js';
import { renderLaneMap, gateY as laneGateY, TH as LANE_H, MAPS as LANE_MAPS, nodePoint, moveCharacter, celebrate } from './trimap.js';
import * as HYB from './hybrid.js';
import { HYBRID_WORLDS, BLOCK_WEEKS } from './data/hybrid.js';
import { TRI_WORLDS } from './data/tri.js';
import { confetti } from './intro.js';

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
const TRACKS = [['run', '🏃 Running'], ['hybrid', '🏋️ Hybrid (Hyrox, Alpha X, Tough Mudder…)'], ['tri', '🏊 Triathlon']];
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
// A time typed as mm:ss / h:mm:ss, optionally as a pace per km (modeName toggles Total time / Pace).
const timeField = (name, label, cur, placeholder, modeName, mode) => `<div class="field time-field"><span>${h(label)}</span>
  <div class="time-row"><input type="text" name="${name}" value="${h(cur ?? '')}" placeholder="${h(placeholder)}" autocomplete="off" spellcheck="false" inputmode="text">
  ${modeName ? `<div class="seg mini">${[['time', 'Total time'], ['pace', 'Pace /km']].map(([v, l]) => `<label class="${(mode || 'time') === v ? 'on' : ''}"><input type="radio" name="${modeName}" value="${v}" ${(mode || 'time') === v ? 'checked' : ''} hidden>${l}</label>`).join('')}</div>` : ''}</div></div>`;
const tip = (text, label = 'More info') => `<details class="tip"><summary aria-label="${h(label)}">ⓘ</summary><p>${h(text)}</p></details>`;
const select = (name, opts, cur) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`;
const OTHER_EVENTS = ['CrossFit Open', 'CrossFit Games', 'Wodapalooza', 'Rogue Invitational', 'Tough Mudder', 'Spartan Race', 'DEKA', 'ATHX'];
const num = (name, label, cur, unit) => `<label class="field"><span>${h(label)}</span><span class="with-unit"><input type="number" inputmode="decimal" min="0" step="any" name="${name}" value="${cur ?? ''}"><em>${h(unit)}</em></span></label>`;

function obSteps(a) {
  const steps = [
    { welcome: true, title: "Let's build your plan", body: `
        <p class="lead">A few quick questions so your plan fits <strong>you</strong>: where you are today, what you dream of, and how your week looks.</p>
        <ol class="welcome-list"><li><span>🎯</span><div><strong>Your dream</strong><br><span class="hint">What you want to achieve</span></div></li>
          <li><span>📍</span><div><strong>Where you are today</strong><br><span class="hint">So the first level is a win, not a struggle</span></div></li>
          <li><span>📅</span><div><strong>Your week</strong><br><span class="hint">Which days you can train</span></div></li></ol>
        <p class="hint">About 2 minutes. Your answers stay on this device.</p>` },
    { title: 'About you', why: 'So we only show the tracks you care about, and use the right times and weights for you.', body: `
        <label class="field"><span>Your name (optional)</span><input type="text" name="name" value="${h(a.name || '')}" maxlength="40" autocomplete="given-name"></label>
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
    { title: 'How many times did you run in the last 4 weeks?', why: 'Recent running tells us more than your best day ever.', body: radio('runsLast4w', RUNS, a.runsLast4w) },
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
  ];
  if (E.qualifyingLevel(normalize(a)) >= 3) {
    steps.push({ title: 'Quick body check', why: 'Strong landings and ankles come before speed work.', body: `<p class="hint">Tick what you can do today. Not sure? Try it now. Each has a demo link.</p>
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
function hybQuestions(a) {
  return `<p class="q">Where do you train?</p>${radio('gym', [['full', 'Gym with sled, rower, SkiErg'], ['gym', 'Gym with barbells, no sled or ergs'], ['home', 'Home: dumbbells / kettlebells'], ['none', 'No equipment yet']], a.gym || 'full')}
    <p class="q">Lifting experience</p>${radio('liftExp', [['none', 'New to lifting'], ['lt1', 'Under 1 year'], ['y1_3', '1-3 years'], ['y3', 'More than 3 years']], a.liftExp || 'lt1')}
    <p class="q">Your current lifts <span class="hint">optional</span></p>
    <p class="hint">The heaviest weight you can lift with good form, either for 5 clean reps or as a single max rep.</p>
    ${radio('liftMode', [['5', 'For 5 clean reps'], ['1', 'As a 1-rep max'], ['unknown', "I don't know my numbers"]], a.liftMode || '5')}
    ${num('bodyweight', 'Your bodyweight', a.bodyweight, 'kg')}
    ${a.liftMode === 'unknown' ? '' : `${num('squat5', 'Heaviest back squat', a.squat5, 'kg')}${num('deadlift5', 'Heaviest deadlift', a.deadlift5, 'kg')}`}${num('pullups', 'Strict pull-ups in a row', a.pullups, 'reps')}
    <label class="field"><span>Other lifts or tests you know <span class="hint">optional, the AI turns them into estimates</span></span><textarea name="otherLifts" rows="2" maxlength="200" placeholder="e.g. leg press 150 kg x 8, goblet squat 24 kg x 10, bench 60 kg">${h(a.otherLifts || '')}</textarea></label>
    ${timeField('row1000Text', '1000 m row time', a.row1000Text, 'm:ss, e.g. 3:55')}
    <p class="q">Start with which block?</p>${radio('startBlock', [['auto', 'Let the app choose'], ['engine', '⚡ Engine block'], ['strength', '🏋️ Strength block']], a.startBlock || 'auto')}`;
}

function triQuestions(a) {
  const yn = (name, cur) => radio(name, [['yes', 'Yes'], ['no', 'Not yet']], cur || 'no');
  return `<p class="q">How far can you swim without stopping?</p>${radio('swimDist', SWIM_DIST, a.swimDist || '100')}
    ${num('swimM', 'Or type it exactly', a.swimM, 'm')}
    ${a.swimDist && a.swimDist !== 'none' ? `<p class="q">Do you swim freestyle (front crawl)?</p>${yn('freestyle', a.freestyle)}
      <p class="q">Have you swum in open water (lake or sea)?</p>${yn('openWater', a.openWater)}` : '<div class="banner info">No problem! You start with water comfort. Lessons with a swim coach are the fastest, safest way: we track your progress alongside.</div>'}
    <p class="q">Your bike</p>${radio('bikeAccess', [['road', 'Road or tri bike'], ['other', 'Another bike (hybrid, mountain bike)'], ['trainer', 'Indoor trainer only'], ['none', 'No bike yet']], a.bikeAccess || 'road')}
    ${a.bikeAccess !== 'none' ? `<p class="q">Longest ride lately?</p>${radio('longestRide', RIDES, a.longestRide || '60')}${num('rideKm', 'Or type it exactly', a.rideKm, 'km')}` : ''}
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
  return `<section class="card hyb-card" ${onMap ? '' : 'style="order:8"'}><p class="eyebrow">Hybrid · ${w.emoji} ${h(w.name)}</p>
    <p class="block-line">${blockLine}</p>
    <div class="block-bar">${Array.from({ length: BLOCK_WEEKS }, (_, i) => `<span class="${b.type !== 'deload' && i < b.week ? 'on' : ''}"></span>`).join('')}<span class="deload ${b.type === 'deload' ? 'on' : ''}"></span></div>
    <div class="lane-bars">${st.map(l => `<div class="${l.ok ? 'ok' : lim?.lane === l.lane ? 'lim' : ''}"><span>${HYB.LANE_ICON[l.lane]}</span><b>${h(ST.sexText(HYB.laneTarget(l.lane, l.need).replace(' x bodyweight', ' x BW'), S.profile.sex))}</b><em>${l.ok ? 'ready' : lim?.lane === l.lane ? 'limiter' : 'building'}</em></div>`).join('')}</div>
    <p class="hint">${S.hybrid.finished ? 'Pro League conquered 👑' : lim ? `${HYB.LANE_ICON[lim.lane]} ${HYB.LANE_LABEL[lim.lane]} is your limiter.${lim.lane !== 'run' && !HYB.inFocus(S, lim.lane) ? ` ${lim.lane === 'engine' ? 'An' : 'A'} ${HYB.LANE_LABEL[lim.lane]} block would move it most.` : ''}` : '🏁 All lanes ready: your race gate is open!'}</p>
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
    <div class="lane-bars">${st.map(l => `<div class="${l.ok ? 'ok' : lim?.lane === l.lane ? 'lim' : ''}"><span>${TRI.LANE_ICON[l.lane]}</span><b>${h(TRI.laneTarget(l.lane, l.need))}</b><em>${l.ok ? 'ready' : lim?.lane === l.lane ? 'limiter' : 'building'}</em></div>`).join('')}</div>
    <p class="hint">${S.tri.finished ? 'Full distance conquered 🏆' : lim ? `${TRI.LANE_ICON[lim.lane]} ${TRI.LANE_LABEL[lim.lane]} is your limiter: it moves your triathlon most right now.` : '🌉 All lanes ready: your transition gate is open!'}</p>
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

// Ask the AI to turn other lifts / tests into squat and deadlift estimates (non-blocking).
async function readLifts() {
  const a = ui.ob.a, text = String(a.otherLifts || '').trim();
  if (!text || a.liftsAI?.for === text) return;
  const r = await understand('lifts', `${text}${a.bodyweight ? ` (bodyweight ${a.bodyweight} kg)` : ''}`);
  if (!r || (!r.squat5Kg && !r.deadlift5Kg && !r.pullups)) return;
  ui.ob.a.liftsAI = { for: text, ...r, accepted: true };
  if (document.querySelector('.result')) renderOnboarding();
}

// Ask the AI what the dream means (non-blocking). The result screen shows it for a yes / not quite.
async function readDream() {
  const a = ui.ob.a, text = [a.dream, a.dreamEvent].filter(Boolean).join(' · ');
  if (!text || a.dreamAI?.for === text) return;
  const r = await understand('dream', text);
  if (!r || r.track === 'none') return;
  ui.ob.a.dreamAI = { for: text, ...r, accepted: true };
  if (ui.ob && !S.placedAt || ui.retake) { const res = document.querySelector('.result'); if (res) renderOnboarding(); }
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
    runsLast4w: n(a.runsLast4w), weeklyKm: n(a.weeklyKm), longestKm, longestEstimated, longestMin,
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

function collectOb() {
  const form = $('#ob-form');
  if (!form) return;
  const a = ui.ob.a;
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) a[el.name] = el.value; }
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
}

function renderOnboarding() {
  const steps = obSteps(ui.ob.a);
  const i = Math.min(ui.ob.step, steps.length - 1);
  const st = steps[i];
  const back = i > 0 ? '<button type="button" class="btn ghost" data-act="ob-back">Back</button>' : '';
  const invited = ui.incoming && ui.incoming.from?.name ? `<div class="banner info">🏆 <strong>${h(ui.incoming.from.name)}</strong> ${ui.incoming.t === 'c' ? 'sent you a challenge' : 'invited you to run together'}! Finish this quick setup to see how it fits your level.</div>` : '';
  const returning = invited + (S.needsReassessment ? `<div class="banner info">Welcome back! A quick re-assessment places you again. You won't start more than 3 levels below Level ${S.needsReassessment.oldLevel}.</div>` : '');
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
        ${dreamLine({ ...normalize(ui.ob.a), ...(ui.ob.a.dreamAI?.accepted ? { target: targetFromAI(ui.ob.a.dreamAI) || undefined, dreamDate: ui.ob.a.dreamDate || ui.ob.a.dreamAI.date || '' } : {}) }, preview.placed)}
        ${ui.ob.a.dreamAI ? `<div class="ai-read ${ui.ob.a.dreamAI.accepted ? '' : 'off'}"><span>🤖 Here's what I understood: <strong>${h(ui.ob.a.dreamAI.summary || '')}</strong></span>
          <div class="row">${ui.ob.a.dreamAI.accepted ? '<button type="button" class="btn ghost small" data-act="dream-ai" data-v="0">Not quite</button>' : '<button type="button" class="btn ghost small" data-act="dream-ai" data-v="1">Use this reading</button>'}</div></div>` : ''}
        ${(ui.ob.a.tracks || []).includes('hybrid') ? (() => { const hy = HYB.placeHybrid(preview.state, normalize(ui.ob.a), now()); const w = HYBRID_WORLDS[hy.world];
          return `<div class="dream-box"><strong>🏋️⚙️🏃 Hybrid: ${w.emoji} ${h(w.name)}</strong><br><span class="hint">Strength: ${h(ST.sexText(HYB.laneTarget('strength', hy.strength.stage + 1), ui.ob.a.sex))} next · Engine: ${h(HYB.laneTarget('engine', hy.engine.stage + 1))} next · starting with a ${hy.block.type === 'engine' ? '⚡ Engine' : '🏋️ Strength'} block</span></div>
            ${ui.ob.a.liftsAI ? `<div class="ai-read ${ui.ob.a.liftsAI.accepted ? '' : 'off'}"><span>🤖 I read your lifts as: <strong>${h(ui.ob.a.liftsAI.summary || '')}</strong>${ui.ob.a.liftsAI.confidence === 'low' ? ' <em class="hint">(rough estimate)</em>' : ''}</span>
              <div class="row"><button type="button" class="btn ghost small" data-act="lifts-ai" data-v="${ui.ob.a.liftsAI.accepted ? 0 : 1}">${ui.ob.a.liftsAI.accepted ? 'Not quite' : 'Use this estimate'}</button></div></div>` : ''}`; })() : ''}
        ${(ui.ob.a.tracks || []).includes('tri') ? (() => { const tri = TRI.placeTri(preview.state, normalize(ui.ob.a)); const w = TRI_WORLDS[tri.world];
          return `<div class="dream-box"><strong>🏊🚴🏃 Triathlon: ${w.emoji} ${h(w.name)}</strong><br><span class="hint">Swim: ${h(TRI.laneTarget('swim', tri.swim.stage + 1))} next · Bike: ${h(TRI.laneTarget('bike', tri.bike.stage + 1))} next · Run: your Run level${tri.learnToSwim ? ' · starting with swim lessons' : ''}</span></div>`; })() : ''}
        <p><strong>Prep Track:</strong> P${ps.n} ${h(ps.name)} (${h(ps.focus)})</p>
        ${normalize(ui.ob.a).longestEstimated ? `<p class="hint">Longest run estimated at about ${normalize(ui.ob.a).longestKm} km from its time.</p>` : ''}
        ${normalize(ui.ob.a).hybridRaces.length ? `<p class="hint">Races on record: ${h(normalize(ui.ob.a).hybridRaces.map(raceLabel).join(', '))}. They count toward your Hybrid placement.</p>` : ''}
        ${rb.active ? `<div class="banner warn"><strong>Rebuild Track first.</strong> Because you reported pain, you start with the Rebuild Track. Your level is saved and you come back to it afterwards.${rb.seeProfessional ? ' Please get it checked by a physio or doctor first.' : ''}</div>` : ''}
        <p class="hint">Coming in Phase 2: upload Strava/Garmin files or screenshots to verify this.</p>
      </div>`;
  } else body = st.body;
  $('#app').innerHTML = `
    <main class="onboarding">
      <div class="ob-top"><div class="brand">🏃 Stride Quest</div><div class="progress"><div style="width:${((i + 1) / steps.length) * 100}%"></div></div></div>
      ${returning}
      <form id="ob-form" class="card ob-card" autocomplete="off">
        ${!st.welcome && !st.result ? `<p class="eyebrow">Question ${i} of ${steps.length - 2}</p>` : ''}
        <h1>${h(st.title)}</h1>
        ${st.why ? `<p class="why">💡 ${h(st.why)}</p>` : ''}
        ${body}
        <div class="row end">${back}${st.result ? '<button type="button" class="btn primary" data-act="ob-finish">Start my journey</button>' : `<button type="submit" class="btn primary">${st.welcome ? "Let's start" : 'Next'}</button>`}</div>
      </form>
    </main>`;
}

// ---------- shell ----------
function render() {
  if (!S.placedAt || S.needsReassessment || ui.retake) { $('#app').className = ''; renderOnboarding(); renderModal(); return; }
  $('#app').className = 'shell';
  if (HYB.hasHybrid(S)) { const next = HYB.refreshHybrid(S, now(), E.weekKey(now())); if (next !== S) { S = next; store.save(S); } }
  const frame = document.querySelector('.worldmap');
  if (frame) ui.frameTop = frame.scrollTop; // keep the framed map's scroll across redraws
  const t = now();
  const views = { today: viewToday, map: viewMap, challenge: viewChallenge, coach: viewCoach, me: viewMe };
  $('#app').innerHTML = `
    <header class="top">
      <div class="brand">🏃 Stride Quest</div>
      <div class="chips"><span class="chip" title="Total XP">⚡ ${S.xp} XP</span><span class="chip" title="Day streak">🔥 ${E.dayStreak(S, t)}</span></div>
    </header>
    <main class="view view-${ui.tab}">${views[ui.tab]()}</main>
    <nav class="tabs">${[['today', '🏠', 'Today'], ['map', '🗺️', 'Map'], ['challenge', '🏆', 'Challenge'], ['coach', '💬', 'Coach'], ['me', '👤', 'Me']].map(([k, i, l]) =>
      `<button class="${ui.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</nav>`;
  queueModals();
  renderModal();
  if (ui.tab === 'coach') { const log = $('.chat-log'); if (log) log.scrollTop = log.scrollHeight; }
  if (ui.tab === 'map' && ui.mapMode === 'world') afterMapRender();
  if (ui.tab === 'map' && (ui.mapMode === 'tri' || ui.mapMode === 'hyb')) afterTriRender();
}

function queueModals() {
  if (ui.modal) return;
  const t = now();
  if (ui.incoming && !ui.mapRunning && !ui.intro) { openIncoming(); if (ui.modal) return; }
  if (!S.mode && E.returnCheck(S, t).needed && !ui.dismissed.has('return')) ui.modal = { type: 'return', step: 0 };
  else if (E.pendingChecks(S, t).length && !ui.dismissed.has('morning')) ui.modal = { type: 'morning' };
}

function banners() {
  const out = [];
  if (TRI.hasTri(S) && S.tri.learnToSwim && S.tri.swim.stage === 0) out.push('<div class="banner info"><strong>🏊 Learning to swim?</strong> Lessons with a coach are the fastest, safest start. Never swim alone; choose a lifeguarded pool.</div>');
  if (S.mode?.type === 'sick') out.push(`<div class="banner warn"><strong>🤒 Sick mode.</strong> ${S.mode.where === 'above' ? 'Only easy movement, and only if you feel like it.' : 'Full rest: no training.'} Your streak is frozen, nothing is lost. <button class="link" data-act="mode-end">I'm better</button></div>`);
  if (S.mode?.type === 'busy') out.push(`<div class="banner info"><strong>🧳 Busy mode.</strong> Only Key sessions this week; short versions count. <button class="link" data-act="mode-end">Back to normal</button></div>`);
  if (S.rebuild.active && S.rebuild.redFlag) out.push(`<div class="banner danger"><strong>Running is paused.</strong> You reported warning signs. Please see a physio or doctor. Gentle mobility is still open. <button class="link" data-act="cleared">I've been cleared</button></div>`);
  else if (S.rebuild.active) out.push(`<div class="banner warn"><strong>Rebuild Track · R${S.rebuild.stage + 1} ${h(REBUILD_STAGES[S.rebuild.stage].name)}.</strong> Your Run level ${S.rebuild.savedRunLevel} is saved. Keep pain at 2/10 or less.${S.rebuild.seeProfessional ? ' Not medical advice: a physio check is a good idea.' : ''}</div>`);
  if (S.refresher) out.push(S.refresher.reason === 'illness'
    ? `<div class="banner info"><strong>💛 Recovery plan.</strong> Easy health checks first, then you're back on your map${S.run.reclaim ? ` to reclaim Level ${S.run.reclaim}` : ''}. Feeling great early? The Prove It run fast-tracks you.</div>`
    : `<div class="banner info"><strong>Refresher course.</strong> Welcome back! Start with the Prove It run: hit it and you skip the rest.</div>`);
  const blockedAt = E.prepBlocksRun(S);
  if (blockedAt != null) out.push(`<div class="banner info"><strong>Gate passed!</strong> Level ${S.run.level + 1} unlocks at Prep stage P${blockedAt}. Keep going on the Prep Track.</div>`);
  if (S.run.reclaim) out.push(`<div class="banner reclaim">🔒 <strong>Reclaim:</strong> ${h(E.runLevel(S.run.reclaim).name)} (Level ${S.run.reclaim}) is waiting for you.</div>`);
  return out.join('');
}

const STATUS_ICON = { done: '✅', provisional: '⏳', open: '<span class="dot"></span>', locked: '🔒', slot: '🧱' };
const TYPE_LABEL = { run: 'Run', swim: 'Swim', bike: 'Bike', lift: 'Lift', engine: 'Engine', maint: 'Maintain', prep: 'Prep', slot: 'Prep slot', rest: 'Rest', gate: 'Gate', proveit: 'Prove It' };

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
  if (track === 'strength') return `🏋️ Strength · ${h(HYB.strengthStage(S).name)}`;
  if (track === 'engine') return `⚙️ Engine · ${h(HYB.engineStage(S).name)}`;
  if (track === 'hyGate') return `🏁 ${h(HYB.hybWorld(S).name)} race gate`;
  if (track === 'hyMaint') return S.hybrid.block.type === 'deload' ? '😮‍💨 Deload week' : `🔧 Maintaining ${S.hybrid.block.type === 'engine' ? 'strength' : 'engine'}`;
  if (track === 'swim') return `🏊 Swim · ${h(TRI.swimStage(S).name)} (${h(TRI.swimStage(S).target)})`;
  if (track === 'bike') return `🚴 Bike · ${h(TRI.bikeStage(S).name)} (${h(TRI.bikeStage(S).target)})`;
  if (track === 'triGate') return `🌉 ${h(TRI.triWorld(S).name)} transition gate`;
  return S.refresher?.reason === 'illness' ? '💛 Recovery plan' : '🔄 Refresher course';
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
        <p class="hint">${b === 'deload' ? '😮‍💨 Deload week' : b === 'engine' ? '⚡ Engine block' : '🏋️ Strength block'} · ${lim ? `limiter: ${HYB.LANE_ICON[lim.lane]} ${HYB.LANE_LABEL[lim.lane]}` : 'race gate open 🏁'} · Run Level ${lvl.n}</p>`; })()
    : mode === 'tri' ? (() => { const w = TRI.triWorld(S), lim = TRI.limiter(S);
      return `<p class="eyebrow">${hello} · Triathlon</p><h2>${w.emoji} ${h(w.name)}</h2>
        <p class="hint">${lim ? `limiter: ${TRI.LANE_ICON[lim.lane]} ${TRI.LANE_LABEL[lim.lane]}` : 'transition gate open 🌉'} · Run Level ${lvl.n}</p>`; })()
    : `<p class="eyebrow">${hello} · ${h(E.worldOf(lvl).name)}</p>
      <h2>Level ${lvl.n} · ${h(lvl.name)} <span class="stars">${'⭐'.repeat(S.run.stars[lvl.n] || 0)}</span></h2>
      <div class="bar"><div style="width:${pct}%"></div></div>
      <p class="hint">${prog.earned}/${prog.target} level XP · the gate test opens at ${prog.target}</p>`;
  const hero = `<section class="card hero" ${o(2)}>${heroMain}
      ${S.profile.dream ? dreamLine(S.profile.dream, S.run.level, true) : ''}
      ${mode !== 'world' ? `<button class="btn small hero-btn" data-act="goto-${mode}-map">Open my map</button>` : ''}
    </section>`;
  const simple = (S.profile.view || 'full') === 'simple';
  const toggle = `<div class="seg today-seg" role="tablist">${[['simple', '✨ Just next'], ['full', '📋 Full day']].map(([k, l]) =>
    `<button role="tab" class="${(simple ? 'simple' : 'full') === k ? 'on' : ''}" data-act="set-view" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (simple) {
    return `${toggle}<div class="simple">${banners()}${hero}${p.today}
      <button class="btn ghost wide" data-act="set-view" data-v="full">See my week and more ▾</button></div>`;
  }
  const boost = `<section class="card boost" ${o(3)}>
      <p class="eyebrow">Daily boost</p>
      <p class="boost-line">${h(M.dailyBoost(S, t))}</p>
      ${M.progressLine(S) ? `<p class="hint">${h(M.progressLine(S))}</p>` : ''}
    </section>`;
  const install = S.history.some(x => x.kind === 'session') ? installCard('today').replace('<section class="card install"', `<section class="card install" ${o(4)}`) : '';
  const levelSteps = `<section class="card" ${o(9)}>
      <h3>${trackTitle(track)}</h3>
      <ul class="steps">${steps.map(st => stepRow(track, st)).join('')}</ul>
    </section>`;
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
      <div class="col-main"><div ${o(1)}>${banners()}</div>${p.today}${p.week}${p.nextWeek}${levelSteps}</div>
      <div class="col-side">${hero}${boost}${install}${p.tracks}${daily}${modes}</div>
    </div>`;
}

const CLS_ICON = { long: '🛣️', hard: '⚡', test: '🏁', easy: '🏃', strength: '🧱', impact: '🦘', rest: '😴', done: '✅', swim: '🏊', bike: '🚴', upper: '💪' };

function todayParts(t) {
  const w = K.buildWeek(S, t);
  const todayItems = w.days[w.today].items.filter(i => !i.done);
  const nextDay = w.days.slice(w.today + 1).find(d => d.items.some(i => !i.done));
  const doneToday = w.days[w.today].items.filter(i => i.done);
  const itemBtn = it => it.sick || it.idx == null ? '' : `<button class="btn primary small" data-act="open-step" data-track="${it.track}" data-idx="${it.idx}">Start</button>`;
  const restDoneToday = S.daily[E.dayKey(t)]?.rest;
  const todayCard = todayItems.length
    ? `<section class="card next" style="order:5"><p class="eyebrow">Today · ${K.DAY_NAMES[w.today]}</p>
        ${todayItems.map(it => `<div class="today-item"><span class="cls">${CLS_ICON[it.cls] || '•'}</span><div><h3>${h(it.title)}</h3>${it.detail ? `<p class="hint">${h(it.detail)}</p>` : ''}
          <p class="tags">${it.keySession ? '<span class="tag-fit ok">Key</span>' : ''}${it.optional ? '<span class="tag-fit goal">Optional</span>' : ''}${it.track === 'prep' ? '<span class="tag-fit info">Prep</span>' : ''}</p></div>${itemBtn(it)}</div>`).join('')}
      </section>`
    : `<section class="card next rest-day" style="order:5"><p class="eyebrow">Today · ${K.DAY_NAMES[w.today]}</p>
        <h3>${doneToday.length ? 'Done for today ✅' : S.mode?.type === 'sick' ? 'Rest and recover 💤' : 'Rest day 😴'}</h3>
        <p class="hint">${nextDay ? `Next: ${nextDay.name} · ${h(nextDay.items.find(i => !i.done).title)}` : 'Fresh week starts Monday.'}</p>
        ${!doneToday.length && S.mode?.type !== 'sick' ? `<button class="btn ghost small" data-act="rest" ${restDoneToday ? 'disabled' : ''}>${restDoneToday ? 'Rest day logged ✓' : `😴 Log rest day (+${E.XP.restDay} XP)`}</button>` : ''}</section>`;
  const upcoming = w.days.slice(w.today).some(d => d.items.some(i => !i.done));
  const nw = upcoming ? null : K.buildWeek(S, w.monday + 7 * E.DAY + 6 * 36e5);
  const weekList = (wk, movable) => `<ul class="wk">${wk.days.map(d => `<li class="wk-day ${movable && d.today ? 'today' : ''} ${movable && d.past ? 'past' : ''} ${d.available ? '' : 'off'}">
        <span class="wk-name">${d.name}<small>${new Date(d.date).getDate()}</small></span>
        <div class="wk-items">${d.items.length ? d.items.map(it => `<div class="wk-item ${it.done ? 'done' : ''} ${it.optional ? 'opt' : ''}">
            <span>${it.done ? '✅' : CLS_ICON[it.cls] || '•'} ${h(it.title)}${it.keySession && !it.done ? ' <b class="key">KEY</b>' : ''}</span>
            ${movable && !it.done && !it.sick && it.idx != null ? `<button class="link small" data-act="move-item" data-key="${h(it.key)}">Move</button>` : ''}</div>`).join('')
          : `<span class="hint">${movable && d.past ? '–' : d.available ? 'Free' : 'Rest'}</span>`}</div></li>`).join('')}</ul>`;
  const week = `<section class="card week" style="order:6"><h3>This week</h3>
      ${weekList(w, true)}
      ${w.warnings.map(x => `<div class="fit-box warn">${h(x.text)}</div>`).join('')}
      ${nw ? '' : w.notes.map(n => `<p class="hint">${h(n)}</p>`).join('')}
      <button class="link small" data-act="edit-days">Change training days</button>
    </section>`;
  const nextWeek = nw ? `<section class="card week next-week" style="order:7"><h3>Next week <span class="hint">preview</span></h3>${weekList(nw, false)}
      ${nw.notes.map(n => `<p class="hint">${h(n)}</p>`).join('')}</section>` : '';
  const coming = [];
  const tracksCard = coming.length ? `<section class="card info-card" style="order:8"><p>${coming.map(k => k === 'hybrid' ? '🏋️ <strong>Hybrid track</strong>' : '🏊 <strong>Triathlon track</strong>').join(' and ')} ${coming.length > 1 ? 'are' : 'is'} being built. Your training already counts toward ${coming.length > 1 ? 'them' : 'it'}: carry-over will show the moment ${coming.length > 1 ? 'they open' : 'it opens'}.</p></section>` : '';

  return { today: todayCard, week, nextWeek, tracks: hybridCard() + triCard() };
}

function viewMap() {
  const prep = PREP_STAGES.map(p => `<li class="${p.n < S.prep.level || (p.n === 7 && S.prep.mastered) ? 'done' : p.n === S.prep.level ? 'current' : ''}"><strong>P${p.n}</strong> ${h(p.name)}<span>${h(p.focus)}</span></li>`).join('');
  const rebuild = S.rebuild.active ? `<section class="card"><h3>🩹 Rebuild Track</h3><ol class="ladder">${REBUILD_STAGES.map((r, i) => `<li class="${i < S.rebuild.stage ? 'done' : i === S.rebuild.stage ? 'current' : ''}"><strong>R${r.n}</strong> ${h(r.name)}<span>${h(r.focus)}</span></li>`).join('')}</ol></section>` : '';
  if ((ui.mapMode === 'tri' && !TRI.hasTri(S)) || (ui.mapMode === 'hyb' && !HYB.hasHybrid(S))) ui.mapMode = 'world';
  const multi = TRI.hasTri(S) || HYB.hasHybrid(S);
  const modes = [['world', multi ? '🏃 Run' : '🗺️ World map'], ...(HYB.hasHybrid(S) ? [['hyb', '🏋️ Hybrid']] : []), ...(TRI.hasTri(S) ? [['tri', '🏊 Tri']] : []), ['grid', multi ? '▦ Cards' : '▦ Level cards']];
  const toggle = `<div class="seg" role="tablist">${modes.map(([k, l]) =>
    `<button role="tab" class="${ui.mapMode === k ? 'on' : ''}" data-act="map-mode" data-mode="${k}">${l}</button>`).join('')}</div>`;
  const lvl = E.runLevel(S.run.level);
  const sideInfo = `<section class="card map-side-info"><p class="eyebrow">${E.worldOf(lvl).emoji} ${h(E.worldOf(lvl).name)}</p><h3>Level ${lvl.n} · ${h(lvl.name)}</h3>
      ${S.profile.dream ? dreamLine(S.profile.dream, S.run.level, true) : ''}<button class="btn primary small" data-act="open-level">Open level</button></section>`;
  if (ui.mapMode === 'hyb') {
    prepareLaneMap('hyb');
    return `${banners()}${toggle}<div class="map-cols"><div class="map-main">${renderLaneMap(S, ui, 'hyb')}</div><div class="map-side">${hybridCard(true)}</div></div>`;
  }
  if (ui.mapMode === 'tri') {
    const lim = TRI.limiter(S);
    const triSide = `<section class="card map-side-info"><p class="eyebrow">Triathlon · ${TRI.triWorld(S).emoji} ${h(TRI.triWorld(S).name)}</p><h3>${h(TRI.triWorld(S).race)}</h3>
      <p class="hint">${lim ? `${TRI.LANE_ICON[lim.lane]} <strong>${TRI.LANE_LABEL[lim.lane]}</strong> is your limiter.${lim.lane === 'run' ? ' Your running lives on the Run map.' : ''}` : '🌉 All three lanes are ready: the transition gate is open!'}</p>
      ${lim?.lane === 'run' ? '<button class="btn primary small" data-act="goto-run-map">Go to Run map</button>' : lim ? `<button class="btn primary small" data-act="lane-step" data-lane="${lim.lane}">Next ${lim.lane} session</button>` : '<button class="btn primary small" data-act="open-step" data-track="triGate" data-idx="0">Start the gate</button>'}</section>`;
    prepareLaneMap('tri');
    return `${banners()}${toggle}<div class="map-cols"><div class="map-main">${renderLaneMap(S, ui, 'tri')}</div><div class="map-side">${triSide}${triCard().replace('style="order:8"', '')}</div></div>`;
  }
  return `${banners()}${toggle}<div class="map-cols"><div class="map-main">${ui.mapMode === 'grid' ? levelGrid() : renderMap(S, ui)}</div><div class="map-side">${sideInfo}${rebuild}
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
function triFollow(y) {
  const frame = document.querySelector('.worldmap');
  if (!frame) return;
  const svg = frame.querySelector('svg');
  if (frame.scrollHeight > frame.clientHeight + 4) frame.scrollTop = Math.max(0, (y / LANE_H) * svg.getBoundingClientRect().height - frame.clientHeight * 0.5);
  else { const r = svg.getBoundingClientRect(); window.scrollTo(0, Math.max(0, r.top + window.scrollY + (y / LANE_H) * r.height - window.innerHeight * 0.5)); }
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
  playButton(seen ? '▶ See my progress' : '▶ Let\'s go!', 'play-lanes');
}

function playLanes(id, cfg, cur, all, seen, shown, moves, focusLane, focusY) {
  document.querySelector('.play-btn')?.remove();
  sfx.unlockAudio();
  // Animate every lane that moved at the same time; the camera follows the limiter (or the first mover).
  ui.laneAnimating = true; ui.mapScroll = false;
  const lead = moves.includes(focusLane) ? focusLane : moves[0];
  let left = moves.length;
  triFollow(nodePoint(cfg, lead, shown[lead]).y);
  setTimeout(() => moves.forEach(lane => moveCharacter(id, lane, shown[lane], cur[lane], {
    follow: lane === lead ? y => triFollow(y) : null,
    onDone: pt => {
      sfx.unlockAudio(); sfx.levelDing(cur[lane]);
      if (pt) celebrate(pt.x, pt.y - 70, !seen ? `${cfg.icon[lane]} Here I am!` : lane === 'run' ? `Level ${cur[lane]}! 🏃` : `${cfg.icon[lane]} Stage up! 🎉`);
      if (--left === 0) {
        ui.laneAnimating = false; ui.laneShown = { ...ui.laneShown, [id]: null };
        if (seen && cur.world > seen.world) worldCleared(id, seen.world);
        if (!seen) { confetti(); sfx.fanfare(); toast(`You're placed at ${cfg.current(S).emoji} ${cfg.current(S).name}! Let's go 💪`); }
        all[id] = cur; writeSeen(all);
        setTimeout(() => triFollow(focusY()), 1200);
      }
    },
  })), 600);
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
const followY = y => {
  const frame = document.querySelector('.worldmap');
  if (frame && frame.scrollHeight > frame.clientHeight + 4) {
    const svg = frame.querySelector('svg');
    frame.scrollTop = Math.max(0, (y / MAP_H) * svg.getBoundingClientRect().height - frame.clientHeight * 0.55);
  } else window.scrollTo(0, Math.max(0, mapPageY(y) - window.innerHeight * 0.55));
};

function afterMapRender() {
  if (ui.intro != null && !ui.mapRunning) {
    const placed = ui.intro;
    ui.intro = null; ui.mapRunning = true;
    followY(POINTS[0].y);
    setTimeout(() => playPlacementIntro(placed, {
      follow: followY,
      onDone: res => { ui.mapRunning = false; ui.avatarAt = placed; saveAvatar(placed); ui.mapPopup = placed; ui.modal = { type: 'placed', ...res }; renderModal(); },
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
    playButton(`▶ Run to Level ${S.run.level}`, 'play-run');
  } else if (levelChanged) saveAvatar(ui.avatarAt);
}

// A big Play button over the map; the animation starts only when the athlete taps it.
function playButton(label, act) {
  const frame = document.querySelector('.worldmap');
  if (!frame || frame.querySelector('.play-btn')) return;
  const b = document.createElement('button');
  b.className = 'play-btn'; b.dataset.act = act; b.textContent = label;
  frame.appendChild(b);
}

function playRun() {
  const from = ui.avatarAt, to = S.run.level;
  document.querySelector('.play-btn')?.remove();
  ui.mapRunning = true;
  sfx.unlockAudio();
  followY(POINTS[from].y);
  setTimeout(() => runAvatar(from, to, {
    follow: followY,
    onDone: () => { ui.mapRunning = false; ui.avatarAt = to; saveAvatar(to); ui.mapPopup = to; sfx.levelDing(to); render(); },
  }), 300);
}

function suggestionCards(m, mi) {
  if (!m.actions?.length) return '';
  return `<div class="suggestions">${m.actions.map((a, ai) => {
    const d = a.status === 'pending' ? ACT.describe(S, a, now()) : null;
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
  return `<section class="chat">
      <div class="chat-log">${msgs.map((m, mi) => `<div class="msg ${m.role}">${md(m.content)}${m.provider === 'offline' ? '<span class="tag">offline coach</span>' : ''}</div>${suggestionCards(m, mi)}`).join('')}
        ${ui.thinking ? `<div class="msg assistant typing"><span></span><span></span><span></span>${ui.slow ? '<em class="slow-note">Still thinking… the AI is busy, a few more seconds</em>' : ''}</div>` : ''}</div>
      <div class="quick">${['What should I do today?', 'I feel sore', 'Explain my level', 'How fast should easy runs be?'].map(q => `<button class="pill" data-act="quick" data-q="${h(q)}">${h(q)}</button>`).join('')}</div>
      <form id="chat-form" class="chat-input">
        ${canListen ? `<button type="button" class="mic ${ui.listening ? 'on' : ''}" data-act="mic" aria-label="Speak">🎤</button>` : ''}
        <input name="msg" placeholder="${ui.listening ? 'Listening…' : 'Message your coach'}" autocomplete="off" maxlength="1000">
        <button class="btn primary" type="submit" ${ui.thinking ? 'disabled' : ''}>Send</button>
      </form>
      ${canSpeak ? `<label class="choice small"><input type="checkbox" data-act="speak-toggle" ${ui.speakReplies ? 'checked' : ''}><span>Read replies aloud</span></label>` : ''}
      <p class="hint">⏱️ The coach runs on a free AI model, so replies can take a few seconds when it's busy. It can suggest changes; nothing changes until you tap Apply. Messages go to Google's Gemini AI to write replies. Not medical advice.</p>
    </section>`;
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
    <section class="card"><h3>Race category</h3>
      <div class="seg">${[['m', "Men's"], ['f', "Women's"], ['x', 'Prefer not']].map(([k, l]) => `<button class="${(S.profile.sex || '') === k ? 'on' : ''}" data-act="set-sex" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="hint">${S.profile.sex ? 'Times, lift targets and race standards use this category.' : '⚠️ Not set yet: standards use men\'s numbers until you pick.'}</p>
    </section>
    <section class="card"><h3>Theme</h3>
      <div class="seg">${[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['auto', '🖥️ Auto']].map(([k, l]) => `<button class="${theme() === k ? 'on' : ''}" data-act="set-theme" data-t="${k}">${l}</button>`).join('')}</div>
      <p class="hint">Auto follows your device's light/dark setting.</p>
    </section>
    <section class="card"><h3>Training</h3>
      <p>${(S.profile.tracks || ['run']).map(k => ({ run: '🏃 Running', hybrid: '🏋️ Hybrid', tri: '🏊 Triathlon' })[k] + (k === (S.profile.primary || 'run') && (S.profile.tracks || []).length > 1 ? ' (leads your week)' : '')).join(' · ')}</p>
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
    <section class="card"><h3>Your data</h3>
      <p class="hint">Progress is saved in this browser only. Export it to move to another device.</p>
      <div class="row wrap">
        <button class="btn" data-act="export">Export progress</button>
        <label class="btn">Import<input type="file" accept="application/json" data-act="import" hidden></label>
        <button class="btn" data-act="retake">Retake assessment</button>
        <button class="btn" data-act="sound">${sfx.soundOn() ? '🔊 Sound on' : '🔇 Sound off'}</button>
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

// One tap logs the session with a pain rating (simple view).
function painButtons() {
  return `<p class="q">Done? How did your body feel?</p><div class="pain-buttons">
    ${[[0, '😀', 'Great, no pain'], [2, '🙂', 'A little sore'], [4, '😐', 'Uncomfortable'], [6, '😣', 'It hurts']].map(([v, e, l]) =>
      `<button type="submit" class="pain-btn" name="painTap" value="${v}"><span>${e}</span>${l}</button>`).join('')}</div>`;
}

const MODALS = {
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
    const exs = (st.ex || []).map(id => EXERCISES[id] && `<li class="ex">
        <div><strong>${h(EXERCISES[id].name)}</strong> <span class="dose">${h(EXERCISES[id].dose)}</span></div>
        <ul>${EXERCISES[id].cues.map(c => `<li>${h(c)}</li>`).join('')}</ul>
        ${EXERCISES[id].alt && S.hybrid && S.hybrid.gym !== 'full' ? `<p class="hint">🔁 ${h(EXERCISES[id].alt)}</p>` : ''}
        <a href="${videoLink(id)}" target="_blank" rel="noopener">▶ Watch how</a></li>`).join('');
    const passQ = st.type === 'proveit' ? `<p class="q">Did you hit it?</p>${radio('passed', [['1', 'Yes, I hit it'], ['0', 'Not quite']], '1')}` : '';
    const raceQ = m.track === 'hyGate' && st.boss ? `<p class="q">Your race</p>
        <label class="field"><span>Race</span>${select('raceEvent', [['hyrox:open', 'Hyrox Open'], ['hyrox:pro', 'Hyrox Pro'], ['alphax:open', 'Alpha X Open'], ['alphax:base', 'Alpha X Base'], ['sim', 'Simulation (no race)']], 'hyrox:open')}</label>
        <label class="field"><span>Format</span>${select('raceFormat', [['solo', 'Solo'], ['pair', 'Pair / Doubles'], ['relay', 'Relay']], 'solo')}</label>
        ${timeField('raceTime', 'Finish time', '', 'h:mm:ss, e.g. 1:24:30')}<p class="hint">Stars come from your time against ${S.profile.sex ? ST.SEX_LABEL[S.profile.sex].toLowerCase() : 'your category\'s'} standards. Any finish counts.</p>`
      : m.track === 'triGate' && st.boss ? `${timeField('raceTime', 'Finish time', '', 'h:mm:ss, e.g. 5:42:10')}<p class="hint">Stars come from your time; 70.3 and full distance must be inside the official cut-off.</p>` : '';
    const gateNote = st.type === 'gate' ? `<p class="hint">${st.nextDay ? 'Gate result is confirmed by tomorrow morning\'s pain check (2/10 or less).' : 'Only log it once you have done the test.'}</p>` : '';
    return `<form id="step-form">
      <p class="eyebrow">${trackTitle(m.track)} · ${TYPE_LABEL[st.type]}</p>
      <h2>${h(st.title)}</h2>
      ${st.detail ? `<p>${h(st.detail)}</p>` : ''}
      ${exs ? `<ul class="exercises">${exs}</ul>` : ''}
      ${gateNote}${passQ}${raceQ}
      ${st.type === 'rest' ? '' : S.profile.view === 'simple' ? painButtons() : painSlider()}
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
  tab(el) { ui.tab = el.dataset.tab; ui.mapPopup = null; ui.frameTop = null; ui.mapScroll = ui.tab === 'map'; render(); if (ui.tab !== 'map') window.scrollTo(0, 0); },
  'ob-back'() { collectOb(); ui.ob.step--; renderOnboarding(); },
  'ob-finish'() {
    const fresh = !S.placedAt || ui.retake;
    sfx.unlockAudio(); // inside the click, so the intro can play sound
    const a = normalize(ui.ob.a);
    let { state, placed } = E.placeFromAnswers(S, a, now());
    state = K.setSchedule(state, a.days || K.defaultDays(3), +(a.longDay ?? 5));
    const tracks = a.tracks?.length ? a.tracks : ['run'];
    state.profile.tracks = tracks;
    state.profile.primary = tracks.includes(a.primary) ? a.primary : tracks[0];
    state.profile.view = a.view === 'full' ? 'full' : 'simple';
    state.tri = tracks.includes('tri') ? TRI.placeTri(state, a) : state.tri || null;
    state.hybrid = tracks.includes('hybrid') ? HYB.refreshHybrid({ ...state, hybrid: HYB.placeHybrid(state, a, now()) }, now(), E.weekKey(now())).hybrid : state.hybrid || null;
    const ai = a.dreamAI?.accepted ? a.dreamAI : null;
    state.profile.dream = { text: String(a.dream || '').trim().slice(0, 160), event: String(a.dreamEvent || ai?.event || '').trim().slice(0, 60),
      date: a.dreamDate || (/^\d{4}-\d{2}-\d{2}$/.test(ai?.date || '') ? ai.date : ''), summary: ai?.summary || '',
      target: (ai && targetFromAI(ai)) || dreamTarget(`${a.dream || ''} ${a.dreamEvent || ''}`) };
    ui.retake = false; ui.ob = { step: 0, a: {} }; ui.tab = 'today';
    if (fresh && state.profile.primary !== 'hybrid' && state.profile.primary !== 'tri') {
      // Runners: the avatar blitzes from START to the placed level.
      ui.tab = 'map'; ui.mapMode = 'world'; ui.avatarAt = 0; ui.intro = placed; ui.mapPopup = null;
    } else if (fresh) {
      // Hybrid / Tri first: open their map; the characters set off when the athlete taps Play.
      ui.tab = 'map'; ui.mapMode = state.profile.primary === 'hybrid' ? 'hyb' : 'tri'; ui.mapScroll = true; ui.frameTop = null;
      saveAvatar(placed);
    }
    commit(state);
    ui.mapMode = primaryMode();
    window.scrollTo(0, 0);
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
  cleared() { if (confirm('Confirm a physio or doctor has cleared you to train?')) commit(E.clearRedFlag(S, now())); },
  'report-pain'() { ui.modal = { type: 'rebuildPrompt' }; renderModal(); },
  export() { store.exportFile(S); },
  retake() { if (confirm('Retake the assessment? Your XP and badges stay; your level is set again.')) { ui.retake = true; ui.ob = { step: 0, a: { ...(S.answers || {}) } }; render(); } },
  reset() { if (confirm('Delete all progress in this browser?')) { store.clear(); localStorage.removeItem(CHAT_KEY); localStorage.removeItem(AVATAR_KEY); ui.avatarAt = null; ui.chat = []; S = E.newState(now()); render(); } },
  sound() { sfx.setSound(!sfx.soundOn()); if (sfx.soundOn()) { sfx.unlockAudio(); sfx.pop(); } render(); },
  quick(el) { sendChat(el.dataset.q); },
  'set-sex'(el) { S.profile.sex = el.dataset.v; commit(S); toast(`Using ${ST.SEX_LABEL[el.dataset.v].toLowerCase()} standards.`); },
  'play-run'() { playRun(); },
  'play-lanes'() { ui.lanePlay?.(); },
  'lane-focus'(el) {
    const cfg = LANE_MAPS[el.dataset.map], lane = el.dataset.lane;
    triFollow(nodePoint(cfg, lane, Math.min(cfg.value(S, lane), cfg.worlds.at(-1)[lane])).y);
    ui.lanePopup = { map: el.dataset.map, kind: 'lane', lane }; ui.frameTop = document.querySelector('.worldmap')?.scrollTop ?? null;
    const before = window.scrollY; render(); window.scrollTo(0, before);
  },
  'set-theme'(el) { try { localStorage.setItem(THEME_KEY, el.dataset.t); } catch { /* ignore */ } applyTheme(el.dataset.t); render(); },
  'lifts-ai'(el) { if (ui.ob.a.liftsAI) { ui.ob.a.liftsAI.accepted = el.dataset.v === '1'; renderOnboarding(); } },
  'dream-ai'(el) { if (ui.ob.a.dreamAI) { ui.ob.a.dreamAI.accepted = el.dataset.v === '1'; renderOnboarding(); } },
  'sugg-apply'(el) {
    const m = ui.chat[+el.dataset.m], a = m?.actions?.[+el.dataset.a];
    if (!a || a.status !== 'pending' || !ACT.describe(S, a, now())) return toast('That suggestion no longer fits your plan.');
    const label = ACT.describe(S, a, now()).label;
    const { state, message, open } = ACT.apply(S, a, now());
    a.status = 'applied'; a.label = label; saveChat();
    S = state; store.save(S);
    if (open) ui.modal = open;
    toast(message); render();
  },
  'sugg-skip'(el) { const a = ui.chat[+el.dataset.m]?.actions?.[+el.dataset.a]; if (a) { a.label = ACT.describe(S, a, now())?.label || ''; a.status = 'skipped'; saveChat(); render(); } },
  'lane-node'(el) { if (ui.laneAnimating) return; const p = { map: el.dataset.map, kind: el.dataset.kind, lane: el.dataset.lane, world: el.dataset.world, v: el.dataset.v }; ui.lanePopup = ui.lanePopup && JSON.stringify(ui.lanePopup) === JSON.stringify(p) ? null : p; render(); },
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

async function sendChat(text) {
  text = text.trim();
  if (!text || ui.thinking) return;
  ui.chat.push({ role: 'user', content: text });
  ui.thinking = true; ui.slow = false; render();
  const slowTimer = setTimeout(() => { if (ui.thinking) { ui.slow = true; if (ui.tab === 'coach') render(); } }, 4000);
  const history = ui.chat.slice(-12).map(({ role, content }) => ({ role, content }));
  const { reply, provider, actions = [] } = await askCoach(history, `${E.coachContext(S, now())}\n${ACT.weekContext(S, now())}`, S);
  const valid = actions.filter(a => ACT.describe(S, a, now()));
  ui.chat.push({ role: 'assistant', content: reply, provider, actions: valid.map(a => ({ ...a, status: 'pending' })) });
  clearTimeout(slowTimer);
  ui.thinking = false; ui.slow = false; saveChat(); render();
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

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.closest('#nc-form') && el.name !== 'msg' && el.name !== 'myName') { readDraft(); renderModal(); return; }
  if (el.closest('#ob-form') && (el.name?.startsWith('tr_') || el.name?.startsWith('hx_') || /Mode$/.test(el.name || '') || el.name === 'swimDist' || el.name === 'bikeAccess' || el.name === 'liftMode')) { collectOb(); renderOnboarding(); return; }
  if (el.closest('#tri-form') && (el.name === 'swimDist' || el.name === 'bikeAccess')) { ui.modal.a = { ...ui.modal.a, ...readTriForm(el.closest('form')) }; renderModal(); return; }
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
  if (f.id === 'ob-form') {
    collectOb();
    if (f.querySelector('[name^=tr_]') && !(ui.ob.a.tracks || []).length) return toast('Pick at least one thing you train for.');
    if (f.querySelector('[name^=d_]') && (ui.ob.a.days || K.defaultDays(3)).length < 2) return toast('Pick at least 2 training days.');
    const badTime = [...f.querySelectorAll('.time-field input[type=text]')].find(i => i.value.trim() && parseTime(i.value) == null);
    if (badTime) { badTime.focus(); return toast('Use mm:ss or h:mm:ss, for example 27:30 or 1:05:00.'); }
    if (f.querySelector('[name=dream]')) readDream();
    if (f.querySelector('[name=otherLifts]')) readLifts();
    ui.ob.step++; renderOnboarding(); window.scrollTo(0, 0); return;
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
  if (f.id === 'chat-form') { const v = f.msg.value; f.msg.value = ''; sendChat(v); return; }
  if (f.id === 'step-form') {
    const m = ui.modal;
    const tapped = e.submitter?.name === 'painTap' ? +e.submitter.value : null;
    const pain = tapped != null ? tapped : f.pain ? +f.pain.value : 0;
    const passed = f.passed ? f.passed.value === '1' : undefined;
    const raceTime = f.raceTime ? parseTime(f.raceTime.value) : null;
    if (f.raceTime && f.raceTime.value.trim() && raceTime == null) return toast('Use h:mm:ss for your finish time, e.g. 1:24:30.');
    const [ev, div] = (f.raceEvent?.value || '').split(':');
    const race = f.raceTime ? { event: ev || 'tri', division: div || null, format: f.raceFormat?.value || 'solo', time: raceTime } : undefined;
    const { state, outcome } = E.completeStep(S, m.track, m.idx, { pain, passed, race, now: t });
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

// A link opened while the app is already open (same tab) only changes the hash.
window.addEventListener('hashchange', () => {
  const inc = CH.decodeHash(location.hash);
  if (!inc) return;
  history.replaceState(null, '', location.pathname + location.search);
  ui.incoming = inc;
  if (!ui.modal) render();
});

$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && ['step', 'level', 'share', 'newChallenge', 'move', 'days', 'sick', 'addTri', 'addHyb'].includes(ui.modal?.type)) { ui.modal = null; renderModal(); } });

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

render();
