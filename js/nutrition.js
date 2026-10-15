// Nutrition that follows the training: daily energy and macros, fuelling for sessions and races,
// and sense checks. Pure functions (no DOM). Evidence used:
//   RMR: ten Haaf & Weijs 2014 (best in the O'Neill et al. 2023 athlete meta-analysis), its fat-free-
//        mass form when body fat is known; Mifflin-St Jeor only for people who don't train.
//   Energy availability (EA) and REDs: IOC consensus 2023 (Mountjoy et al.).
//   Protein: ISSN 2017, Morton 2018, Helms 2014 (higher in a deficit). Carbs: Burke 2011 / Thomas 2016
//   (g/kg by training load), Jeukendrup (g/h during exercise). Fat: ACSM 2009 (>= 20% of energy).
//   Rates: Helms 2014, Garthe 2011 (0.5-1% bodyweight/week loss), Iraki 2019 (0.25-0.5%/week gain).
// Everything is an estimate (about ±10% for energy): the app says so and adjusts from weigh-ins.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, step = 1) => Math.round(v / step) * step;

// Typical body fat when it isn't known (only used to estimate fat-free mass for the EA check).
const TYPICAL_BF = { m: 18, f: 27, x: 22 };
export const ffmOf = p => p.kg * (1 - (p.bodyFat > 0 ? p.bodyFat : TYPICAL_BF[p.sex] || 22) / 100);

// ---------- resting energy ----------
export function rmr(p) {
  const male = p.sex === 'm' ? 1 : p.sex === 'f' ? 0 : 0.5;
  if (p.bodyFat > 0) return { kcal: 22.771 * ffmOf(p) + 484.264, method: 'ten Haaf (fat-free mass)' };
  if (p.trains !== false) return { kcal: 11.936 * p.kg + 587.728 * (p.heightCm / 100) - 8.129 * p.age + 191.027 * male + 29.279, method: 'ten Haaf' };
  const sexTerm = p.sex === 'm' ? 5 : p.sex === 'f' ? -161 : -78; // "prefer not to say": halfway
  return { kcal: 10 * p.kg + 6.25 * p.heightCm - 5 * p.age + sexTerm, method: 'Mifflin-St Jeor' };
}

// ---------- a day's training load ----------
// Session length from its title ("Easy 45 min", "Long run 12 km", "2 x 8 min jog…"), else a typical
// length for that kind of session. Running energy ~1.0 kcal/kg/km (Fletcher & MacIntosh 2017);
// other sessions by MET (approximate, from the Compendium of Physical Activities).
const DEFAULT_MIN = { easy: 35, long: 80, hard: 45, test: 40, strength: 45, impact: 25, swim: 45, bike: 60, upper: 40 };
const MET = { strength: 5, impact: 6, swim: 7, bike: 7, upper: 4.5, hard: 9, test: 10 };
const RUN_CLS = new Set(['easy', 'long', 'hard', 'test']);
export function sessionOf(it, easyPace) {
  const t = String(it.title || '');
  const mins = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:x\s*)?(\d+(?:\.\d+)?)?\s*min/gi)];
  let minutes = null, km = null;
  const xm = /(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*min/i.exec(t);
  if (xm) minutes = +xm[1] * +xm[2] * 1.4; // reps plus the easy bits between them
  else if (mins.length) minutes = +mins[0][1];
  const xk = /(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*km/i.exec(t), k = /(\d+(?:\.\d+)?)\s*km/i.exec(t);
  if (xk) km = +xk[1] * +xk[2] * 1.15; // reps plus the jogs between them
  else if (k) km = +k[1];
  const run = it.track === 'run' && RUN_CLS.has(it.cls) || RUN_CLS.has(it.cls) && !it.track;
  const quality = it.cls === 'hard' || it.cls === 'test';
  const pace = quality ? easyPace * 0.85 : easyPace;
  if (minutes == null && km != null && run) minutes = km * pace;
  const logged = it.minutes > 0;
  if (logged) minutes = +it.minutes;
  if (minutes == null) minutes = DEFAULT_MIN[it.cls] ?? (it.cls === 'rest' ? 0 : 30);
  if (run && km == null) km = minutes / pace;
  // A planned quality run also has a warm-up and cool-down (~20 min easy) that its title leaves out.
  if (run && quality && !logged) { minutes += 20; km += 20 / easyPace; }
  const mobility = it.track === 'prep' || /mobility|stretch/i.test(t) && it.cls === 'strength';
  return { minutes: Math.round(minutes), km: run ? Math.round(km * 10) / 10 : null, run, cls: it.cls, title: it.title, met: it.met || (mobility ? 3 : undefined), effort: it.effort, mobility, done: !!it.doneActivity };
}
export const LOADS = {
  rest: { label: 'Rest day', carbs: [3, 4] },
  light: { label: 'Light day', carbs: [4, 5] },
  moderate: { label: 'Moderate day', carbs: [5, 7] },
  hard: { label: 'Long or hard day', carbs: [6, 8] },
  very: { label: 'Very long day', carbs: [8, 10] },
};
export function dayLoad(items, p, rmrKcal) {
  const pace = p.easyPace > 3 ? p.easyPace : 6.5;
  const sessions = (items || []).filter(it => it.cls && it.cls !== 'rest' && !it.sick).map(it => sessionOf(it, pace));
  const perMin = rmrKcal / 1440;
  let exKcal = 0;
  for (const s of sessions) exKcal += s.run ? Math.max(0, p.kg * s.km * 1.0 - perMin * s.minutes) : Math.max(0, ((s.met || MET[s.cls] || 6) - 1) * p.kg * (s.minutes / 60));
  // Gentle sessions (walks, yoga, mobility: MET under 4) count half towards the day's load.
  const light = s => (s.met || MET[s.cls] || 6) < 4 && !s.run;
  const minutes = Math.round(sessions.reduce((a, s) => a + s.minutes * (light(s) ? 0.5 : 1), 0)), longest = Math.max(0, ...sessions.filter(s => !light(s)).map(s => s.minutes));
  // Load = how long, and how hard: 20-45 min of quality work is a moderate day (Burke 2011: 6-10 g/kg
  // is for 1-3 h of moderate-to-high work), a long run or 60+ min of quality is a hard one.
  const intense = sessions.some(s => s.cls === 'hard' || s.cls === 'test' || s.cls === 'long' || s.effort === 'hard');
  const load = !sessions.length ? 'rest' : minutes > 150 ? 'very' : minutes > 75 || (intense && minutes >= 60) || sessions.some(s => s.cls === 'long') ? 'hard' : minutes > 45 || intense ? 'moderate' : 'light';
  const strength = sessions.some(s => s.cls === 'strength' && !s.mobility);
  const label = strength && (load === 'light' || load === 'moderate') ? 'Strength day' : LOADS[load].label;
  return { sessions, minutes, longest, exKcal: Math.round(exKcal), load, label, strength };
}

// ---------- goals ----------
// Weekly rate as % of bodyweight. Leaner athletes lose slower (Helms 2014, Garthe 2011).
export function weeklyRate(goal, p) {
  if (goal?.type === 'cut') {
    const lean = p.bodyFat > 0 && p.bodyFat < (p.sex === 'f' ? 23 : 15);
    return goal.pace === 'steady' ? (lean ? 0.7 : 1.0) : 0.5;
  }
  if (goal?.type === 'gain') return goal.pace === 'steady' ? 0.5 : 0.25;
  return 0;
}
// Is a goal weight by a date realistic at a safe rate? Returns the realistic date if not.
export function goalCheck(p, goal, now) {
  if (!(goal?.weight > 0) || !goal.date) return null;
  const diff = goal.weight - p.kg, weeks = (new Date(`${goal.date}T12:00:00`) - now) / (7 * 864e5);
  if (Math.abs(diff) < 0.3) return { ok: true, weeks };
  const losing = diff < 0, max = losing ? (p.bodyFat > 0 && p.bodyFat < (p.sex === 'f' ? 23 : 15) ? 0.7 : 1.0) : 0.5;
  const needRate = (Math.abs(diff) / p.kg) * 100 / Math.max(weeks, 0.1);
  // The realistic date at the pace they picked (if it goes their way), else a middle safe pace.
  const own = weeklyRate(goal, p), pace = own > 0 && (goal.type === 'cut') === losing ? own : losing ? Math.min(max, 0.75) : 0.35;
  const safeWeeks = (Math.abs(diff) / p.kg) * 100 / pace;
  const realistic = new Date(now + safeWeeks * 7 * 864e5).toISOString().slice(0, 10);
  return { ok: weeks > 0 && needRate <= max, past: weeks <= 0, needRate: Math.round(needRate * 100) / 100, max, pace, weeks: Math.round(weeks), realistic, losing };
}

// ---------- daily targets ----------
const PAL = { sit: 1.4, feet: 1.55, physical: 1.8 }; // FAO/WHO/UNU 2004: sedentary 1.4-1.69, active 1.7-1.99
const RED = { f: 30, m: 25, x: 30 }; // kcal per kg FFM: the IOC "low EA" guide (lower and less certain in men)
export function targets(p, day, goal, opts = {}) {
  const R = rmr(p), ffm = ffmOf(p);
  // Daily-life PAL (from doubly labelled water studies) already includes digesting food; the extra food
  // eaten for training costs ~10% more to digest, so exercise energy is divided by 0.9.
  const tdee = R.kcal * (PAL[p.life] || 1.45) + day.exKcal / 0.9;
  // No deliberate deficit for under-18s (growth) or after REDs warning signs: held at maintenance.
  const held = goal?.type === 'cut' && (p.age < 18 ? 'young' : opts.reds ? 'reds' : null);
  const type = held ? 'maintain' : goal?.type || 'maintain', rate = held ? 0 : weeklyRate(goal, p);
  let kcal = type === 'cut' ? tdee - (rate / 100) * p.kg * 1100 : type === 'gain' ? tdee * (rate >= 0.5 ? 1.15 : 1.10) : tdee;
  const notes = [];
  // Never below the low-EA guide: a goal can't push the athlete into the REDs red zone.
  const floor = day.exKcal + RED[p.sex === 'm' ? 'm' : p.sex === 'f' ? 'f' : 'x'] * ffm;
  let floorApplied = false;
  if (kcal < floor) { kcal = floor; floorApplied = true; notes.push('floor'); }
  // Carbs fuel the work (g/kg by that day's load), never below 3 g/kg on a training day.
  const [c0, c1] = LOADS[day.load].carbs;
  let carbsPerKg = type === 'cut' ? c0 : (c0 + c1) / 2;
  if (day.load !== 'rest') carbsPerKg = Math.max(3, carbsPerKg);
  if (opts.raceLoad) carbsPerKg = Math.max(carbsPerKg, opts.raceLoad);
  // Protein: 1.6 g/kg; more with heavy strength work; 2.3-3.1 g/kg FFM in a deficit.
  let protein = (day.strength || p.strengthBlock ? 2.0 : 1.6) * p.kg;
  if (type === 'cut') protein = Math.max(protein, 2.5 * ffm);
  let carbs = carbsPerKg * p.kg;
  // Fat: what's left, but at least 20% of energy and 0.6 g/kg.
  let fat = (kcal - 4 * protein - 4 * carbs) / 9;
  const fatMin = Math.max((0.2 * kcal) / 9, 0.6 * p.kg);
  // In a deficit, make room by trimming carbs a little first (never below 3 g/kg on a training day,
  // 2.5 on a rest day), so the deficit survives; only then eat more.
  if (fat < fatMin && type !== 'gain' && !opts.raceLoad) {
    const minCarbs = (day.load === 'rest' ? 2.5 : 3) * p.kg;
    carbs = Math.max(minCarbs, carbs - ((fatMin - fat) * 9) / 4);
    fat = (kcal - 4 * protein - 4 * carbs) / 9;
  }
  let raised = false;
  if (fat < fatMin) { fat = Math.max(fatMin, (0.2 * (4 * protein + 4 * carbs)) / (9 * 0.8)); kcal = 4 * protein + 4 * carbs + 9 * fat; raised = true; notes.push('raised'); }
  // ...and at most 35% of energy (ACSM range 20-35%): anything above goes to carbs.
  const fatMax = (0.35 * kcal) / 9;
  let carbsG = carbs;
  if (fat > fatMax) {
    let spare = (fat - fatMax) * 9; fat = fatMax;
    if (type === 'gain') { const add = Math.min(spare, (2.2 * p.kg - protein) * 4); if (add > 0) { protein += add / 4; spare -= add; } }
    carbsG += spare / 4;
  }
  const ea = (kcal - day.exKcal) / ffm;
  const dose = (p.age >= 50 ? 0.4 : 0.3) * p.kg;
  return {
    kcal: round(kcal, 10), range: [round(kcal * 0.9, 10), round(kcal * 1.1, 10)], protein: round(protein), carbs: round(carbsG), fat: round(fat),
    carbsPerKg: Math.round((carbsG / p.kg) * 10) / 10, proteinDoses: clamp(Math.ceil(protein / dose), 4, 5), doseG: round(protein / clamp(Math.ceil(protein / dose), 4, 5), 5),
    tdee: round(tdee, 10), rmr: round(R.kcal, 10), method: R.method, ea: Math.round(ea), ffmEstimated: !(p.bodyFat > 0),
    floorApplied, raised, deficit: round(tdee - kcal, 10), rate, type, notes, held,
  };
}

// Hand-size portions per meal for people who'd rather not count (Precision Nutrition style: palm
// ~25 g protein, cupped hand ~25 g carbs, thumb ~8 g fat; approximate). Rounded to halves.
const half = v => Math.max(0.5, Math.round(v * 2) / 2);
export const portions = (t, meals = 4) => ({ meals, protein: half(t.protein / 25 / meals), carbs: half(t.carbs / 25 / meals), fat: half(t.fat / 8 / meals) });

// ---------- sense checks ----------
// The athlete's goal stays; these explain clashes and offer a one-tap safer option (apply).
export function checks(c) {
  const out = [];
  const cutting = c.goal?.type === 'cut';
  const racePhase = ['peak', 'taper', 'raceweek', 'race'].includes(c.phase);
  if (cutting && racePhase) out.push({ id: 'race', level: 'warn', title: c.phase === 'peak' ? 'Losing fat now clashes with your race prep' : 'A deficit this close to your race costs you speed',
    why: 'In the last weeks before a race your body needs fuel to absorb the hard sessions and top up glycogen. Dieting now usually means flat legs on race day; fat loss is easier after the race.', apply: { mode: 'perform', label: 'Fuel for the race, resume after' } });
  if (cutting && c.rebuild) out.push({ id: 'injury', level: 'warn', title: 'Healing needs energy',
    why: 'Tissue repair costs energy and protein. A deficit while you\'re on the Rebuild Track slows healing; eating at maintenance with plenty of protein gets you back sooner.', apply: { mode: 'maintain', label: 'Eat to heal, resume after' } });
  if (cutting && c.sick) out.push({ id: 'sick', level: 'warn', title: 'Not while you\'re ill',
    why: 'Your immune system needs energy. Eat normally until you\'re better; one week at maintenance won\'t undo your progress.', apply: { mode: 'maintain', label: 'Pause the deficit while ill' } });
  if (cutting && (c.spike || c.tired)) out.push({ id: 'tired', level: 'info', title: c.spike ? 'Big training week plus a deficit' : 'Feeling beaten up?',
    why: 'Hard training and a deficit together raise the risk of illness and injury. Today at maintenance, with carbs around your session, helps you recover.', apply: { mode: 'maintain', label: 'Maintenance today', today: true } });
  if (c.t.floorApplied) out.push({ id: 'ea-red', level: 'danger', title: 'Your goal would under-fuel your training',
    why: `At that deficit, energy left after training would be too low (low energy availability, which can harm hormones, bones and immunity: REDs). Your targets are held at a safe floor. For faster fat loss, ease the training or the pace, and consider a sports dietitian.` });
  else if (cutting && c.t.ea < 30) out.push({ id: 'ea-amber', level: 'warn', title: 'Low energy left after training', why: 'This deficit leaves little energy for your body after training. Fine for a short cut; keep it brief, watch for tiredness, poor sleep or missed periods.' });
  else if (!cutting && c.t.ea < 45 && ['hard', 'very'].includes(c.load)) out.push({ id: 'ea-low', level: 'info', title: 'Big day: eat up', why: 'On heavy days it\'s easy to under-eat without noticing. Hit your carbs and add a snack after training.' });
  if (c.goal?.type === 'gain' && racePhase) out.push({ id: 'gain-race', level: 'info', title: 'Gaining weight right before a race', why: 'A surplus now adds weight you carry on race day. Eating at maintenance until the race usually serves you better.', apply: { mode: 'perform', label: 'Maintain until the race' } });
  if (c.goalCheck && !c.goalCheck.ok) {
    const g = c.goalCheck, when = new Date(`${g.realistic}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    out.push({ id: 'goal-date', level: 'warn', title: g.past ? 'That goal date has passed' : 'That goal date is too fast',
      why: g.past ? `Pick a new date. At your pace (about ${g.pace}% of bodyweight a week) you'd get there around ${when}.`
        : `It needs about ${g.needRate}% of your bodyweight a week; a safe pace is up to ${g.max}%. At your pace (about ${g.pace}% a week) you'd get there around ${when}. ${g.losing ? 'Slower loss keeps your muscle and performance.' : 'Gaining slower keeps it mostly muscle, not fat.'}` });
  }
  if (c.t.held === 'young') out.push({ id: 'young', level: 'warn', title: 'No dieting while you\'re still growing',
    why: 'Under 18, your body needs extra energy to grow, and dieting raises the risk of injuries and health problems. Your targets are set to fuel you at your current weight. If weight matters for you, talk to a sports doctor or dietitian.' });
  if (c.reds) out.push({ id: 'reds', level: 'danger', title: 'Signs worth checking with a professional', why: `You ticked signs that can come from not eating enough for your training (REDs).${c.t.held === 'reds' ? ' Your fat-loss deficit is paused: targets are at maintenance until a check-in comes back clear.' : ''} Please talk to a sports doctor or dietitian. This app can't diagnose anything.` });
  return out;
}

// ---------- fuelling ----------
export function sessionFuel(minutes, kg, hot = false) {
  if (!(minutes > 0)) return null;
  const during = minutes < 60 ? { g: 0, text: 'Water is enough' } : minutes <= 120 ? { g: 30, text: 'Up to 30 g carbs per hour' }
    : minutes <= 150 ? { g: 60, text: 'Up to 60 g carbs per hour' } : { g: 90, text: '60-90 g carbs per hour (a glucose + fructose mix)' };
  return {
    before: minutes >= 60 ? `A carb-rich meal 2-4 h before (about ${round(kg * 1.5, 10)}-${round(kg * 2.5, 10)} g carbs), or a snack 1 h before` : 'Your normal meals are enough',
    during,
    fluids: minutes >= 60 ? `Drink to thirst, roughly 400-800 ml per hour${minutes > 120 || hot ? ', with some salt (about 0.5-1 g sodium per litre)' : ''}. Don't over-drink.` : 'Drink to thirst',
    after: `Protein soon after (about ${round(kg * 0.3, 5)} g) with carbs${minutes >= 90 ? `; if you train again within 8 h, about ${round(kg * 1, 10)} g carbs per hour for the first hours` : ''}.`,
  };
}
// Race week and race day, from the expected finish time (minutes).
export function raceFuel(expectedMin, kg) {
  if (!(expectedMin > 0)) return null;
  const long = expectedMin > 90;
  return {
    load: long ? `For the 36-48 h before: carb-load, about ${round(kg * 8, 10)}-${round(kg * 10, 10)} g carbs a day (rice, pasta, bread, juice), less fibre and fat` : 'No carb-loading needed: normal, carb-rich meals the day before',
    breakfast: `2-4 h before the start: a familiar carb-rich meal, about ${round(kg * 1.5, 10)}-${round(kg * 3, 10)} g carbs`,
    during: sessionFuel(expectedMin, kg).during.text,
    rules: ['Nothing new on race day: practise your race food in long sessions', 'Drink to thirst, and add salt if it\'s hot or long'],
  };
}
