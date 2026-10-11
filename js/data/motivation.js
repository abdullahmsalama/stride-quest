// Encouragement, by who the runner is right now. Picked in motivation.js.
export const BOOSTS = {
  // Coming from no training at all (Level 1, no recent runs)
  starter: [
    'Every runner you admire once ran their very first minute. Today is yours.',
    'Walking counts. Showing up counts. You are already training.',
    'You do not need to be fit to start. You start to get fit.',
    'Slow is not a problem. Stopping is not a problem. Quitting is the only thing that does not move you forward.',
    'Your body is already adapting from the first session. You just cannot see it yet.',
    'Ten minutes beats zero minutes, every single time.',
    'No one is watching your pace. Go at a speed that makes you want to come back.',
    'The hardest part was deciding to start. That part is done.',
  ],
  // Levels 1-3
  beginner: [
    'Walk breaks are part of the plan, not a sign you failed it.',
    'Consistency beats intensity. Three easy runs a week will change you more than one hard one.',
    'If you can talk while you run, you are doing it right.',
    'Each level you clear is proof, not luck.',
    'Tired legs mean you are building. Pain means you rest. Learning the difference is a skill too.',
    'Compare yourself with last month, not with anyone else.',
    'You are building tendons, bones and habits, not just lungs. That takes patience.',
    'A run that felt bad still counts. Most good runners have a lot of those.',
  ],
  // On the Rebuild Track (pain or injury)
  rebuild: [
    'Rebuilding is training. The work you do now is what keeps you running later.',
    'Healing is not linear. A sore day is not a failure, it is information.',
    'Strong tissues come back stronger. This is the foundation, not a detour.',
    'Pain at 2/10 or less is fine. Patience now saves weeks later.',
    'Many runners come back from injury fitter, because they finally did the strength work.',
    'You are not starting over. Your level is saved and your fitness memory is real.',
    'Small, boring, consistent. That is how comebacks are built.',
    'Doing the isometrics today is the bravest training choice you can make.',
  ],
  // Back after a break (refresher course or reclaiming a level)
  comeback: [
    'Muscle memory is real. Fitness comes back faster than it took to build.',
    'Coming back is a skill. You are practising it right now.',
    'You were away, now you are here. That is the only part that matters.',
    'Your old level is waiting, not going anywhere. Reclaim it step by step.',
    'The Prove It run is not a test you can fail. It just shows the fastest way back.',
    'Breaks happen to every runner. The ones who last are the ones who return.',
  ],
  // Everyone else
  general: [
    'Easy days easy, hard days hard. Most people get this backwards.',
    'Strength and landing work is what lets you keep running for years.',
    'Recovery is where the fitness is made. Respect the rest days.',
    'Discipline is remembering what you want most.',
    'Good training is mostly unglamorous. Keep stacking the boring wins.',
    'One step at a time is still the only way to run a marathon.',
  ],
};

// One short line after a logged session.
export const AFTER_SESSION = {
  starter: ['That is one more than yesterday. Brilliant.', 'You did it. Same time next session?', 'First steps are the biggest ones. Well done.'],
  beginner: ['Banked. Your future self says thanks.', 'Another brick in the base.', 'Nice work. Rest well, then go again.'],
  rebuild: ['Careful and consistent. Exactly right.', 'One more step towards running freely.', 'Good. Patience is doing its job.'],
  comeback: ['Back in motion. Keep it rolling.', 'That is how comebacks happen: one session at a time.', 'Your fitness memory just woke up a little more.'],
  general: ['Solid session.', 'Logged. Keep stacking them.', 'Good work. Recover well.'],
};

// When pain means the step is repeated.
export const REPEAT = [
  'Repeating a step is smart training, not going backwards.',
  'Listening to your body is part of the plan. Try again when it feels better.',
  'Rest today, come back stronger. The step will wait for you.',
];
