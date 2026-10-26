// What changed in each version, newest first. `items` (with details) are for the app owner under 🔔;
// `user` (plain words, optional) shows to everyone once as "What's new". Never show version numbers to users.
// Add an entry with every release.
export const CHANGELOG = [
  { v: 'v101', date: '2026-10-26', title: 'Home workouts', items: [
    'New tick "🏠 Home workouts (bodyweight, bands)". It runs as the Gym track in home mode (s.gym.mode = home), so week, calendar, map and coach all work.',
    'One questions screen, nothing pre-picked: equipment (bands, light dumbbells, chair, mat), 10/20/30/45 min, goal (fit, tone, stronger, lose fat), jumping or not, how fit (+ optional push-ups and plank for placement).',
    'Sessions: timed full-body circuits A / B (work / rest per world: 30/30 up to 50/10), warm-up and cool-down, a full-screen timer with beeps and the move spoken. Fit and fat-loss goals get 1-2 home cardio days.',
    'Each move comes from a ladder (wall push-up → incline → knees → full → feet up); "Too hard" / "Too easy" moves one rung. "No jumping" uses low-impact twins (step jacks, skater steps, step-back burpees).',
    'Map: Living Room Arena → Band Camp → Backyard Stadium → Rooftop Circuit → Hall of Home Champions, with home scenery. 6 sessions clear a stage; Test Days check push-ups, plank and a leg test (draft numbers, to confirm).',
    'Me: "My home workouts" card with settings, "+ Home workouts" for runners and others. Stats: test results. Can\'t tick Gym and Home together.',
  ], userTitle: 'Home workouts', user: ['New: short workouts at home with just your body, bands or light dumbbells, with a timer that counts every move for you. Add them in Me → ＋ Home workouts.'] },
  { v: 'v100', date: '2026-10-21', title: 'What\'s new for everyone; no version number for users', items: [
    'Users no longer see the version number anywhere (footer and feedback form).',
    '"🆕 What\'s new" pops up once after an update, only for entries with plain-words user notes, and sits at the bottom of every screen and in Help.',
    'New athletes don\'t get it on their first day.',
  ] },
  { v: 'v99', date: '2026-10-21', title: 'Feedback and the owner bell', items: [
    '💬 "Send feedback" at the bottom of every screen, in Help and in Me. Types: broken, idea, I like…, other.',
    'Optional reply email; "Include my plan" adds their plan so you can see what they see. Otherwise no training or health data is sent.',
    'The coach offers "Tell the Stride Quest team" when someone reports a problem or wishes for a feature.',
    'Each feedback is emailed to you (Resend) and listed under 🔔, with Mark read / Done / Delete.',
    '🔔 also counts Strava access requests and new versions (this list).',
  ], userTitle: 'Tell us what you think', user: ['💬 Send feedback is at the bottom of every screen: report a problem, share an idea or something you like. Add your email if you\'d like a reply.'] },
  { v: 'v98', date: '2026-10-21', title: 'Nothing pre-picked', items: [
    '"Missed a few days?": new "I trained, just forgot to log it" option, which sends them to log the sessions with the right day.',
    'No answer is pre-selected there, nor gender or "What do you train for?" in the questionnaire.',
  ], userTitle: 'Forgot to log?', user: ['Trained but forgot to log it? Pick "I trained, just forgot to log it" when the app asks, then log each session with the day you did it.'] },
  { v: 'v97', title: 'Coach changes sessions', items: [
    'The coach can rewrite any session this week (shorter, easier, up to 25% / +10 min longer, or a different one) or rest it.',
    'Apply button, or type "confirm". Tests and gates stay fixed; nothing gets harder in Rebuild or sick mode.',
  ], userTitle: 'Your coach can adjust sessions', user: ['Tired or short on time? Ask your coach: it can make a session shorter or easier, or rest it this week. Tap Apply or type "confirm".'] },
];
