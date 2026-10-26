// Home workouts data: worlds and stages, the Test Day of each world, the move ladders circuits are
// built from (easiest → hardest, with what each needs), and the home moves' cues.
// It runs inside the Gym track (s.gym.mode === 'home'), so the week, calendar and map work the same way.

export const HOME_WORLDS = [
  { name: 'Living Room Arena', emoji: '🧘', stages: [0, 1], test: 'Arena Test Day' },
  { name: 'Band Camp', emoji: '🎗️', stages: [2, 3], test: 'Band Camp Test Day' },
  { name: 'Backyard Stadium', emoji: '🌳', stages: [4, 5], test: 'Stadium Test Day' },
  { name: 'Rooftop Circuit', emoji: '🏙️', stages: [6, 7], test: 'Rooftop Test Day' },
  { name: 'Hall of Home Champions', emoji: '🏆', stages: [8, 9], test: 'Champions Test Day' },
];
export const HOME_STAGES = [
  { n: 0, name: 'First Moves', world: 0 }, { n: 1, name: 'Getting Going', world: 0 },
  { n: 2, name: 'Finding Rhythm', world: 1 }, { n: 3, name: 'Steady Mover', world: 1 },
  { n: 4, name: 'Getting Strong', world: 2 }, { n: 5, name: 'Power Circuit', world: 2 },
  { n: 6, name: 'Fit and Fierce', world: 3 }, { n: 7, name: 'Skyline Strong', world: 3 },
  { n: 8, name: 'Home Hero', world: 4 }, { n: 9, name: 'Home Champion', world: 4 },
];
export const HOME_MAX = HOME_STAGES.length;
// Sessions done in a stage before it clears (about 2-3 weeks); on a world's last stage they open its Test Day.
export const STAGE_SESSIONS = 6;

// Each world's Test Day: three simple tests, logged as reps or seconds. All three met = next world.
// `need` is one number for everyone, or { m, f } when it differs by sex (push-ups: women's goals are lower,
// as in standard fitness norms; plank and legs are the same). Goals approved by Abdullah (v101/v102).
export const HOME_TESTS = [
  [{ id: 'incline_pushup', label: 'Incline push-ups (hands on a counter or sturdy chair)', need: { m: 10, f: 8 }, unit: 'reps' }, { id: 'plank', label: 'Plank (knees down is fine)', need: 20, unit: 's' }, { id: 'air_squat', label: 'Squats', need: 15, unit: 'reps' }],
  [{ id: 'knee_pushup', label: 'Knee push-ups', need: { m: 8, f: 6 }, unit: 'reps' }, { id: 'plank', label: 'Plank', need: 30, unit: 's' }, { id: 'air_squat', label: 'Squats', need: 20, unit: 'reps' }],
  [{ id: 'knee_pushup', label: 'Knee push-ups', need: { m: 15, f: 12 }, unit: 'reps' }, { id: 'plank', label: 'Plank', need: 45, unit: 's' }, { id: 'split_squat', label: 'Split squats, each leg', need: 10, unit: 'reps' }],
  [{ id: 'pushup', label: 'Push-ups', need: { m: 10, f: 5 }, unit: 'reps' }, { id: 'plank', label: 'Plank', need: 60, unit: 's' }, { id: 'reverse_lunge', label: 'Reverse lunges, each leg', need: 15, unit: 'reps' }],
  [{ id: 'pushup', label: 'Push-ups', need: { m: 20, f: 12 }, unit: 'reps' }, { id: 'plank', label: 'Plank', need: 90, unit: 's' }, { id: 'bulgarian_split_squat', label: 'Bulgarian split squats, each leg (back foot on a sofa or chair)', need: 10, unit: 'reps' }],
];

// Move ladders: easiest first. need: 'band' | 'db' | 'chair' (equipment), jump: true (left out with "no jumping"),
// low: true (the low-impact twin of a jump move, used only with "no jumping").
// The athlete's level picks the rung; "Easier" / "Harder" in a session moves one rung for that move type.
export const LADDERS = {
  squat: [{ id: 'sit_to_stand' }, { id: 'air_squat' }, { id: 'goblet_squat', need: 'db' }, { id: 'split_squat' }, { id: 'reverse_lunge' }, { id: 'bulgarian_split_squat' }, { id: 'squat_jump', jump: true }],
  push: [{ id: 'wall_pushup' }, { id: 'incline_pushup' }, { id: 'knee_pushup' }, { id: 'pushup' }, { id: 'decline_pushup', need: 'chair' }],
  hinge: [{ id: 'glute_bridge' }, { id: 'band_glute_bridge', need: 'band' }, { id: 'single_leg_bridge' }, { id: 'db_rdl', need: 'db' }, { id: 'sofa_hip_thrust' }, { id: 'single_leg_rdl' }],
  pull: [{ id: 'superman' }, { id: 'prone_ytw' }, { id: 'band_pull_apart', need: 'band' }, { id: 'band_row', need: 'band' }, { id: 'db_row', need: 'db' }],
  shoulder: [{ id: 'arm_circles' }, { id: 'band_press', need: 'band' }, { id: 'db_press', need: 'db' }, { id: 'pike_pushup' }],
  core: [{ id: 'dead_bug' }, { id: 'knee_plank' }, { id: 'plank' }, { id: 'plank_shoulder_tap' }],
  core2: [{ id: 'bird_dog' }, { id: 'side_plank_knee' }, { id: 'side_plank' }, { id: 'side_plank_reach' }],
  cardio: [{ id: 'march_in_place' }, { id: 'step_jack', low: true }, { id: 'jumping_jack', jump: true }, { id: 'skater_step', low: true }, { id: 'skater', jump: true }, { id: 'slow_mountain_climber', low: true }, { id: 'mountain_climber', jump: true }, { id: 'burpee_step_back', low: true }, { id: 'burpee', jump: true }],
};
export const CAT_LABEL = { squat: 'legs', push: 'push', hinge: 'glutes', pull: 'back', shoulder: 'shoulders', core: 'core', core2: 'core', cardio: 'cardio' };

export const HOME_EXERCISES = {
  incline_pushup: { name: 'Incline push-up', dose: 'as set', cues: ['Hands on a kitchen counter, table or sturdy chair', 'Body in one straight line', 'Chest to the edge, push back'], search: 'incline push up form' },
  sit_to_stand: { name: 'Sit to stand', dose: 'as set', cues: ['Sit on a chair or the sofa edge, feet flat', 'Stand up without using your hands', 'Sit back down slowly'], search: 'sit to stand exercise' },
  wall_pushup: { name: 'Wall push-up', dose: 'as set', cues: ['Hands on the wall at shoulder height', 'Body in one straight line', 'Chest to the wall, push back'], search: 'wall push up' },
  knee_pushup: { name: 'Knee push-up', dose: 'as set', cues: ['Knees down, body straight from knees to head', 'Chest to the floor', 'Elbows about 45 degrees'], search: 'knee push up form' },
  band_glute_bridge: { name: 'Band glute bridge', dose: 'as set', cues: ['Band just above the knees', 'Push the knees out against the band', 'Squeeze the glutes at the top'], search: 'banded glute bridge' },
  sofa_hip_thrust: { name: 'Hip thrust (sofa)', dose: 'as set', cues: ['Upper back on the sofa edge', 'Feet flat, shins upright at the top', 'Squeeze the glutes, ribs down'], search: 'bodyweight hip thrust couch' },
  superman: { name: 'Superman', dose: 'as set', cues: ['Lie face down, arms forward', 'Lift arms and legs a little', 'Hold 2 seconds, lower slowly'], search: 'superman exercise' },
  band_pull_apart: { name: 'Band pull-apart', dose: 'as set', cues: ['Arms straight in front, band in both hands', 'Pull the band to your chest', 'Squeeze the shoulder blades'], search: 'band pull apart' },
  band_row: { name: 'Band row', dose: 'as set', cues: ['Band round your feet or a door anchor', 'Pull elbows back to your sides', 'Squeeze the shoulder blades, slow back'], search: 'resistance band row' },
  band_press: { name: 'Band shoulder press', dose: 'as set', cues: ['Stand on the band', 'Press the hands overhead', 'Ribs down, no back arch'], search: 'resistance band shoulder press' },
  arm_circles: { name: 'Arm circles and raises', dose: 'as set', cues: ['Arms out to the sides', 'Small circles, then raise to overhead', 'Shoulders down, away from the ears'], search: 'arm circles exercise' },
  knee_plank: { name: 'Knee plank', dose: 'as set', cues: ['Elbows under shoulders, knees down', 'Straight line from knees to head', 'Squeeze glutes and abs, breathe'], search: 'kneeling plank' },
  plank_shoulder_tap: { name: 'Plank shoulder taps', dose: 'as set', cues: ['High plank, feet wide', 'Tap the opposite shoulder', 'Keep the hips still'], search: 'plank shoulder taps' },
  bird_dog: { name: 'Bird dog', dose: 'as set', cues: ['On hands and knees', 'Reach one arm and the opposite leg long', 'Back flat, slow and steady'], search: 'bird dog exercise' },
  side_plank_knee: { name: 'Side plank (knees)', dose: 'as set', cues: ['Elbow under the shoulder, knees bent', 'Lift the hips into a straight line', 'Switch sides halfway'], search: 'modified side plank knees' },
  side_plank_reach: { name: 'Side plank reach-through', dose: 'as set', cues: ['Side plank, top arm up', 'Reach it under your body and back up', 'Switch sides halfway'], search: 'side plank reach through' },
  march_in_place: { name: 'March in place', dose: 'as set', cues: ['Knees up to hip height', 'Swing the arms', 'Quick and light'], search: 'marching in place exercise' },
  step_jack: { name: 'Step jacks', dose: 'as set', cues: ['Step one foot out as the arms go up', 'Step back in, switch sides', 'No jumping, keep a quick rhythm'], search: 'low impact jumping jacks' },
  jumping_jack: { name: 'Jumping jacks', dose: 'as set', cues: ['Jump the feet out, arms overhead', 'Land softly on the balls of the feet', 'Steady rhythm'], search: 'jumping jacks' },
  skater_step: { name: 'Skater steps', dose: 'as set', cues: ['Big step to the side', 'Swing the back leg behind', 'Low and controlled, no jump'], search: 'low impact skaters' },
  skater: { name: 'Skater hops', dose: 'as set', cues: ['Hop side to side on one leg', 'Land softly, knee over toes', 'Arms swing across'], search: 'skater hops exercise' },
  slow_mountain_climber: { name: 'Slow mountain climbers', dose: 'as set', cues: ['High plank, hands under shoulders', 'Step one knee to the chest, then the other', 'Hips low and steady'], search: 'slow mountain climbers' },
  mountain_climber: { name: 'Mountain climbers', dose: 'as set', cues: ['High plank', 'Drive the knees quickly towards the chest', 'Hips low'], search: 'mountain climbers form' },
  burpee_step_back: { name: 'Step-back burpee', dose: 'as set', cues: ['Hands down, step back to a plank', 'Step forward, stand tall', 'No jump: smooth and steady'], search: 'low impact burpee' },
  burpee: { name: 'Burpee', dose: 'as set', cues: ['Hands down, jump back to a plank', 'Jump the feet in, then jump up', 'Land softly'], search: 'burpee proper form' },
  reverse_lunge: { name: 'Reverse lunge', dose: 'as set', cues: ['Step back, both knees bend', 'Front knee over the toes', 'Push through the front foot to stand'], search: 'reverse lunge form' },
};
