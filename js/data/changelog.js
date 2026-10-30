// What changed in each version, newest first. `items` (with details) are for the app owner under 🔔;
// `user` (plain words, optional) shows to everyone once as "What's new". Never show version numbers to users.
// Add an entry with every release.
export const CHANGELOG = [
  { v: 'v108', date: '2026-10-31', title: 'Preview the "Pick your look" pop-up', items: [
    'Open the app with ?pick (…/stride-quest/?pick) to see the pop-up any time; the link cleans itself up. Owners also get "👀 Show the Pick your look pop-up" in Me → Look.',
  ] },
  { v: 'v107', date: '2026-10-31', title: '"Pick your look" pop-up', items: [
    'Once per device, for athletes placed a day+ ago who haven\'t picked a look: a pop-up with a small drawing of each look (New: week dots, hero, START, 4 tabs · Classic: stacked cards, 7 tabs), the one they\'re on marked, and two big buttons. The choice is saved (counts as chosen, so UI_DEFAULT no longer changes it) and counted (ui:A|B:open).',
    'Picking the new look: confetti and "your next session is right at the top". It replaces the What\'s new pop-up that day. Brand-new athletes get it from their second day.',
  ] },
  { v: 'v106', date: '2026-10-31', title: 'Look B: a new, simpler look (A/B test)', items: [
    'Users said Full day is too long and they don\'t know what to do next. Look B (research: Runna, Fitbod, Whoop, Oura, Duolingo, Uber, Revolut, Material 3 Expressive, NN/g): Today = greeting, the week as 7 dots, ONE hero card (today\'s session, why it matters, a big Start), quick actions (Log activity, Not 100%?, Ask coach), a map card ("you are here"), and everything else folded into one-line rows (checklist, week, daily orders, goal, lanes, getting started, daily boost).',
    '4 tabs instead of 7: Today · Map · Coach · You. You = profile + tiles for Stats, Nutrition, Challenges, Races, plus Settings and Help (back arrow on each). No coach bubble in B (Coach is a tab). Every feature is still there; look A is untouched.',
    'A/B: UI_DEFAULT in js/config.js: \'ab\' = new devices get A or B at random; \'A\' or \'B\' = everyone who didn\'t pick gets that look (one-line rollback). Anyone can switch in Me → Look. Test links: ?ui=a / ?ui=b.',
    'Anonymous counts per look: ui:A|B:open (devices), :day (active days), :session (sessions logged).',
  ], userTitle: 'A new, simpler look', user: ['Some of you see a new look: your next session first, with one big Start button, and everything else one tap away. You can switch between the new and classic look in Me → Look.'] },
  { v: 'v105', date: '2026-10-26', title: 'Home Check-in: celebration pop-up with the stage and why', items: [
    'Before the Check-in, no guessed stage is shown: the result screen says "First, a short Check-in" and Today says "Your Check-in sets your stage" (internally Stage 0; skipping restores the "how fit do you feel" stage).',
    'After the Check-in: a pop-up with confetti and a fanfare: the world and stage, a cheer for every level (Stage 0 included), the next Test Day goal, XP and badges (no toasts on top), and "Why this stage?": their results against each Test Day, goal by goal.',
    'Me → My home workouts: "📋 Check-in result" reopens it.',
  ], userTitle: 'Your Check-in result', user: ['After your home Check-in you now see your stage, why you got it, and your next goal.'] },
  { v: 'v104', date: '2026-10-26', title: 'Home: gentler first full push-up goal for women', items: [
    'Rooftop Circuit Test Day (World 4): women need 3 full push-ups instead of 5 (the knee → full step is the biggest on the map). World 5 stays at 12.',
  ] },
  { v: 'v103', date: '2026-10-26', title: 'Home: easier goals from 50 and 60, and a first-session Check-in', items: [
    'Push-up and plank Test Day goals ease with age: ×0.75 from 50, ×0.6 from 60 (HOME_AGE_EASE in js/data/home.js; tests marked age: true). Leg tests stay the same.',
    'Home questions: "How many push-ups and how long a plank?" is now required, with "🤷 I don\'t know: check me in my first session".',
    'No numbers → the first session is a Check-in: max full and knee push-ups, longest plank, squats in 1 minute. They start in the highest world whose Test Day they already pass (up to World 3), with matching push-up and plank floors. Skipping it keeps the "how fit do you feel" level.',
    'Fixed: skipping a home Test Day showed the gym message ("next deload").',
  ], userTitle: 'Home workouts: a Check-in to find your level', user: ['Not sure how many push-ups you can do? Your first home session can be a short Check-in that sets your level for you.'] },
  { v: 'v102', date: '2026-10-26', title: 'Home Test Days: push-up goals by sex', items: [
    'Home Test Day goals live in js/data/home.js (HOME_TESTS). A goal is one number for everyone, or { m, f } when it differs by sex.',
    'Push-ups for women: 8 incline, 6 knee, 12 knee, 5 full, 12 full (men: 10, 8, 15, 10, 20). Plank and leg tests are the same for everyone.',
  ] },
  { v: 'v101', date: '2026-10-26', title: 'Home workouts', items: [
    'New tick "🏠 Home workouts (bodyweight, bands)". It runs as the Gym track in home mode (s.gym.mode = home), so week, calendar, map and coach all work.',
    'One questions screen, nothing pre-picked: equipment (bands, light dumbbells, chair, mat), 10/20/30/45 min, goal (fit, tone, stronger, lose fat), jumping or not, how fit (+ optional push-ups and plank for placement).',
    'Sessions: timed full-body circuits A / B (work / rest per world: 30/30 up to 50/10), warm-up and cool-down, a full-screen timer with beeps and the move spoken. Fit and fat-loss goals get 1-2 home cardio days.',
    'Each move comes from a ladder (wall push-up → incline → knees → full → feet up); "Too hard" / "Too easy" moves one rung. "No jumping" uses low-impact twins (step jacks, skater steps, step-back burpees).',
    'Map: Living Room Arena → Band Camp → Backyard Stadium → Rooftop Circuit → Hall of Home Champions, with home scenery. 6 sessions clear a stage; Test Days check push-ups, plank and a leg test (numbers approved by Abdullah).',
    'Me: "My home workouts" card with settings, "+ Home workouts" for runners and others. Stats: test results. Can\'t tick Gym and Home together.',
    'Home users get their own map character: on a yoga mat, stretching a band.',
    'Daily orders: "5 min foot and ankle work" only shows for people who run (Run, Hybrid, Tri).',
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
