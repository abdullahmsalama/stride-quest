// What changed in each version, newest first. Shown to the app owner under 🔔 (unseen ones count on the bell).
// Add an entry with every release.
export const CHANGELOG = [
  { v: 'v99', date: '2026-10-21', title: 'Feedback and the owner bell', items: [
    '💬 "Send feedback" at the bottom of every screen, in Help and in Me. Types: broken, idea, I like…, other.',
    'Optional reply email; "Include my plan" adds their plan so you can see what they see. Otherwise no training or health data is sent.',
    'The coach offers "Tell the Stride Quest team" when someone reports a problem or wishes for a feature.',
    'Each feedback is emailed to you (Resend) and listed under 🔔, with Mark read / Done / Delete.',
    '🔔 also counts Strava access requests and new versions (this list).',
  ] },
  { v: 'v98', date: '2026-10-21', title: 'Nothing pre-picked', items: [
    '"Missed a few days?": new "I trained, just forgot to log it" option, which sends them to log the sessions with the right day.',
    'No answer is pre-selected there, nor gender or "What do you train for?" in the questionnaire.',
  ] },
  { v: 'v97', title: 'Coach changes sessions', items: [
    'The coach can rewrite any session this week (shorter, easier, up to 25% / +10 min longer, or a different one) or rest it.',
    'Apply button, or type "confirm". Tests and gates stay fixed; nothing gets harder in Rebuild or sick mode.',
  ] },
];
