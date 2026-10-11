// Triathlon track. Three lanes climb together: Swim and Bike ladders live here, the Run lane is the
// Run Track itself. A world's transition gate opens when all three lanes reach its targets.

// Swim ladder: each stage ends with a continuous-distance gate (pool, any stroke until S2, then freestyle).
export const SWIM_STAGES = [
  { n: 0, name: 'Water Comfort', target: '25 m', meters: 25, steps: [
    { type: 'swim', title: 'Breathing and floating', ex: ['bubbles', 'float', 'push_glide'] },
    { type: 'swim', title: 'Kick with a board', ex: ['kick_board', 'push_glide'] },
    { type: 'swim', title: 'Short swims with rests', ex: ['short_swims', 'kick_board'] },
    { type: 'gate', title: 'Gate: swim 25 m without stopping', ex: ['short_swims'] }] },
  { n: 1, name: 'Freestyle Basics', target: '100 m', meters: 100, steps: [
    { type: 'swim', title: 'Body position + side kick', ex: ['side_kick', 'kick_board'] },
    { type: 'swim', title: 'Catch-up drill', ex: ['catch_up', 'short_swims'] },
    { type: 'swim', title: '8 x 25 m easy, rest as needed', ex: ['short_swims'] },
    { type: 'gate', title: 'Gate: swim 100 m without stopping', ex: ['short_swims'] }] },
  { n: 2, name: 'Breathing Rhythm', target: '200 m', meters: 200, steps: [
    { type: 'swim', title: 'Bilateral breathing drill', ex: ['bilateral', 'catch_up'] },
    { type: 'swim', title: '6 x 50 m, 20s rest', ex: ['bilateral', 'short_swims'] },
    { type: 'swim', title: '4 x 75 m, 20s rest', ex: ['bilateral'] },
    { type: 'gate', title: 'Gate: swim 200 m freestyle without stopping', ex: ['bilateral'] }] },
  { n: 3, name: 'Steady Swimmer', target: '400 m', meters: 400, steps: [
    { type: 'swim', title: '4 x 100 m, 20s rest', ex: ['steady_sets'] },
    { type: 'swim', title: 'Drills + 300 m continuous', ex: ['catch_up', 'steady_sets'] },
    { type: 'swim', title: '2 x 200 m, 30s rest', ex: ['steady_sets'] },
    { type: 'gate', title: 'Gate: swim 400 m without stopping', ex: ['steady_sets'] }] },
  { n: 4, name: 'Sprint Swimmer', target: '750 m', meters: 750, steps: [
    { type: 'swim', title: '6 x 100 m, 15s rest', ex: ['steady_sets'] },
    { type: 'swim', title: 'CSS test (400 m + 200 m)', ex: ['css_test'] },
    { type: 'swim', title: '3 x 250 m at CSS pace', ex: ['css_sets'] },
    { type: 'gate', title: 'Gate: swim 750 m without stopping', ex: ['steady_sets'] }] },
  { n: 5, name: 'Open Water', target: '1500 m + open water', meters: 1500, steps: [
    { type: 'swim', title: 'Sighting drill in the pool', ex: ['sighting', 'steady_sets'] },
    { type: 'swim', title: 'Open water swim, supervised', ex: ['open_water'], detail: 'Never swim alone. Lifeguarded venue or a group, bright cap.' },
    { type: 'swim', title: '5 x 300 m at CSS pace', ex: ['css_sets'] },
    { type: 'gate', title: 'Gate: swim 1500 m without stopping (one open-water swim done)', ex: ['open_water'] }] },
  { n: 6, name: 'Half Iron Swimmer', target: '1.9 km', meters: 1900, steps: [
    { type: 'swim', title: '4 x 500 m, 30s rest', ex: ['css_sets'] },
    { type: 'swim', title: 'Open water 1.5 km, supervised', ex: ['open_water'] },
    { type: 'swim', title: 'Mass-start practice + sighting', ex: ['sighting', 'open_water'] },
    { type: 'gate', title: 'Gate: swim 1.9 km without stopping', ex: ['open_water'] }] },
  { n: 7, name: 'Iron Swimmer', target: '3.8 km', meters: 3800, steps: [
    { type: 'swim', title: '3 x 1000 m, 45s rest', ex: ['css_sets'] },
    { type: 'swim', title: 'Open water 2.5 km, supervised', ex: ['open_water'] },
    { type: 'swim', title: '2 x 1500 m steady', ex: ['steady_sets'] },
    { type: 'gate', title: 'Gate: swim 3.8 km without stopping', ex: ['open_water'] }] },
];

// Bike ladder.
export const BIKE_STAGES = [
  { n: 0, name: 'Ride Ready', target: '30 min', km: 0, minutes: 30, steps: [
    { type: 'bike', title: 'Bike check + braking and gears', ex: ['bike_check'] },
    { type: 'bike', title: 'Easy ride 20 min', ex: ['easy_ride'] },
    { type: 'bike', title: 'Easy ride 25 min', ex: ['easy_ride'] },
    { type: 'gate', title: 'Gate: ride 30 min easy', ex: ['easy_ride'] }] },
  { n: 1, name: 'Hour on the Bike', target: '60 min', km: 0, minutes: 60, steps: [
    { type: 'bike', title: 'Easy ride 40 min', ex: ['easy_ride'] },
    { type: 'bike', title: 'Cadence drills, 45 min', ex: ['cadence'] },
    { type: 'bike', title: 'Easy ride 50 min', ex: ['easy_ride'] },
    { type: 'gate', title: 'Gate: ride 60 min steady', ex: ['easy_ride'] }] },
  { n: 2, name: 'Super Sprint Rider', target: '10 km', km: 10, steps: [
    { type: 'bike', title: 'Clipping in / quick mount practice', ex: ['mount'] },
    { type: 'bike', title: 'Steady 10 km', ex: ['easy_ride'] },
    { type: 'bike', title: 'Brick: 8 km ride + 1 km run', ex: ['brick'] },
    { type: 'gate', title: 'Gate: ride 10 km at steady effort', ex: ['easy_ride'] }] },
  { n: 3, name: 'Sprint Rider', target: '20 km', km: 20, steps: [
    { type: 'bike', title: 'FTP test (20 min)', ex: ['ftp_test'] },
    { type: 'bike', title: '3 x 6 min at threshold', ex: ['threshold_bike'] },
    { type: 'bike', title: 'Brick: 15 km ride + 2 km run', ex: ['brick'] },
    { type: 'gate', title: 'Gate: ride 20 km steady', ex: ['easy_ride'] }] },
  { n: 4, name: 'Olympic Rider', target: '40 km', km: 40, steps: [
    { type: 'bike', title: 'Cornering + group riding skills', ex: ['cornering'] },
    { type: 'bike', title: '3 x 10 min at threshold', ex: ['threshold_bike'] },
    { type: 'bike', title: 'Long ride 30 km + fueling', ex: ['long_ride'] },
    { type: 'gate', title: 'Gate: ride 40 km steady', ex: ['long_ride'] }] },
  { n: 5, name: 'Half Iron Rider', target: '90 km', km: 90, steps: [
    { type: 'bike', title: 'Long ride 60 km + fueling', ex: ['long_ride'] },
    { type: 'bike', title: '2 x 20 min at threshold', ex: ['threshold_bike'] },
    { type: 'bike', title: 'Brick: 50 km ride + 5 km run', ex: ['brick'] },
    { type: 'gate', title: 'Gate: ride 90 km', ex: ['long_ride'] }] },
  { n: 6, name: 'Iron Rider', target: '180 km', km: 180, steps: [
    { type: 'bike', title: 'Long ride 120 km + fueling', ex: ['long_ride'] },
    { type: 'bike', title: '3 x 20 min at race effort', ex: ['threshold_bike'] },
    { type: 'bike', title: 'Brick: 100 km ride + 10 km run', ex: ['brick'] },
    { type: 'gate', title: 'Gate: ride 180 km', ex: ['long_ride'] }] },
];

// Worlds. Each needs a swim stage, a bike stage and a Run Track level, then its gate.
export const TRI_WORLDS = [
  { n: 0, id: 'lake', name: 'Lake Start', emoji: '🏞️', swim: 2, bike: 2, run: 2, race: 'Mini tri',
    gate: { title: 'Gate: mini tri on one day (100 m swim, 15 min bike, 10 min run)', detail: 'Any pace. Pool + bike + run, short breaks are fine.' } },
  { n: 1, id: 'super', name: 'Super Sprint Cove', emoji: '🐚', swim: 4, bike: 3, run: 3, race: 'Super Sprint (400 m / 10 km / 2.5 km)',
    gate: { title: 'Boss: Super Sprint, race or simulation', detail: '400 m swim, 10 km bike, 2.5 km run.', boss: true } },
  { n: 2, id: 'sprint', name: 'Sprint Bay', emoji: '🌊', swim: 5, bike: 4, run: 4, race: 'Sprint (750 m / 20 km / 5 km)',
    gate: { title: 'Boss: Sprint triathlon', detail: '750 m swim, 20 km bike, 5 km run.', boss: true } },
  { n: 3, id: 'olympic', name: 'Olympic Coast', emoji: '🏖️', swim: 6, bike: 5, run: 7, race: 'Olympic (1.5 km / 40 km / 10 km)',
    gate: { title: 'Boss: Olympic triathlon', detail: '1.5 km swim, 40 km bike, 10 km run.', boss: true } },
  { n: 4, id: 'half', name: 'Half Iron Ridge', emoji: '⛰️', swim: 7, bike: 6, run: 9, race: '70.3 (1.9 km / 90 km / 21.1 km)',
    gate: { title: 'Boss: 70.3', detail: '1.9 km swim, 90 km bike, 21.1 km run.', boss: true } },
  { n: 5, id: 'iron', name: 'Iron Summit', emoji: '🌋', swim: 8, bike: 7, run: 11, race: 'Full (3.8 km / 180 km / 42.2 km)',
    gate: { title: 'Boss: full-distance triathlon', detail: '3.8 km swim, 180 km bike, 42.2 km run.', boss: true } },
];
// A world's swim/bike number is "stage reached": swim 2 means S0 and S1 cleared (100 m swum).

export const TRI_EXERCISES = {
  bubbles: { name: 'Bubbles and breathing', dose: '10 x exhale under water', cues: ['Breathe out slowly through nose and mouth', 'Relax your shoulders', 'Stand in shallow water'], search: 'swimming breathing bubbles beginner' },
  float: { name: 'Star float', dose: '5 x 10s', cues: ['Look down, arms and legs wide', 'Let the water hold you', 'Stand up slowly'], search: 'star float swimming beginner' },
  push_glide: { name: 'Push and glide', dose: '8 times', cues: ['Push off the wall, arms straight ahead', 'Head between the arms', 'Glide as far as you can'], search: 'push and glide swimming' },
  kick_board: { name: 'Kick with a board', dose: '6 x 15 m', cues: ['Kick from the hips', 'Small, fast kicks', 'Ankles relaxed'], search: 'freestyle kick with kickboard' },
  short_swims: { name: 'Short swims', dose: 'repeat with rests', cues: ['Swim easy, rest at the wall', 'Breathe every 2 or 3 strokes', 'Stop before you are exhausted'], search: 'beginner freestyle swimming tips' },
  side_kick: { name: 'Side kick', dose: '6 x 15 m', cues: ['Lie on your side, one arm forward', 'Rotate to breathe', 'Long body line'], search: 'side kick drill freestyle' },
  catch_up: { name: 'Catch-up drill', dose: '6 x 25 m', cues: ['One arm waits in front until the other arrives', 'Long reach, full stroke', 'Breathe to the side'], search: 'catch up drill freestyle' },
  bilateral: { name: 'Bilateral breathing', dose: 'breathe every 3 strokes', cues: ['Breathe to both sides', 'Exhale fully under water', 'Keep one goggle in the water'], search: 'bilateral breathing freestyle' },
  steady_sets: { name: 'Steady freestyle', dose: 'as set', cues: ['Even pace, relaxed', 'Count your strokes per length', 'Long, smooth strokes'], search: 'freestyle endurance swim set' },
  css_test: { name: 'CSS test', dose: '400 m + 200 m all-out, full rest', cues: ['Warm up well', 'Time both swims', 'CSS pace = (400 time - 200 time) / 2 per 100 m'], search: 'critical swim speed test' },
  css_sets: { name: 'CSS pace sets', dose: 'as set', cues: ['Hold your CSS pace per 100 m', 'Short rests (10-20s)', 'Even splits'], search: 'css swim set triathlon' },
  sighting: { name: 'Sighting', dose: 'every 6-8 strokes', cues: ['Lift eyes just above the water', 'Then turn to breathe', 'Pick a big landmark'], search: 'sighting open water swimming' },
  open_water: { name: 'Open water swim', dose: 'as set', cues: ['Never alone: lifeguard or group', 'Bright cap, tow float', 'Stay close to the shore at first'], search: 'open water swimming safety beginner' },
  bike_check: { name: 'Bike check', dose: 'before every ride', cues: ['Tyres pumped, brakes work', 'Helmet always', 'Saddle height: slight knee bend at the bottom'], search: 'bike safety check beginner' },
  easy_ride: { name: 'Easy ride', dose: 'as set', cues: ['Conversational effort', 'Smooth pedalling, 80-90 rpm', 'Drink every 15-20 min'], search: 'easy endurance ride cycling' },
  cadence: { name: 'Cadence drills', dose: '5 x 1 min fast spin', cues: ['Light gear, spin fast', 'Stay smooth, no bouncing', 'Easy between'], search: 'cycling cadence drills' },
  mount: { name: 'Mount, dismount, clipping in', dose: '10 practice reps', cues: ['Practise somewhere quiet', 'Look ahead, not down', 'Unclip before you stop'], search: 'triathlon mount dismount practice' },
  ftp_test: { name: 'FTP test', dose: '20 min hard after warm-up', cues: ['Steady hardest effort for 20 min', 'FTP is about 95% of that average power', 'No power meter? Use average heart rate'], search: '20 minute ftp test' },
  threshold_bike: { name: 'Threshold intervals', dose: 'as set', cues: ['Around FTP, hard but steady', 'Easy spin between', 'Stay seated, smooth'], search: 'threshold intervals cycling' },
  cornering: { name: 'Cornering and group riding', dose: '20 min skills', cues: ['Brake before the corner', 'Outside pedal down, look through', 'Hold your line in a group'], search: 'cycling cornering skills beginner' },
  long_ride: { name: 'Long ride', dose: 'as set', cues: ['Easy effort most of the way', 'Eat every 30-45 min', 'Plan a safe route'], search: 'long ride fueling triathlon' },
  brick: { name: 'Brick (bike then run)', dose: 'as set', cues: ['Quick change, start running easy', 'Short, quick steps for the first km', 'Legs feel heavy at first: normal'], search: 'triathlon brick workout beginner' },
};
