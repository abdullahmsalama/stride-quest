// Exercise library. `video` is filled in only after someone has watched and approved a clip;
// until then the app links to a YouTube search for `search`.
export const EXERCISES = {
  // P0 Wake Up: mobility
  knee_to_wall: { name: 'Knee-to-wall ankle mobility', dose: '2 x 10 each side', cues: ['Foot ~10 cm from the wall', 'Drive the knee forward over the toes', 'Heel stays down'], search: 'knee to wall ankle dorsiflexion mobility' },
  hip_flexor_stretch: { name: 'Half-kneeling hip flexor stretch', dose: '2 x 30s each side', cues: ['Squeeze the glute of the back leg', 'Tuck the pelvis, do not arch the back', 'Gentle stretch, never pain'], search: 'half kneeling hip flexor stretch runners' },
  hip_90_90: { name: '90/90 hip switches', dose: '2 x 8 switches', cues: ['Sit tall', 'Rotate knees side to side slowly', 'Use hands for support if needed'], search: '90 90 hip switch mobility' },
  cat_cow: { name: 'Cat-cow', dose: '10 slow reps', cues: ['Move one vertebra at a time', 'Breathe out as you round', 'Slow and smooth'], search: 'cat cow exercise' },
  thoracic_rotation: { name: 'Open-book thoracic rotation', dose: '8 each side', cues: ['Lie on your side, knees bent', 'Follow your hand with your eyes', 'Knees stay together'], search: 'open book thoracic rotation' },
  leg_swings: { name: 'Leg swings (front and side)', dose: '10 each direction, each leg', cues: ['Hold a wall for balance', 'Relaxed, controlled swing', 'Grow the range gradually'], search: 'leg swings warm up runners' },

  // P1 Stand Strong: stability
  single_leg_balance: { name: 'Single-leg balance', dose: '3 x 30s each leg', cues: ['Soft knee, tall posture', 'Hips level', 'Harder: eyes closed or on a cushion'], search: 'single leg balance exercise runners' },
  glute_bridge: { name: 'Glute bridge', dose: '3 x 12', cues: ['Push through the heels', 'Squeeze glutes at the top', 'Ribs down, no back arch'], search: 'glute bridge proper form' },
  dead_bug: { name: 'Dead bug', dose: '3 x 8 each side', cues: ['Lower back pressed into the floor', 'Move opposite arm and leg slowly', 'Breathe out as you extend'], search: 'dead bug exercise form' },
  side_plank: { name: 'Side plank', dose: '3 x 20s each side', cues: ['Elbow under shoulder', 'Body in one straight line', 'Easier: knees down'], search: 'side plank beginner' },
  calf_raise_double: { name: 'Double-leg calf raise', dose: '3 x 15', cues: ['Rise fully onto the balls of the feet', '2s up, 2s down', 'Hold a wall for balance'], search: 'calf raises proper form' },
  clamshell: { name: 'Clamshell', dose: '2 x 15 each side', cues: ['Heels together', 'Open the knee without rolling the hips back', 'Add a band when easy'], search: 'clamshell exercise' },

  // P2 Build the Engine: strength (+ isometrics used in Rebuild)
  calf_raise_single: { name: 'Single-leg calf raise', dose: '3 x 12-20 each leg', cues: ['Full range, slow lowering', 'Knee straight', 'Test: aim for 20+ each leg'], search: 'single leg calf raise runners' },
  soleus_raise: { name: 'Bent-knee calf raise (soleus)', dose: '3 x 15 each leg', cues: ['Knee bent ~30 degrees', 'Stay low through the set', 'Slow and controlled'], search: 'bent knee calf raise soleus' },
  split_squat: { name: 'Split squat', dose: '3 x 8-10 each leg', cues: ['Front knee tracks over the toes', 'Torso tall', 'Back knee lowers toward the floor'], search: 'split squat form' },
  step_down: { name: 'Step-down', dose: '3 x 8 each leg', cues: ['Slowly lower the free heel to the floor', 'Knee does not cave inward', 'Hips stay level'], search: 'lateral step down knee control' },
  single_leg_bridge: { name: 'Single-leg glute bridge', dose: '3 x 10 each leg', cues: ['Hips level at the top', 'Push through the heel', 'Pause 1s at the top'], search: 'single leg glute bridge' },
  copenhagen_short: { name: 'Copenhagen plank (short lever)', dose: '3 x 15s each side', cues: ['Top knee on a bench', 'Lift the hips into a straight line', 'Stop if the groin pinches'], search: 'copenhagen plank short lever' },
  wall_sit: { name: 'Wall sit (isometric)', dose: '4 x 30-45s', cues: ['Knees ~60-90 degrees, pain-free range', 'Back flat on the wall', 'Should feel like effort, not pain'], search: 'wall sit isometric knee' },
  calf_hold: { name: 'Calf raise hold (isometric)', dose: '4 x 30s', cues: ['Rise halfway and hold', 'Both legs, then one leg when easy', 'Pain stays 2/10 or less'], search: 'isometric calf raise hold achilles' },
  bridge_hold: { name: 'Glute bridge hold (isometric)', dose: '4 x 30s', cues: ['Hips high, ribs down', 'Squeeze the glutes', 'Breathe normally'], search: 'glute bridge hold isometric' },

  // P3 Learn to Land
  snap_down: { name: 'Snap-down', dose: '3 x 6', cues: ['Rise onto toes, arms up', 'Snap into an athletic stance', 'Land quiet, knees over toes'], search: 'snap down drill landing mechanics' },
  drop_squat: { name: 'Drop squat', dose: '3 x 6', cues: ['Drop fast into a quarter squat', 'Stick it and hold 2s', 'Chest up, knees out'], search: 'drop squat drill' },
  stick_landing: { name: 'Box stick landing (two legs)', dose: '3 x 5', cues: ['Step off a low box (15-30 cm)', 'Land soft and quiet, hold 3s', 'Knees track over toes'], search: 'stick landing box drop technique' },
  single_leg_stick: { name: 'Single-leg stick landing', dose: '3 x 5 each leg', cues: ['Small hop, land on one leg', 'Hold 3s without wobbling', 'Knee stays over the toes'], search: 'single leg stick landing drill' },

  // P4 Learn to Take Off: low plyometrics + drills
  pogo_hops: { name: 'Pogo hops', dose: '3 x 20s, 60s rest', cues: ['Stiff ankles, quick ground contact', 'Land quietly on the balls of the feet', 'Stop if pain goes above 2/10'], search: 'pogo hops for runners' },
  ankle_hops: { name: 'Low ankle hops', dose: '3 x 15', cues: ['Tiny hops, ankles only', 'Quiet landings', 'Rhythm over height'], search: 'ankle hops plyometric beginner' },
  jump_rope: { name: 'Jump rope', dose: '3 x 30s', cues: ['Small, light bounces', 'Elbows close to the body', 'No rope? Do it anyway'], search: 'jump rope for runners beginner' },
  a_skip: { name: 'A-skip', dose: '3 x 20 m', cues: ['Knee up, toe up', 'Strike down under the hip', 'Opposite arm drives'], search: 'a skip running drill' },
  b_skip: { name: 'B-skip', dose: '3 x 20 m', cues: ['Like an A-skip, then extend the leg', 'Paw the ground back under you', 'Stay tall'], search: 'b skip running drill' },
  strides: { name: 'Strides', dose: '4-6 x 20s, walk back', cues: ['Build to ~85% speed, never a sprint', 'Relaxed shoulders and face', 'Full recovery between'], search: 'running strides how to' },

  // P5 Spring: two-leg plyometrics
  squat_jump: { name: 'Squat jump', dose: '3 x 6', cues: ['Quarter squat, jump tall', 'Land soft, reset each rep', 'Quality over quantity'], search: 'squat jump proper landing' },
  broad_jump_stick: { name: 'Broad jump with stick', dose: '3 x 4', cues: ['Swing arms, jump forward', 'Stick the landing 3s', 'Walk back, full reset'], search: 'broad jump stick landing' },
  lateral_line_hops: { name: 'Lateral line hops', dose: '3 x 15s', cues: ['Two feet, side to side over a line', 'Quick and light', 'Stay balanced'], search: 'lateral line hops plyometric' },
  skip_height: { name: 'Skip for height', dose: '3 x 20 m', cues: ['Drive knee and opposite arm up', 'Push off powerfully', 'Land and go'], search: 'power skip for height drill' },

  // P6 Bounce: single-leg plyometrics
  single_leg_hop: { name: 'Single-leg hops in place', dose: '3 x 10 each leg', cues: ['Quiet landing', 'Knee over toes', 'Test: 10 pain-free each leg'], search: 'single leg hop in place runners' },
  lateral_bound: { name: 'Lateral bound', dose: '3 x 6 each side', cues: ['Push sideways off one leg', 'Stick the landing on the other', 'Control before distance'], search: 'lateral bound exercise' },
  bounding: { name: 'Bounding', dose: '3 x 20 m', cues: ['Exaggerated running strides', 'Hang time, then quick contact', 'Stop when form fades'], search: 'bounding drill running' },
  step_up_jump: { name: 'Step-up jump', dose: '3 x 6 each leg', cues: ['Foot on a box, drive up', 'Switch or land on the box softly', 'Stay tall'], search: 'step up jump plyometric' },

  // P7 Elastic: reactive plyometrics
  depth_drop_jump: { name: 'Depth drop to jump', dose: '3 x 5', cues: ['Step off a low box', 'Touch and rebound immediately', 'Low box only (20-30 cm)'], search: 'depth jump low box technique' },
  hill_bounding: { name: 'Hill bounding', dose: '4 x 15 m', cues: ['Gentle hill', 'Drive the knee, push the ground away', 'Walk down recovery'], search: 'hill bounding drill' },
  fast_leg_drill: { name: 'Fast-leg drill', dose: '4 x 15 m', cues: ['Cycle one leg quickly while jogging', 'Heel up under the hip', 'Switch legs each rep'], search: 'fast leg drill running' },
};

export function videoLink(id) {
  const ex = EXERCISES[id];
  if (!ex) return null;
  return ex.video || `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.search)}`;
}
