// Family mode (under 13): play, not training. WHO 2020: children need an average of 60 minutes of
// moderate-to-vigorous activity a day, mostly aerobic and through play, with bone- and muscle-
// strengthening play 3 days a week. No plans, gates, times, calories or comparisons: just missions.
export const KID_LIKES = [['run', '🏃 Running games'], ['bike', '🚲 Bike / scooter'], ['swim', '🏊 Swimming'], ['ball', '⚽ Ball games'], ['dance', '💃 Dancing'], ['climb', '🧗 Climbing / jumping']];
export const MISSIONS = [
  { id: 'tag', icon: '🏃', kind: 'run', title: 'Tag champion', how: 'Play tag with family or friends. Take turns being "it".', min: 20 },
  { id: 'relay', icon: '🏁', kind: 'run', title: 'Backyard relay', how: 'Make a start and a finish line. Race there and back, pass a "baton" (a sock works!).', min: 15 },
  { id: 'animal', icon: '🦘', kind: 'climb', title: 'Animal moves', how: 'Hop like a kangaroo, crawl like a bear, waddle like a penguin, jump like a frog. 1 minute each.', min: 10 },
  { id: 'obstacle', icon: '🧗', kind: 'climb', title: 'Obstacle course', how: 'Build a course with cushions, chairs and tape lines: crawl under, step over, jump across. Time how fast you get round, then beat it!', min: 20 },
  { id: 'hopscotch', icon: '🔢', kind: 'climb', title: 'Hopscotch', how: 'Draw a hopscotch grid with chalk or tape. Hop on one foot, land on two.', min: 15 },
  { id: 'skip', icon: '🪢', kind: 'climb', title: 'Skipping rope', how: 'How many skips in a row? Try two feet, then one foot, then running skips.', min: 10 },
  { id: 'treasure', icon: '🗺️', kind: 'run', title: 'Treasure hunt walk', how: 'A grown-up hides clues around the park or house. Walk or jog from clue to clue.', min: 30 },
  { id: 'redlight', icon: '🚦', kind: 'run', title: 'Red light, green light', how: 'Run on green, freeze on red! Whoever moves on red goes back to the start.', min: 15 },
  { id: 'bike', icon: '🚲', kind: 'bike', title: 'Bike or scooter adventure', how: 'Ride to the park or around a safe path with a grown-up. Helmet on!', min: 30 },
  { id: 'bikeslalom', icon: '🚧', kind: 'bike', title: 'Bike slalom', how: 'Set up cones or bottles in a line and weave through them. Slowly first, then faster.', min: 20 },
  { id: 'swimgames', icon: '🏊', kind: 'swim', title: 'Pool games', how: 'With a grown-up in the pool: fetch the toy, starfish floats, kick races to the wall.', min: 30 },
  { id: 'splash', icon: '💦', kind: 'swim', title: 'Bubble and glide', how: 'Blow bubbles under water, push off the wall and glide like a rocket.', min: 20 },
  { id: 'kickball', icon: '⚽', kind: 'ball', title: 'Football skills', how: 'Dribble around cones, pass against a wall, then shoot at a goal (two shoes make a goal).', min: 20 },
  { id: 'catch', icon: '🥎', kind: 'ball', title: 'Catch and throw', how: 'Throw and catch a ball. Step back after every 5 catches. Try with the other hand!', min: 15 },
  { id: 'basket', icon: '🏀', kind: 'ball', title: 'Shooting game', how: 'Throw a ball into a basket or box from different spots. Who gets 10 first?', min: 15 },
  { id: 'dance', icon: '💃', kind: 'dance', title: 'Dance party', how: 'Put on 5 favourite songs and dance non-stop. Freeze when the music stops!', min: 20 },
  { id: 'mirror', icon: '🪞', kind: 'dance', title: 'Mirror moves', how: 'Face a partner and copy every move they make. Swap leader every minute.', min: 10 },
  { id: 'balance', icon: '🦩', kind: 'climb', title: 'Flamingo balance', how: 'Stand on one leg like a flamingo. Eyes open, then closed. Swap legs.', min: 5 },
  { id: 'climb', icon: '🧗', kind: 'climb', title: 'Playground explorer', how: 'Climb, swing and slide at the playground. Try something new today!', min: 30 },
  { id: 'nature', icon: '🌳', kind: 'run', title: 'Nature walk', how: 'A walk with family. Find 5 things: a leaf, a bird, a cloud shape, a flower, a bug.', min: 30 },
  { id: 'jumps', icon: '⭐', kind: 'climb', title: 'Star jumps challenge', how: 'Star jumps, tuck jumps, side-to-side jumps: 10 of each, rest, then again.', min: 10 },
  { id: 'family', icon: '👨‍👩‍👧', kind: 'run', title: 'Family race', how: 'A short race in the park with the whole family. Everyone who finishes wins a high five!', min: 15 },
];
export const KID_TIPS = [
  'About 60 minutes of active play a day is the goal (WHO). It can be lots of short bits.',
  'Jumping, climbing and hopping games 3 days a week build strong bones and muscles.',
  'Water is the best drink. Eat a rainbow: fruit and vegetables of different colours.',
  'Kids aged 6-12 need 9-12 hours of sleep.',
  'No calorie counting and no diets for children: growing bodies need fuel.',
  'Make it fun, not a test. Praise effort, not times.',
];
// Today's mission and a bonus one, picked from what the child likes (same all day).
export function missionsFor(likes = [], dayKey = '') {
  const pool = MISSIONS.filter(m => !likes.length || likes.includes(m.kind) || m.kind === 'climb');
  let seed = 0; for (const c of dayKey) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const a = pool[seed % pool.length], rest = pool.filter(m => m !== a && m.kind !== a.kind);
  return [a, (rest.length ? rest : pool.filter(m => m !== a))[(seed >> 3) % Math.max(1, (rest.length || pool.length - 1))]];
}
