// Gym track data: worlds and stages (strength standards), the muscle-group slots each session is built
// from (one exercise per slot, by equipment, rotated every block), the split templates, and the gym
// exercise library. Standards are estimated 1-rep max as a multiple of bodyweight, from common
// strength-standard tables (beginner → elite); women's standards are their own, not a fraction rule.

export const GYM_WORLDS = [
  { name: 'Garage Gym', emoji: '🏠', stages: [0, 1], test: 'Garage Test Day' },
  { name: 'Plate Valley', emoji: '⛰️', stages: [2, 3], test: 'Plate Valley Test Day' },
  { name: 'Barbell Citadel', emoji: '🏰', stages: [4, 5], test: 'Citadel Test Day' },
  { name: 'Powerhouse', emoji: '⚡', stages: [6, 7], test: 'Powerhouse Test Day' },
  { name: 'Mount Olympus', emoji: '🏛️', stages: [8, 9], test: 'Olympus Test Day' },
];

// std: squat / bench / deadlift as e1RM ÷ bodyweight. bw: bodyweight-only reps (push-ups, pull-ups,
// Bulgarian split squats each leg). Stage 0 has no standard: it clears after one block of learning.
export const GYM_STAGES = [
  { n: 0, name: 'Learn the Moves', world: 0, std: null, bw: null },
  { n: 1, name: 'Foundation', world: 0, std: { m: [0.75, 0.6, 1.0], f: [0.5, 0.35, 0.65] }, bw: { m: [10, 1, 10], f: [4, 0, 8] } },
  { n: 2, name: 'First Plates', world: 1, std: { m: [1.0, 0.8, 1.25], f: [0.7, 0.45, 0.85] }, bw: { m: [20, 4, 15], f: [10, 1, 12] } },
  { n: 3, name: 'Steady Gains', world: 1, std: { m: [1.25, 1.0, 1.5], f: [0.9, 0.55, 1.05] }, bw: { m: [30, 8, 20], f: [18, 3, 18] } },
  { n: 4, name: 'Strong Base', world: 2, std: { m: [1.5, 1.15, 1.75], f: [1.05, 0.65, 1.25] }, bw: { m: [40, 12, 25], f: [25, 6, 25] } },
  { n: 5, name: 'Iron Habit', world: 2, std: { m: [1.75, 1.3, 2.0], f: [1.2, 0.8, 1.4] } },
  { n: 6, name: 'Seriously Strong', world: 3, std: { m: [2.0, 1.5, 2.25], f: [1.4, 0.9, 1.6] } },
  { n: 7, name: 'Advanced', world: 3, std: { m: [2.25, 1.65, 2.5], f: [1.6, 1.05, 1.8] } },
  { n: 8, name: 'Elite Club', world: 4, std: { m: [2.5, 1.8, 2.75], f: [1.8, 1.2, 2.0] } },
  { n: 9, name: 'Legend', world: 4, std: { m: [2.75, 2.0, 3.0], f: [2.0, 1.35, 2.25] } },
];
export const GYM_MAX = GYM_STAGES.length;
// The lifts the standards are measured on, by equipment (home: dumbbell versions, both dumbbells
// counted; their weight is converted with a typical ratio to the barbell lift).
export const TEST_LIFTS = {
  gym: [['squat', 'back_squat', 1], ['bench', 'bench', 1], ['deadlift', 'deadlift', 1]],
  home: [['squat', 'goblet_squat', 0.45], ['bench', 'db_bench', 0.8], ['deadlift', 'db_rdl', 0.6]],
  bw: [['push', 'pushup'], ['pull', 'pullup'], ['legs', 'bulgarian_split_squat']],
};
// Highest stage by equipment: home dumbbells and bodyweight run out of load before the top.
export const EQUIP_CAP = { gym: GYM_MAX, home: 6, bw: 5 };

// Slots: one exercise each. `kind` sets the sets and reps: main lifts stay the same block after block
// (strength is a skill: practising the same lift is what makes it go up); compound and isolation
// exercises rotate every block for variety and to train each muscle from more angles.
export const SLOTS = {
  squat: { muscle: 'legs', kind: 'main', legs: true, gym: ['back_squat'], home: ['goblet_squat'], bw: ['bulgarian_split_squat'] },
  hinge: { muscle: 'legs', kind: 'main', legs: true, gym: ['deadlift'], home: ['db_rdl'], bw: ['single_leg_rdl'] },
  bench: { muscle: 'chest', kind: 'main', gym: ['bench'], home: ['db_bench'], bw: ['pushup'] },
  ohp: { muscle: 'shoulders', kind: 'main', gym: ['ohp'], home: ['db_press'], bw: ['pike_pushup'] },
  vpull: { muscle: 'back', kind: 'compound', gym: ['lat_pulldown', 'pullup'], home: ['pullup'], bw: ['pullup'] },
  row: { muscle: 'back', kind: 'compound', gym: ['barbell_row', 'cable_row', 'chest_supported_row'], home: ['db_row'], bw: ['inverted_row'] },
  chest2: { muscle: 'chest', kind: 'compound', gym: ['incline_db_press', 'machine_chest_press', 'dips'], home: ['incline_db_press', 'db_floor_press'], bw: ['dips', 'decline_pushup'] },
  chestIso: { muscle: 'chest', kind: 'iso', gym: ['cable_fly', 'db_fly'], home: ['db_fly'], bw: ['deficit_pushup'] },
  quad2: { muscle: 'legs', kind: 'compound', legs: true, gym: ['leg_press', 'bulgarian_split_squat', 'walking_lunge'], home: ['bulgarian_split_squat', 'walking_lunge'], bw: ['walking_lunge', 'step_up'] },
  ham: { muscle: 'legs', kind: 'iso', legs: true, gym: ['leg_curl', 'rdl'], home: ['single_leg_rdl', 'db_rdl'], bw: ['single_leg_bridge', 'single_leg_rdl'] },
  quadIso: { muscle: 'legs', kind: 'iso', legs: true, gym: ['leg_extension'], home: ['step_up'], bw: ['step_up'] },
  calves: { muscle: 'legs', kind: 'iso', gym: ['calf_raise_double'], home: ['calf_raise_single'], bw: ['calf_raise_single'] },
  glutes: { muscle: 'glutes', kind: 'compound', legs: true, gym: ['hip_thrust', 'cable_kickback'], home: ['hip_thrust'], bw: ['single_leg_bridge', 'glute_bridge'] },
  lateral: { muscle: 'shoulders', kind: 'iso', gym: ['lateral_raise', 'cable_lateral'], home: ['lateral_raise'], bw: ['pike_pushup'] },
  rearDelt: { muscle: 'shoulders', kind: 'iso', gym: ['face_pull', 'rear_delt_fly'], home: ['rear_delt_fly'], bw: ['prone_ytw'] },
  biceps: { muscle: 'biceps', kind: 'iso', gym: ['barbell_curl', 'db_curl', 'hammer_curl'], home: ['db_curl', 'hammer_curl'], bw: ['chinup'] },
  triceps: { muscle: 'triceps', kind: 'iso', gym: ['triceps_pushdown', 'overhead_triceps_ext', 'close_grip_bench'], home: ['overhead_triceps_ext', 'close_grip_db_press'], bw: ['diamond_pushup', 'bench_dip'] },
  abs: { muscle: 'abs', kind: 'iso', gym: ['hanging_leg_raise', 'cable_crunch', 'ab_wheel'], home: ['ab_wheel', 'dead_bug'], bw: ['plank', 'dead_bug', 'side_plank'] },
};

// Split days: slots in priority order (a shorter session keeps the first ones). `+` marks a second
// exercise for the same slot (the next exercise in its list).
export const GYM_DAYS = {
  fullA: { name: 'Full body A', slots: ['squat', 'bench', 'row', 'ham', 'lateral', 'abs'] },
  fullB: { name: 'Full body B', slots: ['hinge', 'ohp', 'vpull', 'quad2', 'biceps', 'triceps'] },
  fullC: { name: 'Full body C', slots: ['quad2', 'chest2', 'row+', 'glutes', 'rearDelt', 'abs'] },
  lower: { name: 'Lower', slots: ['squat', 'ham', 'quad2', 'calves', 'abs', 'glutes'] },
  upper: { name: 'Upper', slots: ['bench', 'row', 'ohp', 'vpull', 'biceps', 'triceps'] },
  lowerA: { name: 'Lower A', slots: ['squat', 'ham', 'quad2', 'calves', 'abs', 'quadIso'] },
  upperA: { name: 'Upper A', slots: ['bench', 'row', 'vpull', 'lateral', 'triceps', 'biceps'] },
  lowerB: { name: 'Lower B', slots: ['hinge', 'quad2+', 'glutes', 'calves', 'abs', 'ham+'] },
  upperB: { name: 'Upper B', slots: ['ohp', 'vpull+', 'chest2', 'row+', 'rearDelt', 'biceps+'] },
  push: { name: 'Push', slots: ['bench', 'ohp', 'chest2', 'lateral', 'triceps', 'chestIso'] },
  pull: { name: 'Pull', slots: ['vpull', 'row', 'rearDelt', 'biceps', 'row+', 'biceps+'] },
  legs: { name: 'Legs', slots: ['squat', 'ham', 'quad2', 'calves', 'abs', 'glutes'] },
  pushB: { name: 'Push B', slots: ['ohp', 'chest2+', 'bench', 'lateral', 'triceps+', 'chestIso'] },
  pullB: { name: 'Pull B', slots: ['row+', 'vpull+', 'rearDelt', 'biceps+', 'row', 'abs'] },
  legsB: { name: 'Legs B', slots: ['hinge', 'quad2+', 'glutes', 'ham+', 'calves', 'abs'] },
  // Bro split days. The arm slot follows the pairing: classic (chest + triceps, back + biceps) or
  // swapped (chest + biceps, back + triceps).
  chest: { name: 'Chest', slots: ['bench', 'chest2', '@push', 'chestIso', '@push+', 'chest2+'] },
  back: { name: 'Back', slots: ['vpull', 'row', '@pull', 'row+', '@pull+', 'rearDelt'] },
  legsAbs: { name: 'Legs + Abs', slots: ['squat', 'hinge', 'quad2', 'ham', 'calves', 'abs'] },
  shoulders: { name: 'Shoulders', slots: ['ohp', 'lateral', 'rearDelt', 'lateral+', 'abs', 'triceps'] },
  arms: { name: 'Arms', slots: ['biceps', 'triceps', 'biceps+', 'triceps+', 'abs', 'calves'] },
};

export const GYM_SPLITS = {
  full: { label: 'Full body', days: ['fullA', 'fullB', 'fullC'], why: 'Every session trains the whole body, so each muscle gets 2-3 hits a week. Best when you are learning the lifts or have 1-3 days.' },
  ulf: { label: 'Lower / Upper / Full', days: ['lower', 'upper', 'fullC'], why: 'For 3 days with some experience: a heavy leg day, an upper day and a lighter full-body day. Each muscle gets two hits a week.' },
  ppl3: { label: 'Push / Pull / Legs', days: ['push', 'pull', 'legs'], why: 'For 3 days when muscle is the goal: longer, focused sessions. Each muscle is trained once a week, so make every set count.' },
  ul: { label: 'Upper / Lower', days: ['upperA', 'lowerA', 'upperB', 'lowerB'], why: 'For 4 days: each muscle twice a week, the sweet spot in the research for strength and muscle.' },
  ulf5: { label: 'Upper / Lower + Full', days: ['upperA', 'lowerA', 'upperB', 'lowerB', 'fullC'], why: 'For 5 days while you are still new: Upper/Lower plus a lighter full-body day, so recovery keeps up.' },
  ulppl: { label: 'Upper / Lower / Push / Pull / Legs', days: ['upper', 'lower', 'push', 'pull', 'legs'], why: 'For 5 days: twice a week for every muscle, with a heavy and a volume version of each.' },
  ppl: { label: 'Push / Pull / Legs ×2', days: ['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB'], why: 'For 6 days: each muscle twice a week with lots of volume. Needs good sleep and food to recover.' },
  bro4: { label: 'Bro split (4 days)', bro: true, days: ['chest', 'back', 'legsAbs', 'shoulders'], why: 'One or two muscle groups a day: a big, focused pump and plenty of rest for each. Each muscle gets one hit a week, so the sets per muscle stay high. Research finds it about as good as twice a week when the weekly sets match.' },
  bro5: { label: 'Bro split (5 days)', bro: true, days: ['chest', 'back', 'legsAbs', 'shoulders', 'arms'], why: 'Chest, back, legs + abs, shoulders and an arm day. Lots of volume per muscle and a week to recover. Fine for muscle when you have the days and the experience.' },
  bro6: { label: 'Bro split + Legs B (6 days)', bro: true, days: ['chest', 'back', 'legsAbs', 'shoulders', 'arms', 'legsB'], why: 'The 5-day bro split with a second leg day, so legs get two hits a week.' },
};
// Which splits fit a number of days, for the picker.
export const SPLITS_FOR = { 1: ['full'], 2: ['full'], 3: ['full', 'ulf', 'ppl3'], 4: ['ul', 'bro4', 'full'], 5: ['ulppl', 'bro5', 'ulf5', 'ul'], 6: ['ppl', 'bro6', 'ulppl'] };
export const PAIRS = { classic: { push: 'triceps', pull: 'biceps', label: 'Chest + Triceps · Back + Biceps' }, swapped: { push: 'biceps', pull: 'triceps', label: 'Chest + Biceps · Back + Triceps' } };

export const GYM_EXERCISES = {
  bench: { name: 'Bench press', dose: 'as set', cues: ['Shoulder blades squeezed back and down', 'Feet planted, slight arch', 'Bar to the lower chest, press up and slightly back'], search: 'barbell bench press form' },
  bulgarian_split_squat: { name: 'Bulgarian split squat', dose: 'as set', cues: ['Back foot on a bench', 'Front knee over the toes', 'Drop straight down, push through the front foot'], search: 'bulgarian split squat form' },
  single_leg_rdl: { name: 'Single-leg Romanian deadlift', dose: 'as set', cues: ['Hips square to the floor', 'Back leg in line with the body', 'Feel the hamstring, then stand tall'], search: 'single leg romanian deadlift form' },
  pike_pushup: { name: 'Pike push-up', dose: 'as set', cues: ['Hips high, body like an upside-down V', 'Head moves in front of the hands', 'Feet on a box to make it harder'], search: 'pike push up form' },
  lat_pulldown: { name: 'Lat pulldown', dose: 'as set', cues: ['Chest up, lean back slightly', 'Pull the bar to the upper chest', 'Control it up to a full stretch'], search: 'lat pulldown form' },
  barbell_row: { name: 'Barbell row', dose: 'as set', cues: ['Hinge to about 45 degrees, flat back', 'Pull the bar to the belly button', 'No jerking the body'], search: 'barbell row form' },
  cable_row: { name: 'Seated cable row', dose: 'as set', cues: ['Sit tall, slight lean at the start', 'Elbows back past the body', 'Squeeze the shoulder blades'], search: 'seated cable row form' },
  chest_supported_row: { name: 'Chest-supported row', dose: 'as set', cues: ['Chest on an incline bench', 'Pull elbows to the hips', 'Pause at the top'], search: 'chest supported dumbbell row' },
  inverted_row: { name: 'Inverted row', dose: 'as set', cues: ['Under a table or low bar', 'Body straight like a plank', 'Chest to the bar; feet closer makes it easier'], search: 'inverted row form' },
  incline_db_press: { name: 'Incline dumbbell press', dose: 'as set', cues: ['Bench at 30 degrees', 'Lower to the upper chest', 'Press up and slightly in'], search: 'incline dumbbell press form' },
  db_floor_press: { name: 'Dumbbell floor press', dose: 'as set', cues: ['Lie on the floor, knees bent', 'Upper arms touch the floor softly', 'Press up, pause, repeat'], search: 'dumbbell floor press' },
  machine_chest_press: { name: 'Machine chest press', dose: 'as set', cues: ['Handles at mid-chest', 'Shoulders down', 'Slow on the way back'], search: 'machine chest press form' },
  dips: { name: 'Dips', dose: 'as set', cues: ['Lean forward a little for chest', 'Lower until upper arms are level', 'Use a band or bench dips to make it easier'], search: 'chest dips form' },
  decline_pushup: { name: 'Feet-up push-up', dose: 'as set', cues: ['Feet on a chair', 'Body in one line', 'Chest close to the floor'], search: 'decline push up' },
  deficit_pushup: { name: 'Deficit push-up', dose: 'as set', cues: ['Hands on two books or handles', 'Go deeper than the hands', 'Slow lowering, 3 seconds'], search: 'deficit push up' },
  cable_fly: { name: 'Cable fly', dose: 'as set', cues: ['Soft bend in the elbows', 'Hug a big tree', 'Stretch at the back, squeeze in front'], search: 'cable chest fly form' },
  db_fly: { name: 'Dumbbell fly', dose: 'as set', cues: ['Light weight, elbows slightly bent', 'Open until you feel a stretch', 'Bring them together over the chest'], search: 'dumbbell fly form' },
  leg_press: { name: 'Leg press', dose: 'as set', cues: ['Feet shoulder-width, mid-platform', 'Lower until knees are at about 90 degrees', 'Lower back stays on the pad'], search: 'leg press form' },
  leg_curl: { name: 'Leg curl', dose: 'as set', cues: ['Pad just above the heels', 'Curl all the way', 'Slow on the way back'], search: 'leg curl machine form' },
  leg_extension: { name: 'Leg extension', dose: 'as set', cues: ['Knee lined up with the machine pivot', 'Straighten fully, squeeze', 'Lower slowly'], search: 'leg extension form' },
  step_up: { name: 'Step-up', dose: 'as set', cues: ['Whole foot on the box', 'Push through the top leg only', 'Step down slowly'], search: 'step up exercise form' },
  hip_thrust: { name: 'Hip thrust', dose: 'as set', cues: ['Upper back on a bench, weight on the hips', 'Chin tucked, ribs down', 'Squeeze the glutes at the top for a second'], search: 'hip thrust form' },
  cable_kickback: { name: 'Cable glute kickback', dose: 'as set', cues: ['Hinge slightly, hold the machine', 'Kick back and up with a straight-ish leg', 'No arching the lower back'], search: 'cable glute kickback form' },
  lateral_raise: { name: 'Lateral raise', dose: 'as set', cues: ['Light weight', 'Lift out to the side to shoulder height', 'Lead with the elbows, slow down'], search: 'dumbbell lateral raise form' },
  cable_lateral: { name: 'Cable lateral raise', dose: 'as set', cues: ['One arm, cable from the low pulley', 'Lift to shoulder height', 'Control the way down'], search: 'cable lateral raise' },
  face_pull: { name: 'Face pull', dose: 'as set', cues: ['Rope at face height', 'Pull to the eyes, elbows high', 'Rotate the hands back at the end'], search: 'face pull form' },
  rear_delt_fly: { name: 'Rear-delt fly', dose: 'as set', cues: ['Bend forward, flat back', 'Arms out to the side, light weight', 'Squeeze the back of the shoulders'], search: 'rear delt fly dumbbell' },
  prone_ytw: { name: 'Prone Y-T-W raises', dose: 'as set', cues: ['Lie face down', 'Lift arms in a Y, then T, then W', 'Thumbs up, small and slow'], search: 'prone y t w raise' },
  barbell_curl: { name: 'Barbell curl', dose: 'as set', cues: ['Elbows by your sides', 'Curl without swinging', 'Lower for 2-3 seconds'], search: 'barbell curl form' },
  db_curl: { name: 'Dumbbell curl', dose: 'as set', cues: ['Palms up', 'Elbows still', 'Full stretch at the bottom'], search: 'dumbbell curl form' },
  hammer_curl: { name: 'Hammer curl', dose: 'as set', cues: ['Palms facing each other', 'Elbows still', 'Slow lowering'], search: 'hammer curl form' },
  chinup: { name: 'Chin-up', dose: 'as set', cues: ['Palms facing you', 'Pull the chest to the bar', 'Negatives or a band if needed'], search: 'chin up form' },
  triceps_pushdown: { name: 'Triceps pushdown', dose: 'as set', cues: ['Elbows pinned to the sides', 'Push until the arms are straight', 'Let it rise slowly'], search: 'triceps pushdown form' },
  overhead_triceps_ext: { name: 'Overhead triceps extension', dose: 'as set', cues: ['Weight behind the head', 'Elbows point up and stay in', 'Straighten fully'], search: 'overhead triceps extension dumbbell' },
  close_grip_bench: { name: 'Close-grip bench press', dose: 'as set', cues: ['Hands shoulder-width', 'Elbows close to the body', 'Touch the lower chest'], search: 'close grip bench press form' },
  close_grip_db_press: { name: 'Close-grip dumbbell press', dose: 'as set', cues: ['Dumbbells touching, palms in', 'Elbows close', 'Press straight up'], search: 'close grip dumbbell press' },
  diamond_pushup: { name: 'Diamond push-up', dose: 'as set', cues: ['Hands close under the chest', 'Elbows brush the ribs', 'Knees down to make it easier'], search: 'diamond push up form' },
  bench_dip: { name: 'Bench dip', dose: 'as set', cues: ['Hands on a bench behind you', 'Elbows point back', 'Lower to about 90 degrees'], search: 'bench dip form' },
  hanging_leg_raise: { name: 'Hanging leg raise', dose: 'as set', cues: ['Hang still, no swing', 'Lift knees (easier) or legs', 'Curl the pelvis up at the top'], search: 'hanging leg raise form' },
  cable_crunch: { name: 'Cable crunch', dose: 'as set', cues: ['Kneel, rope by the head', 'Curl the ribs to the hips', 'Hips stay still'], search: 'cable crunch form' },
  ab_wheel: { name: 'Ab wheel rollout', dose: 'as set', cues: ['From the knees', 'Roll out with a flat back', 'Only as far as you can come back'], search: 'ab wheel rollout form' },
  plank: { name: 'Plank', dose: 'as set', cues: ['Elbows under shoulders', 'Squeeze glutes and abs', 'Body in one line, breathe'], search: 'plank form' },
};
