// Hybrid track (Hyrox, Alpha X and similar races). `races`: the real races each world's gate stands for. Three lanes climb together: Strength and Engine
// ladders live here, the Run lane is the Run Track. Training runs in blocks: build one lane while
// maintaining the other, deload, switch, repeat.

// Strength ladder. Bodyweight ratios are guides for good-form sets, not maxes.
export const STRENGTH_STAGES = [
  { n: 0, name: 'Movement Basics', target: 'Bodyweight basics', steps: [
    { type: 'lift', title: 'Squat, hinge and push basics', ex: ['air_squat', 'hip_hinge', 'incline_pushup'] },
    { type: 'lift', title: 'Core and carry basics', ex: ['dead_bug', 'side_plank', 'suitcase_carry'] },
    { type: 'lift', title: 'Full body bodyweight circuit', ex: ['air_squat', 'incline_pushup', 'glute_bridge'] },
    { type: 'gate', title: 'Gate: 20 air squats, 10 incline push-ups, 30s plank, all with good form', ex: ['air_squat'] }] },
  { n: 1, name: 'Foundation', target: 'Dumbbell basics', steps: [
    { type: 'lift', title: 'Lower: goblet squat 3 x 10, DB Romanian deadlift 3 x 10', ex: ['goblet_squat', 'db_rdl'] },
    { type: 'lift', title: 'Upper: push-ups, DB rows, DB press', ex: ['pushup', 'db_row', 'db_press'] },
    { type: 'lift', title: 'Full body + farmers carry', ex: ['goblet_squat', 'db_row', 'farmers_carry'] },
    { type: 'gate', title: 'Gate: 3 x 10 goblet squat, 3 x 10 DB RDL, 10 push-ups', ex: ['goblet_squat', 'pushup'] }] },
  { n: 2, name: 'Barbell Basics', target: 'Squat 0.75 x bodyweight', parts: { squat: ['Back squat 4 x 6', 'back_squat'], hinge: ['Deadlift 4 x 5', 'deadlift'], hingeLight: ['Romanian deadlift 3 x 8', 'rdl'], single: ['Split squat 3 x 8 each', 'split_squat'], push: ['Overhead press 4 x 6', 'ohp'], bench: ['Bench press 3 x 8', 'db_bench'], pull: ['Pull-up progression 3 x 5', 'pullup'], row: ['DB row 3 x 10 each', 'db_row'], carry: ['Farmers carry 3 x 30 m', 'farmers_carry'] }, steps: [
    { type: 'lift', title: 'Back squat 4 x 6, split squat 3 x 8', ex: ['back_squat', 'split_squat'] },
    { type: 'lift', title: 'Deadlift 4 x 5, rows, plank', ex: ['deadlift', 'db_row'] },
    { type: 'lift', title: 'Overhead press 4 x 6, pull-up progression', ex: ['ohp', 'pullup'] },
    { type: 'gate', title: 'Gate: back squat 5 reps at 0.75 x bodyweight, deadlift 5 reps at 1 x bodyweight', ex: ['back_squat', 'deadlift'] }] },
  { n: 3, name: 'Strong Base', target: 'Squat 1 x bodyweight', parts: { squat: ['Squat 5 x 5', 'back_squat'], hinge: ['Deadlift 5 x 5', 'deadlift'], hingeLight: ['Romanian deadlift 3 x 8', 'rdl'], single: ['Walking lunges 3 x 20 m', 'walking_lunge'], push: ['Overhead press 4 x 5', 'ohp'], bench: ['Bench press 4 x 6', 'db_bench'], pull: ['Pull-ups 4 x max', 'pullup'], row: ['DB row 3 x 10 each', 'db_row'], carry: ['Farmers carry 4 x 40 m', 'farmers_carry'] }, steps: [
    { type: 'lift', title: 'Squat 5 x 5, walking lunges', ex: ['back_squat', 'walking_lunge'] },
    { type: 'lift', title: 'Deadlift 5 x 5, pull-ups', ex: ['deadlift', 'pullup'] },
    { type: 'lift', title: 'Press + rows + carries', ex: ['ohp', 'db_row', 'farmers_carry'] },
    { type: 'gate', title: 'Gate: squat 1 x bodyweight for 5, deadlift 1.25 x for 5, 3 strict pull-ups', ex: ['back_squat', 'deadlift', 'pullup'] }] },
  { n: 4, name: 'Strength Endurance', target: 'Carries + lunges', steps: [
    { type: 'lift', title: 'Heavy farmers carry 4 x 50 m', ex: ['farmers_carry'] },
    { type: 'lift', title: 'Sandbag lunges 4 x 25 m + wall balls 4 x 15', ex: ['sandbag_lunge', 'wall_ball'] },
    { type: 'lift', title: 'Sled push / pull 6 x 15 m (or swaps)', ex: ['sled_push', 'sled_pull'] },
    { type: 'gate', title: 'Gate: 100 m farmers carry unbroken (~40% bodyweight total) + 50 m lunges unbroken', ex: ['farmers_carry', 'sandbag_lunge'] }] },
  { n: 5, name: 'Strong Hybrid', target: 'Squat 1.25 x bodyweight', parts: { squat: ['Squat 5 x 3 heavy', 'back_squat'], hinge: ['Deadlift 5 x 3 heavy', 'deadlift'], hingeLight: ['Romanian deadlift 3 x 6', 'rdl'], single: ['Split squat 3 x 6 each', 'split_squat'], push: ['Overhead press 4 x 5', 'ohp'], bench: ['Bench press 4 x 5', 'db_bench'], pull: ['Weighted pull-ups 4 x 4', 'pullup'], row: ['Rows 3 x 8', 'db_row'], carry: ['Heavy sled push + pull 6 x 15 m', 'sled_push'] }, steps: [
    { type: 'lift', title: 'Squat 5 x 3 heavy, split squat', ex: ['back_squat', 'split_squat'] },
    { type: 'lift', title: 'Deadlift 5 x 3 heavy, pull-ups weighted', ex: ['deadlift', 'pullup'] },
    { type: 'lift', title: 'Heavy sled push and pull', ex: ['sled_push', 'sled_pull'] },
    { type: 'gate', title: 'Gate: squat 1.25 x bodyweight for 3, deadlift 1.5 x for 3', ex: ['back_squat', 'deadlift'] }] },
  { n: 6, name: 'Pro Strength', target: 'Deadlift 1.75 x bodyweight', parts: { squat: ['Squat 6 x 2 heavy', 'back_squat'], hinge: ['Deadlift 6 x 2 heavy', 'deadlift'], hingeLight: ['Romanian deadlift 3 x 6', 'rdl'], single: ['Split squat 3 x 6 each', 'split_squat'], push: ['Overhead press 5 x 3', 'ohp'], bench: ['Bench press 5 x 3', 'db_bench'], pull: ['Weighted pull-ups 5 x 3', 'pullup'], row: ['Rows 4 x 8', 'db_row'], carry: ['Pro-weight sled + wall balls', 'sled_push'] }, steps: [
    { type: 'lift', title: 'Squat 6 x 2 heavy', ex: ['back_squat'] },
    { type: 'lift', title: 'Deadlift 6 x 2 heavy', ex: ['deadlift'] },
    { type: 'lift', title: 'Pro-weight sled + wall balls', ex: ['sled_push', 'wall_ball'] },
    { type: 'gate', title: 'Gate: deadlift 1.75 x bodyweight for 3, squat 1.5 x for 3, 8 strict pull-ups', ex: ['deadlift', 'back_squat', 'pullup'] }] },
  { n: 7, name: 'Elite Strength', target: 'Deadlift 2 x bodyweight', parts: { squat: ['Squat wave 3-2-1 heavy, then 3 x 3 back-off', 'back_squat'], hinge: ['Deadlift 5 x 2 heavy', 'deadlift'], hingeLight: ['Romanian deadlift 3 x 5', 'rdl'], single: ['Heavy sandbag lunges 4 x 25 m', 'sandbag_lunge'], push: ['Overhead press 5 x 3', 'ohp'], bench: ['Bench press 5 x 3', 'db_bench'], pull: ['Weighted pull-ups 4 x 5', 'pullup'], row: ['Rows 4 x 8', 'db_row'], carry: ['Elite-weight sled push / pull', 'sled_push'] }, steps: [
    { type: 'lift', title: 'Squat wave: 3-2-1 heavy, then 3 x 3 back-off', ex: ['back_squat'] },
    { type: 'lift', title: 'Deadlift 5 x 2 heavy + weighted pull-ups 4 x 5', ex: ['deadlift', 'pullup'] },
    { type: 'lift', title: 'Elite-weight sled push / pull + heavy sandbag lunges', ex: ['sled_push', 'sled_pull', 'sandbag_lunge'] },
    { type: 'gate', title: 'Gate: deadlift 2 x bodyweight for 2, squat 1.75 x for 2, 12 strict pull-ups', ex: ['deadlift', 'back_squat', 'pullup'] }] },
  { n: 8, name: 'World-Class Strength', target: 'Squat 2 x bodyweight', steps: [
    { type: 'lift', title: 'Squat singles at 90-95%, then speed sets 6 x 2', ex: ['back_squat'] },
    { type: 'lift', title: 'Deadlift singles at 90-95% + heavy carries', ex: ['deadlift', 'farmers_carry'] },
    { type: 'lift', title: 'Strength under fatigue: heavy sled after a 1 km run', ex: ['sled_push', 'compromised_run'] },
    { type: 'gate', title: 'Gate: squat 2 x bodyweight for 1, deadlift 2.25 x for 1, 15 strict pull-ups', ex: ['back_squat', 'deadlift', 'pullup'] }] },
];

// Engine ladder: aerobic base, ergs, threshold, then running on tired legs.
export const ENGINE_STAGES = [
  { n: 0, name: 'Aerobic Start', target: '20 min cardio', steps: [
    { type: 'engine', title: 'Easy cardio 15 min (any machine)', ex: ['easy_erg'] },
    { type: 'engine', title: 'Rowing technique + 10 min easy', ex: ['row_tech'] },
    { type: 'engine', title: 'SkiErg technique + 10 min easy', ex: ['ski_tech'] },
    { type: 'gate', title: 'Gate: 20 min continuous easy cardio', ex: ['easy_erg'] }] },
  { n: 1, name: 'Erg Basics', target: '1000 m row', steps: [
    { type: 'engine', title: 'Row 5 x 250 m steady, 1 min rest', ex: ['row_tech'] },
    { type: 'engine', title: 'SkiErg 5 x 250 m steady, 1 min rest', ex: ['ski_tech'] },
    { type: 'engine', title: 'Mixed 25 min easy: row, ski, bike', ex: ['easy_erg'] },
    { type: 'gate', title: 'Gate: 1000 m row and 1000 m SkiErg, steady and smooth', ex: ['row_tech', 'ski_tech'] }] },
  { n: 2, name: 'Threshold Base', target: '30 min steady mix', steps: [
    { type: 'engine', title: 'Threshold: 3 x 8 min (run or erg), 2 min easy', ex: ['threshold_mix'] },
    { type: 'engine', title: 'Erg intervals: 6 x 500 m, 1 min rest', ex: ['erg_intervals'] },
    { type: 'engine', title: 'Long easy aerobic 45 min', ex: ['easy_erg'] },
    { type: 'gate', title: 'Gate: 30 min mixed (run / row / ski) at steady effort', ex: ['threshold_mix'] }] },
  { n: 3, name: 'Compromised Running', target: 'Run after stations', steps: [
    { type: 'engine', title: '4 x (800 m run + 20 wall balls)', ex: ['compromised_run', 'wall_ball'] },
    { type: 'engine', title: '4 x (1 km run + 500 m row)', ex: ['compromised_run', 'row_tech'] },
    { type: 'engine', title: 'EMOM 20: burpee broad jumps / lunges / ski', ex: ['burpee_broad_jump', 'sandbag_lunge', 'ski_tech'] },
    { type: 'gate', title: 'Gate: 4 x (1 km run + one station), unbroken', ex: ['compromised_run'] }] },
  { n: 4, name: 'Race Engine', target: 'Half race simulation', steps: [
    { type: 'engine', title: 'Stations at race pace, 2 rounds', ex: ['race_sim'] },
    { type: 'engine', title: 'Threshold run 3 x 2 km', ex: ['threshold_mix'] },
    { type: 'engine', title: '6 x (1 km run + station), easy-moderate', ex: ['compromised_run', 'race_sim'] },
    { type: 'gate', title: 'Gate: half race simulation (4 x 1 km run + 4 stations)', ex: ['race_sim'] }] },
  { n: 5, name: 'Fast Engine', target: 'Full simulation', steps: [
    { type: 'engine', title: 'Run 8 x 1 km at goal race pace, 90s rest', ex: ['threshold_mix'] },
    { type: 'engine', title: 'Stations back-to-back at race weights', ex: ['race_sim'] },
    { type: 'engine', title: 'Long aerobic 60-75 min', ex: ['easy_erg'] },
    { type: 'gate', title: 'Gate: full race simulation, steady pacing', ex: ['race_sim'] }] },
  { n: 6, name: 'Pro Engine', target: 'Full sim under goal time', steps: [
    { type: 'engine', title: 'Race-pace splits: 4 x (2 km + 2 stations)', ex: ['race_sim', 'compromised_run'] },
    { type: 'engine', title: 'VO2 intervals: 6 x 3 min hard', ex: ['erg_intervals'] },
    { type: 'engine', title: 'Pro-weight station practice', ex: ['race_sim'] },
    { type: 'gate', title: 'Gate: full simulation under your goal time', ex: ['race_sim'] }] },
  { n: 7, name: 'Elite Engine', target: 'Elite-pace simulation', steps: [
    { type: 'engine', title: 'Run 10 x 1 km at elite race pace, 60s rest', ex: ['threshold_mix'] },
    { type: 'engine', title: 'Stations at Pro weights, race pace, 3 rounds', ex: ['race_sim'] },
    { type: 'engine', title: 'Double day: easy 45 min + VO2 6 x 3 min', ex: ['easy_erg', 'erg_intervals'] },
    { type: 'gate', title: 'Gate: full Pro-weight simulation at elite pace, negative split', ex: ['race_sim'] }] },
  { n: 8, name: 'World-Class Engine', target: 'Championship simulation', steps: [
    { type: 'engine', title: 'Race-pace 8 x (1 km run + station), no slowdown', ex: ['compromised_run', 'race_sim'] },
    { type: 'engine', title: 'Lactate threshold 4 x 10 min (run or erg)', ex: ['threshold_mix'] },
    { type: 'engine', title: 'Long aerobic 90 min + strides', ex: ['easy_erg'] },
    { type: 'gate', title: 'Gate: championship simulation, every run within 5 s of goal pace', ex: ['race_sim'] }] },
];

// Worlds. Each needs a Strength stage, an Engine stage and a Run Track level ("stages cleared").
export const HYBRID_WORLDS = [
  { n: 0, id: 'floor', name: 'Gym Floor', emoji: '🏋️', strength: 1, engine: 1, run: 2, race: 'Mini hybrid',
    gate: { title: 'Gate: mini hybrid, 4 x (500 m run + 10 wall balls or 10 lunges)', detail: 'Any pace, steady breathing.' } },
  { n: 1, id: 'square', races: [['alphax', 'Alpha X Base']],  name: 'Station Square', emoji: '🧭', strength: 2, engine: 2, run: 3, race: 'Half simulation',
    gate: { title: 'Gate: Alpha X Base, or a half simulation: 4 x (1 km run + a station)', detail: 'Alpha X Base: 10 x (400 m run + station) with lighter weights; first-timers often take 60+ min.' } },
  { n: 2, id: 'arena', races: [['alphax', 'Alpha X Pairs'], ['hyrox', 'Hyrox Doubles']],  name: 'Doubles Arena', emoji: '🤝', strength: 3, engine: 3, run: 4, race: 'Doubles / Pairs or Relay race',
    gate: { title: 'Boss: a Doubles / Pairs or Relay race (or full simulation with a partner)', detail: 'Alpha X Pairs (run every lap together, split the stations) or Relay (each does a section); Hyrox Doubles or Relay. Use your category\'s official weights.', boss: true } },
  { n: 3, id: 'solo', races: [['alphax', 'Alpha X Open'], ['hyrox', 'Hyrox Open']],  name: 'Solo Stadium', emoji: '🏟️', strength: 4, engine: 4, run: 6, race: 'Solo race (Open)',
    gate: { title: 'Boss: your first solo race', detail: 'Alpha X Open solo: 10 x (800 m run + station), 8 km running, first-timers often take 90+ min; or Hyrox Open. Use your category\'s official weights.', boss: true } },
  { n: 4, id: 'strong', races: [['alphax', 'Alpha X Open'], ['hyrox', 'Hyrox Open']],  name: 'Strong Finish', emoji: '🔥', strength: 5, engine: 5, run: 7, race: 'Solo race at goal time',
    gate: { title: 'Boss: a solo race at your goal time', detail: 'Pace the runs, stay smooth on the stations.', boss: true } },
  { n: 5, id: 'pro', races: [['hyrox', 'Hyrox Pro']],  name: 'Pro League', emoji: '👑', strength: 6, engine: 6, run: 8, race: 'Pro division',
    gate: { title: 'Boss: Pro division race', detail: 'Hyrox Pro or the heaviest division of your race. Check its official weights.', boss: true } },
  { n: 6, id: 'elite', races: [['hyrox', 'Hyrox Pro, qualifying time']],  name: 'Elite Series', emoji: '💎', strength: 7, engine: 7, run: 10, race: 'Pro race at a podium time',
    gate: { title: 'Boss: a Pro race at an age-group podium or qualifying time', detail: 'Hyrox Pro (or your race\'s heaviest division) finished in a qualifying time for its championships.', boss: true } },
  { n: 7, id: 'worlds', races: [['hyrox', 'Hyrox World Champs · Elite 15']],  name: 'World Championships', emoji: '🌍', strength: 8, engine: 8, run: 11, race: 'Championship / Elite race',
    gate: { title: 'Boss: race the World Championships or an Elite race', detail: 'The top of the ladder: Hyrox World Championships, Elite 15, or your sport\'s championship.', boss: true } },
];

// Maintenance and deload sessions (generated each week by the block).
export const MAINTENANCE = {
  strength: [
    { type: 'maint', title: 'Strength maintenance A: squat 3 x 3 heavy + pull-ups', detail: 'Keep the load, keep the volume low (about 40 min).', ex: ['back_squat', 'pullup'] },
    { type: 'maint', title: 'Strength maintenance B: deadlift 3 x 3 heavy + press', detail: 'Heavy but short. Leave 1-2 reps in the tank.', ex: ['deadlift', 'ohp'] },
  ],
  engine: [
    { type: 'maint', title: 'Engine maintenance: 30 min easy + 6 x 1 min hard', detail: 'Run or erg. Keeps your aerobic engine ticking.', ex: ['easy_erg', 'erg_intervals'] },
    { type: 'maint', title: 'Engine maintenance: 4 x (800 m run + station)', detail: 'Moderate effort, keeps race feel.', ex: ['compromised_run'] },
  ],
  deload: [
    { type: 'maint', title: 'Deload lift: main lifts 2 x 5 at about 60%', detail: 'Light and crisp. Recovery is the goal this week.', ex: ['back_squat', 'deadlift'] },
    { type: 'maint', title: 'Deload engine: easy 30 min + mobility', detail: 'Conversational pace only.', ex: ['easy_erg'] },
    { type: 'maint', title: 'Deload: mobility and easy walk', detail: 'Loosen up, sleep well.', ex: ['hip_90_90', 'thoracic_rotation'] },
  ],
};

export const BLOCK_WEEKS = 6;

export const HYBRID_EXERCISES = {
  air_squat: { name: 'Air squat', dose: 'as set', cues: ['Feet shoulder-width', 'Hips back and down', 'Knees track over toes'], search: 'air squat proper form' },
  hip_hinge: { name: 'Hip hinge with dowel', dose: '3 x 10', cues: ['Dowel touches head, back, tailbone', 'Push hips back', 'Neutral spine'], search: 'hip hinge dowel drill' },
  incline_pushup: { name: 'Incline push-up', dose: '3 x 8-12', cues: ['Hands on a bench', 'Body in one line', 'Chest to the bench'], search: 'incline push up form' },
  pushup: { name: 'Push-up', dose: '3 x max good reps', cues: ['Elbows about 45 degrees', 'Brace the core', 'Full range'], search: 'push up proper form' },
  suitcase_carry: { name: 'Suitcase carry', dose: '4 x 30 m each side', cues: ['One weight, stand tall', 'Do not lean', 'Slow steps'], search: 'suitcase carry exercise' },
  goblet_squat: { name: 'Goblet squat', dose: 'as set', cues: ['Weight at the chest', 'Elbows inside knees at the bottom', 'Drive up through mid-foot'], search: 'goblet squat form' },
  db_rdl: { name: 'Dumbbell Romanian deadlift', dose: 'as set', cues: ['Soft knees, hips back', 'Weights close to legs', 'Feel the hamstrings'], search: 'dumbbell romanian deadlift form' },
  db_row: { name: 'Dumbbell row', dose: '3 x 10 each side', cues: ['Flat back', 'Pull elbow to hip', 'Control the lowering'], search: 'one arm dumbbell row form' },
  db_press: { name: 'Dumbbell press', dose: '3 x 10', cues: ['Ribs down', 'Press straight up', 'Control down'], search: 'dumbbell shoulder press form' },
  farmers_carry: { name: 'Farmers carry', dose: 'as set', cues: ['Tall posture, shoulders down', 'Short quick steps', 'Grip hard, breathe'], search: 'farmers carry technique hyrox' },
  back_squat: { name: 'Back squat', dose: 'as set', cues: ['Brace before each rep', 'Depth you can control', 'Knees out, chest proud'], search: 'back squat form beginner', alt: 'No barbell? Goblet squat or a heavy dumbbell front squat, or a split squat holding dumbbells. No weights: a slow tempo split squat with a loaded backpack.' },
  deadlift: { name: 'Deadlift', dose: 'as set', cues: ['Bar over mid-foot', 'Lats tight, push the floor away', 'Hips and shoulders rise together'], search: 'deadlift form beginner', alt: 'No barbell? Dumbbell or kettlebell Romanian deadlift, or single-leg RDL. No weights: backpack RDL and hip thrusts.' },
  db_bench: { name: 'Bench press (barbell or dumbbells)', dose: 'as set', cues: ['Shoulder blades squeezed back', 'Feet planted', 'Lower to the chest with control'], search: 'bench press form', alt: 'No bench? Floor press with dumbbells, or push-ups.' },
  rdl: { name: 'Romanian deadlift', dose: 'as set', cues: ['Soft knees, hips back', 'Bar slides down the thighs', 'Stop when the hamstrings stretch'], search: 'romanian deadlift form', alt: 'Dumbbells or a kettlebell work the same.' },
  arms: { name: 'Curls + triceps extensions', dose: '3 x 10-12 each', cues: ['Elbows still', 'Slow on the way down', 'Stop 1-2 reps before failure'], search: 'dumbbell curl triceps extension form' },
  ohp: { name: 'Overhead press', dose: 'as set', cues: ['Squeeze glutes', 'Bar close to the face', 'Head through at the top'], search: 'overhead press form', alt: 'No barbell? Dumbbell or kettlebell press, or pike push-ups.' },
  pullup: { name: 'Pull-up (or progression)', dose: 'as set', cues: ['Bands or negatives if needed', 'Full hang to chin over bar', 'No swinging'], search: 'pull up progression beginner' },
  walking_lunge: { name: 'Walking lunge', dose: 'as set', cues: ['Long step, back knee near the floor', 'Torso tall', 'Push through the front heel'], search: 'walking lunge form' },
  sandbag_lunge: { name: 'Sandbag lunge', dose: 'as set', cues: ['Bag high on the shoulders', 'Back knee touches lightly', 'Steady rhythm'], search: 'sandbag lunges hyrox technique', alt: 'No sandbag? Dumbbells or a loaded backpack.' },
  wall_ball: { name: 'Wall ball', dose: 'as set', cues: ['Full squat, ball at chin', 'Drive with the legs', 'Catch and go into the next rep'], search: 'wall ball technique hyrox', alt: 'No wall ball? Thrusters with a dumbbell.' },
  sled_push: { name: 'Sled push', dose: 'as set', cues: ['Arms locked, low body angle', 'Short powerful steps', 'Keep moving'], search: 'sled push technique hyrox', alt: 'No sled? Heavy prowler, plate push on turf, or uphill walking lunges.' },
  sled_pull: { name: 'Sled pull', dose: 'as set', cues: ['Sit back, hand over hand', 'Use the legs', 'Keep the rope tight'], search: 'sled pull technique hyrox', alt: 'No sled? Heavy band rows or towel-rope pulls.' },
  burpee_broad_jump: { name: 'Burpee broad jump', dose: 'as set', cues: ['Chest to floor, jump forward', 'Land soft', 'Even rhythm, not all-out'], search: 'burpee broad jump technique' },
  row_tech: { name: 'Rowing technique', dose: 'as set', cues: ['Legs, body, arms; then arms, body, legs', 'Power from the legs', 'Damper around 5-6'], search: 'rowing machine technique beginner', alt: 'No rower? Run or bike the same time.' },
  ski_tech: { name: 'SkiErg technique', dose: 'as set', cues: ['Hinge at the hips', 'Pull with lats and core', 'Arms finish by the hips'], search: 'skierg technique', alt: 'No SkiErg? Band pull-downs + jumping jacks.' },
  easy_erg: { name: 'Easy aerobic', dose: 'as set', cues: ['Conversational effort', 'Any machine or a run', 'Steady breathing'], search: 'zone 2 cardio explained' },
  threshold_mix: { name: 'Threshold work', dose: 'as set', cues: ['Comfortably hard: short sentences only', 'Even pace', 'Easy between reps'], search: 'threshold intervals running' },
  erg_intervals: { name: 'Erg intervals', dose: 'as set', cues: ['Hard but repeatable', 'Hold the same split', 'Full easy recovery'], search: 'rowing intervals workout' },
  compromised_run: { name: 'Compromised running', dose: 'as set', cues: ['Run straight after the station', 'Short quick steps for the first 200 m', 'Settle into race pace'], search: 'compromised running hyrox training' },
  race_sim: { name: 'Race simulation', dose: 'as set', cues: ['Pace the first runs easier than you think', 'Smooth on the stations', 'Practise transitions'], search: 'hyrox simulation workout' },
};
