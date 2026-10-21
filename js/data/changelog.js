// What changed in each version, newest first. `items` (with details) are for the app owner under 🔔;
// `user` (plain words, optional) shows to everyone once as "What's new". Never show version numbers to users.
// Add an entry with every release.
export const CHANGELOG = [
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
