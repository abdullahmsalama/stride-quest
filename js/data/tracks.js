// Level data for the three tracks. Game rules live in engine.js; this file is content only.
//
// Step types:
//   run    - a running session (30 XP)
//   prep   - a strength / mobility / plyometric session (20 XP)
//   slot   - inside a run level: "do your next Prep Track step" (filled by completing one)
//   rest   - rest-day check-in (10 XP)
//   gate   - test that unlocks the next level (100 XP)
// Optional step fields:
//   prepReq   - minimum Prep stage for this step; below it the `alt` version is shown
//   nextDay   - gate result is provisional until the next-morning pain check is <= 2
//   boss      - boss level (timed effort)

export const WORLDS = [
  { id: 'base', name: 'Base Camp', theme: 'Foundation', emoji: '🏕️' },
  { id: '5k', name: '5K Stadium', theme: '5K', emoji: '🏟️' },
  { id: '10k', name: '10K Circuit', theme: '10K', emoji: '🛣️' },
  { id: 'half', name: 'Half Marathon Ridge', theme: 'Half marathon', emoji: '⛰️' },
  { id: 'full', name: 'Marathon Mountain', theme: 'Marathon', emoji: '🏔️' },
  { id: 'ultra', name: 'Ultra Frontier', theme: 'Ultra', emoji: '🌄' },
];

const slot = { type: 'slot', title: 'Prep Track step', detail: 'Do your next step on the Prep Track. It counts here too.' };
const rest = { type: 'rest', title: 'Rest day check-in', detail: 'Planned rest. Light walking or mobility is fine. Rest is part of the plan.' };

// weeklyMin = minutes of running a week this level expects (used for return-after-break maths).
export const RUN_LEVELS = [
  {
    n: 1, world: 'base', name: 'Starting Line', needsPrep: 0, weeklyMin: 60,
    criteria: 'Under 1 run a week',
    proveIt: 'Walk 25 min briskly, feeling fine',
    steps: [
      { type: 'run', title: 'Walk 20 min', detail: 'Easy, conversational pace.' },
      slot,
      { type: 'run', title: 'Walk 20 min + 5 x 30s gentle jog', detail: 'Spread the jogs through the walk.' },
      rest,
      { type: 'run', title: '5 x (1 min jog / 2 min walk)', detail: 'Warm up with 5 min walking first.' },
      slot,
      { type: 'run', title: '6 x (1 min jog / 2 min walk)', detail: 'Keep the jogs slow enough to talk.' },
      { type: 'gate', title: 'Gate: walk 30 min, pain-free', detail: 'Brisk walk, no pain during or after.', nextDay: true },
    ],
  },
  {
    n: 2, world: 'base', name: 'Walk-Jogger', needsPrep: 0, weeklyMin: 75,
    criteria: 'Can jog/walk for 20 min',
    proveIt: '6 x (2 min jog / 1 min walk) without struggling',
    steps: [
      { type: 'run', title: '6 x (2 min jog / 2 min walk)', detail: 'Easy pace. Walk breaks are the plan, not a failure.' },
      slot,
      { type: 'run', title: '8 x (2 min jog / 1 min walk)', detail: '' },
      rest,
      { type: 'run', title: '5 x (3 min jog / 1 min walk)', detail: '' },
      slot,
      { type: 'run', title: '4 x (5 min jog / 1 min walk)', detail: '' },
      { type: 'gate', title: 'Gate: jog 10 min without stopping', detail: 'Slow is fine. Just keep moving.', nextDay: true },
    ],
  },
  {
    n: 3, world: 'base', name: 'First Steps', needsPrep: 1, weeklyMin: 90,
    criteria: 'Jogs 10-15 min without stopping',
    proveIt: 'Jog 12 min without stopping',
    steps: [
      { type: 'run', title: 'Jog 12 min easy', detail: 'Plus 5 min walking warm-up and cool-down.' },
      slot,
      { type: 'run', title: '2 x 8 min jog, 1 min walk between', detail: '' },
      rest,
      { type: 'run', title: 'Jog 15 min easy', detail: '' },
      slot,
      { type: 'run', title: 'Jog 18 min easy', detail: '' },
      { type: 'gate', title: 'Gate: run 20 min without stopping', detail: '', nextDay: true },
    ],
  },
  {
    n: 4, world: '5k', name: '5K Finisher', needsPrep: 2, weeklyMin: 100,
    criteria: 'Has run 5 km',
    proveIt: 'Run 4 km continuous at easy pace',
    steps: [
      { type: 'run', title: 'Easy run 25 min', detail: 'Talking pace.' },
      slot,
      { type: 'run', title: 'Easy run 30 min', detail: '' },
      slot,
      { type: 'run', title: 'Run 4 km without stopping', detail: '' },
      rest,
      { type: 'run', title: 'Run 5 km, any pace', detail: '' },
      slot,
      { type: 'gate', title: 'Gate: 5K run, pain-free next day', detail: 'Any pace. Pain must be 2/10 or less the next morning.', nextDay: true },
    ],
  },
  {
    n: 5, world: '5k', name: '5K Chaser', needsPrep: 2, weeklyMin: 120,
    criteria: '5K under ~{min:35}, 2-3 runs a week',
    proveIt: 'Run 5 km continuous, comfortable',
    steps: [
      { type: 'run', title: 'Easy run 25 min', detail: '' },
      slot,
      { type: 'run', title: 'Easy 30 min + 4 x 20s strides', detail: 'Strides: build to ~85% speed, walk back.', prepReq: 3, alt: { title: 'Easy 30 min, last 2 min a bit quicker', detail: 'Strides unlock at Prep stage P3.' } },
      rest,
      { type: 'run', title: 'Easy 35 min (longest run of the week)', detail: '' },
      slot,
      { type: 'run', title: 'Easy 30 min + 6 x 20s strides', detail: '', prepReq: 3, alt: { title: 'Easy 30 min', detail: 'Strides unlock at Prep stage P3.' } },
      slot,
      { type: 'gate', title: 'Gate: 15-20 km in a week, two weeks in a row', detail: 'At least 3 runs each week.' },
    ],
  },
  {
    n: 6, world: '5k', name: '5K Hunter', needsPrep: 3, weeklyMin: 140,
    criteria: '5K under ~{min:30}',
    proveIt: '5 km at a steady effort, close to your old pace',
    steps: [
      { type: 'run', title: 'Easy 30 min + 6 x 20s strides', detail: '', prepReq: 3, alt: { title: 'Easy 30 min', detail: 'Strides unlock at Prep stage P3.' } },
      slot,
      { type: 'run', title: 'Tempo: 10 min easy, 10 min comfortably hard, 10 min easy', detail: 'Comfortably hard = short sentences only.' },
      rest,
      { type: 'run', title: 'Long easy run 45 min', detail: '' },
      slot,
      { type: 'run', title: 'Tempo: 2 x 8 min comfortably hard, 2 min jog between', detail: '' },
      slot,
      { type: 'gate', title: 'Boss: timed 5K', detail: 'Parkrun or solo. Under {min:30} for 3 stars.', boss: true, nextDay: true },
    ],
  },
  {
    n: 7, world: '10k', name: '10K Explorer', needsPrep: 4, weeklyMin: 160,
    criteria: 'Has run 8-10 km',
    proveIt: 'Run 7 km continuous, easy',
    steps: [
      { type: 'run', title: 'Easy 35 min + 6 strides', detail: '', prepReq: 3, alt: { title: 'Easy 35 min', detail: 'Strides unlock at Prep stage P3.' } },
      slot,
      { type: 'run', title: 'Hills: 6 x 45s uphill, walk down', detail: 'Strong but controlled.', prepReq: 4, alt: { title: 'Easy 35 min on a rolling route', detail: 'Hill repeats unlock at Prep stage P4.' } },
      rest,
      { type: 'run', title: 'Long run 8 km', detail: '' },
      slot,
      { type: 'run', title: 'Easy 40 min', detail: '' },
      { type: 'run', title: 'Long run 9 km', detail: '' },
      { type: 'gate', title: 'Gate: run 10 km', detail: 'Any pace.', nextDay: true },
    ],
  },
  {
    n: 8, world: '10k', name: '10K Racer', needsPrep: 4, weeklyMin: 180,
    criteria: '10K under ~{min:60}',
    proveIt: '8 km including 2 km at a steady, hard effort',
    steps: [
      { type: 'run', title: 'Intervals: 5 x 1 km at 10K effort, 2 min jog', detail: '', prepReq: 4, alt: { title: 'Tempo 20 min comfortably hard', detail: 'Intervals unlock at Prep stage P4.' } },
      slot,
      { type: 'run', title: 'Easy 45 min', detail: '' },
      rest,
      { type: 'run', title: 'Long run 12 km', detail: '' },
      slot,
      { type: 'run', title: 'Tempo 20 min', detail: '' },
      slot,
      { type: 'gate', title: 'Boss: timed 10K', detail: 'Under {min:60} for 3 stars.', boss: true, nextDay: true },
    ],
  },
  {
    n: 9, world: 'half', name: 'Half Hopeful', needsPrep: 5, weeklyMin: 220,
    criteria: 'Long run of 14 km or more',
    proveIt: 'Long run 12 km, easy',
    steps: [
      { type: 'run', title: 'Easy 50 min + strides', detail: '', prepReq: 3, alt: { title: 'Easy 50 min', detail: 'Strides unlock at Prep stage P3.' } },
      slot,
      { type: 'run', title: 'Long run 14 km', detail: '' },
      rest,
      { type: 'run', title: 'Tempo 2 x 12 min', detail: '' },
      slot,
      { type: 'run', title: 'Long run 16 km with fueling practice', detail: 'Try a gel or carbs every 30-40 min.' },
      slot,
      { type: 'gate', title: 'Gate: long run 18 km', detail: '', nextDay: true },
    ],
  },
  {
    n: 10, world: 'half', name: 'Half Hero', needsPrep: 5, weeklyMin: 250,
    criteria: 'Half marathon finished',
    proveIt: '14 km including 5 km at half-marathon effort',
    steps: [
      { type: 'run', title: '3 x 3 km at half-marathon pace', detail: '3 min easy jog between.' },
      slot,
      { type: 'run', title: 'Long run 18 km', detail: '' },
      rest,
      { type: 'run', title: 'Easy 50 min + 6 short hills', detail: '', prepReq: 4, alt: { title: 'Easy 50 min on a rolling route', detail: 'Hill repeats unlock at Prep stage P4.' } },
      slot,
      { type: 'run', title: 'Recovery week: 3 easy runs, ~30% less volume', detail: '' },
      slot,
      { type: 'gate', title: 'Boss: half marathon', detail: 'Race or solo. Hit your goal time for 3 stars.', boss: true, nextDay: true },
    ],
  },
  {
    n: 11, world: 'full', name: 'Marathon Apprentice', needsPrep: 6, weeklyMin: 300,
    criteria: 'Long run of 25 km or more, 40+ km a week',
    proveIt: 'Long run 20 km, easy',
    steps: [
      { type: 'run', title: 'Long run 25 km', detail: '' },
      slot,
      { type: 'run', title: 'Marathon pace: 3 x 5 km, 5 min easy between', detail: '' },
      rest,
      { type: 'run', title: 'Long run 28 km with fueling', detail: '' },
      slot,
      { type: 'run', title: 'Back-to-back: 15 km Saturday + 10 km Sunday', detail: '' },
      slot,
      { type: 'gate', title: 'Gate: long run 32 km', detail: '', nextDay: true },
    ],
  },
  {
    n: 12, world: 'full', name: 'Marathon Legend', needsPrep: 6, weeklyMin: 330,
    criteria: 'Marathon finished',
    proveIt: 'Long run 24 km with 8 km at marathon pace',
    steps: [
      { type: 'run', title: 'Long run 30 km with the last 10 km at goal pace', detail: '' },
      slot,
      { type: 'run', title: 'Intervals: 6 x 1 km, 2 min jog', detail: '', prepReq: 4, alt: { title: 'Tempo 25 min at marathon-to-half effort', detail: 'Intervals unlock at Prep stage P4.' } },
      rest,
      { type: 'run', title: 'Taper week 1: volume down ~25%', detail: '' },
      slot,
      { type: 'run', title: 'Taper week 2: volume down ~50%, a few strides', detail: '' },
      { type: 'gate', title: 'Boss: marathon', detail: 'Hit your goal for 3 stars.', boss: true, nextDay: true },
    ],
  },
  {
    n: 13, world: 'ultra', name: 'Ultra Legend', needsPrep: 6, weeklyMin: 360,
    criteria: 'Ultra finished or a 50K long run',
    proveIt: '3 h time on feet, trail if possible',
    steps: [
      { type: 'run', title: 'Trail long run 3 h with elevation', detail: '' },
      slot,
      { type: 'run', title: 'Night run 60 min', detail: 'Headlamp, known safe route, tell someone.' },
      rest,
      { type: 'run', title: 'Back-to-back trail long runs', detail: '' },
      slot,
      { type: 'run', title: 'Time on feet: 4 h', detail: 'Run/walk is fine.' },
      { type: 'gate', title: 'Boss: ultra or 50K', detail: '', boss: true, nextDay: true },
    ],
  },
];

// Prep Track stages P0-P7. `level` = the stage the runner is working on.
export const PREP_STAGES = [
  {
    n: 0, name: 'Wake Up', focus: 'Mobility',
    steps: [
      { type: 'prep', title: 'Mobility session A', ex: ['knee_to_wall', 'hip_flexor_stretch', 'cat_cow'] },
      { type: 'prep', title: 'Mobility session B', ex: ['hip_90_90', 'thoracic_rotation', 'leg_swings'] },
      { type: 'prep', title: 'Mobility session C', ex: ['knee_to_wall', 'hip_90_90', 'hip_flexor_stretch', 'leg_swings'] },
      { type: 'gate', title: 'Gate: knee-to-wall ~10 cm each side, no pain', ex: ['knee_to_wall'] },
    ],
  },
  {
    n: 1, name: 'Stand Strong', focus: 'Stability',
    steps: [
      { type: 'prep', title: 'Stability session A', ex: ['single_leg_balance', 'glute_bridge', 'calf_raise_double'] },
      { type: 'prep', title: 'Stability session B', ex: ['dead_bug', 'side_plank', 'clamshell'] },
      { type: 'prep', title: 'Stability session C', ex: ['single_leg_balance', 'glute_bridge', 'side_plank', 'calf_raise_double'] },
      { type: 'gate', title: 'Gate: single-leg balance 30s each leg', ex: ['single_leg_balance'] },
    ],
  },
  {
    n: 2, name: 'Build the Engine', focus: 'Strength',
    steps: [
      { type: 'prep', title: 'Strength session A', ex: ['calf_raise_single', 'split_squat', 'single_leg_bridge'] },
      { type: 'prep', title: 'Strength session B', ex: ['soleus_raise', 'step_down', 'copenhagen_short'] },
      { type: 'prep', title: 'Strength session C', ex: ['calf_raise_single', 'split_squat', 'step_down', 'side_plank'] },
      { type: 'gate', title: 'Gate: 20+ single-leg calf raises each leg, step-down without knee collapse', ex: ['calf_raise_single', 'step_down'] },
    ],
  },
  {
    n: 3, name: 'Learn to Land', focus: 'Landing mechanics',
    steps: [
      { type: 'prep', title: 'Landing session A', ex: ['snap_down', 'drop_squat', 'calf_raise_single'] },
      { type: 'prep', title: 'Landing session B', ex: ['stick_landing', 'snap_down', 'step_down'] },
      { type: 'prep', title: 'Landing session C', ex: ['stick_landing', 'single_leg_stick', 'soleus_raise'] },
      { type: 'gate', title: 'Gate: 10 quiet, controlled landings on 2 legs, then 1 leg', ex: ['stick_landing', 'single_leg_stick'] },
    ],
  },
  {
    n: 4, name: 'Learn to Take Off', focus: 'Low plyometrics',
    steps: [
      { type: 'prep', title: 'Take-off session A', ex: ['ankle_hops', 'jump_rope', 'a_skip'] },
      { type: 'prep', title: 'Take-off session B', ex: ['pogo_hops', 'a_skip', 'b_skip'] },
      { type: 'prep', title: 'Take-off session C', ex: ['pogo_hops', 'jump_rope', 'b_skip', 'calf_raise_single'] },
      { type: 'gate', title: 'Gate: 30s pogo hops, pain-free, steady rhythm', ex: ['pogo_hops'] },
    ],
  },
  {
    n: 5, name: 'Spring', focus: 'Two-leg plyometrics',
    steps: [
      { type: 'prep', title: 'Spring session A', ex: ['squat_jump', 'lateral_line_hops', 'a_skip'] },
      { type: 'prep', title: 'Spring session B', ex: ['broad_jump_stick', 'skip_height', 'pogo_hops'] },
      { type: 'prep', title: 'Spring session C', ex: ['squat_jump', 'broad_jump_stick', 'lateral_line_hops'] },
      { type: 'gate', title: 'Gate: 3 broad jumps stuck, stable landing', ex: ['broad_jump_stick'] },
    ],
  },
  {
    n: 6, name: 'Bounce', focus: 'Single-leg plyometrics',
    steps: [
      { type: 'prep', title: 'Bounce session A', ex: ['single_leg_hop', 'lateral_bound', 'single_leg_stick'] },
      { type: 'prep', title: 'Bounce session B', ex: ['bounding', 'step_up_jump', 'pogo_hops'] },
      { type: 'prep', title: 'Bounce session C', ex: ['single_leg_hop', 'bounding', 'lateral_bound'] },
      { type: 'gate', title: 'Gate: 10 single-leg hops each leg, pain-free', ex: ['single_leg_hop'] },
    ],
  },
  {
    n: 7, name: 'Elastic', focus: 'Reactive plyometrics',
    steps: [
      { type: 'prep', title: 'Elastic session A', ex: ['depth_drop_jump', 'fast_leg_drill', 'skip_height'] },
      { type: 'prep', title: 'Elastic session B', ex: ['hill_bounding', 'bounding', 'single_leg_hop'] },
      { type: 'prep', title: 'Elastic session C', ex: ['depth_drop_jump', 'hill_bounding', 'fast_leg_drill'] },
      { type: 'gate', title: 'Gate: self-check - quick, quiet, stable contacts through every drill', ex: ['depth_drop_jump'] },
    ],
  },
];

// Rebuild Track stages R1-R4 (index 0-3).
export const REBUILD_STAGES = [
  {
    n: 1, name: 'Calm it down', focus: 'Mobility + isometrics',
    steps: [
      { type: 'prep', title: 'Isometric session A', ex: ['calf_hold', 'wall_sit', 'bridge_hold'] },
      { type: 'prep', title: 'Gentle mobility', ex: ['knee_to_wall', 'hip_flexor_stretch', 'cat_cow'] },
      { type: 'prep', title: 'Isometric session B', ex: ['calf_hold', 'bridge_hold', 'wall_sit', 'hip_90_90'] },
      { type: 'gate', title: 'Gate: pain 2/10 or less during the session and the next morning', nextDay: true },
    ],
  },
  {
    n: 2, name: 'Build around it', focus: 'Strength around the painful area',
    steps: [
      { type: 'prep', title: 'Strength session A', ex: ['calf_raise_double', 'glute_bridge', 'split_squat'] },
      { type: 'prep', title: 'Strength session B', ex: ['soleus_raise', 'step_down', 'clamshell'] },
      { type: 'prep', title: 'Strength session C', ex: ['calf_raise_single', 'single_leg_bridge', 'step_down'] },
      { type: 'gate', title: 'Gate: walk 30 min pain-free', nextDay: true },
    ],
  },
  {
    n: 3, name: 'Land again', focus: 'Landing and hopping basics',
    steps: [
      { type: 'prep', title: 'Landing basics', ex: ['snap_down', 'drop_squat', 'single_leg_balance'] },
      { type: 'prep', title: 'Hopping basics', ex: ['ankle_hops', 'stick_landing', 'calf_raise_single'] },
      { type: 'prep', title: 'Landing + hops', ex: ['ankle_hops', 'single_leg_stick', 'pogo_hops'] },
      { type: 'gate', title: 'Gate: 10 single-leg hops each side, pain-free', ex: ['single_leg_hop'], nextDay: true },
    ],
  },
  {
    n: 4, name: 'Run again', focus: 'Run/walk return',
    steps: [
      { type: 'run', title: '10 x (1 min run / 1 min walk)', detail: 'Flat, soft surface if possible.' },
      { type: 'run', title: '8 x (2 min run / 1 min walk)', detail: '' },
      { type: 'run', title: '5 x (4 min run / 1 min walk)', detail: '' },
      { type: 'gate', title: 'Gate: 20 min continuous, pain 2/10 or less for 24h', nextDay: true },
    ],
  },
];

export const DAILY_ORDERS = [
  '10 min mobility',
  'Slept 7h+ last night',
  'Drank about 2 L of water',
  '20 bodyweight squats',
  '5 min foot and ankle work',
  'Walked 15 min',
  '2 min single-leg balance',
];
