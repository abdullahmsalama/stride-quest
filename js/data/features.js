// Every feature, written once: the "How it works" guide, "Show me", the getting-started quests,
// the first-time tips and the coach's knowledge of the app all read from this list.
//   show:  where "Show me" goes ({ tab, mapMode?, socialTab?, view? }) and what it highlights (sel)
//   quest: an optional getting-started step: label + done(state, flags) (flags = things seen on this device)
//   tip:   a one-time bubble the first time this element appears (sel; text = the short version)
// `when(state)` hides a feature that doesn't apply (e.g. Hybrid things without the Hybrid track).

const hyb = s => (s.profile?.tracks || []).includes('hybrid');
const tri = s => (s.profile?.tracks || []).includes('tri');
const gym = s => (s.profile?.tracks || []).includes('gym');
const runs = s => (s.profile?.tracks || ['run']).some(t => t !== 'gym');

export const GROUPS = [
  ['today', '🏠 Today'], ['map', '🗺️ Map'], ['race', '🎯 Races'], ['stats', '📊 Stats'], ['coach', '💬 Coach'], ['me', '👤 Me and safety'],
];

export const FEATURES = [
  // ---------- Today ----------
  { id: 'today-next', group: 'today', title: "Today's session", text: 'The card at the top is what to do today, picked from your week. Tap Log it when you are done: say when you did it, how it went and what you actually did. Your words go to the coach.',
    show: { tab: 'today', sel: '.card.next' }, quest: { label: 'Log your first session', done: s => s.history.some(h => h.kind === 'session' || h.kind === 'attempt') } },
  { id: 'videos', group: 'today', title: 'Demo videos', text: 'Every exercise has ▶ Watch how: short demo videos play right inside the session. Tap 👍 if one helped: the most helpful rise to the top for everyone. Know a better one? Paste its link.',
    show: { tab: 'today', sel: '.card.next' } },
  { id: 'views', group: 'today', title: 'Just next or Full day', text: 'Just next shows only what matters now. Full day adds your week, daily orders and the level checklist.',
    show: { tab: 'today', sel: '.today-seg' } },
  { id: 'week', group: 'today', title: 'Your week', text: 'A rolling window from two days back to next week. Tap a session to move it to another day. Rest days count too.',
    show: { tab: 'today', view: 'full', sel: '.card.week' } },
  { id: 'checklist', group: 'today', title: 'Level checklist', text: 'Everything you need to clear the current level, spread over your weeks. The boss gate opens once you have earned enough XP in the level.',
    show: { tab: 'today', view: 'full', sel: '.level-check' } },
  { id: 'modes', group: 'today', title: "Sick, busy or travelling", text: "Tell the app and your plan pauses or shrinks without losing progress. When you're back, it eases you in.",
    show: { tab: 'today', view: 'full', sel: '.modes' } },

  // ---------- Map ----------
  { id: 'map', group: 'map', title: 'Your map', text: 'Your journey as a game map. Each flag is a level; clear its sessions and its boss to move up. Tap a flag to see what it needs.',
    when: runs, show: { tab: 'map', mapMode: 'world', sel: '.worldmap' }, quest: { label: 'Open your map', done: (s, f) => f.tab_map } },
  { id: 'fog', group: 'map', title: 'Clouds ahead', text: 'Worlds far ahead hide under clouds so the climb stays a surprise. They clear as you reach each world. Tap Look ahead to peek at the whole journey, and tap the summit to set your dream.',
    when: runs, show: { tab: 'map', sel: '.fog-peek' }, tip: { sel: '.fog-peek', text: 'Clouds clear as you climb. Tap 👀 Look ahead (it glows) to peek at the whole journey.' } },
  { id: 'replay', group: 'map', title: 'Replay my journey', text: 'Watch your characters climb from the start line to where you are now, clouds and all.',
    when: runs, show: { tab: 'map', sel: '.replay-btn' }, quest: { label: 'Replay your journey on the map', done: (s, f) => f.replay } },
  { id: 'lanes', group: 'map', title: 'Lanes (Hybrid and Triathlon)', text: 'Each sport has its own lane and character. A world gate opens when every lane has reached its target.',
    when: s => hyb(s) || tri(s), show: { tab: 'map', mapMode: 'lanes', sel: '.lane-hud' } },
  { id: 'limiter', group: 'map', title: 'The red ring (limiter)', text: 'The character with a red ring is the lane holding the next gate shut. Train that one to open it.',
    when: s => hyb(s) || tri(s), show: { tab: 'map', mapMode: 'lanes', sel: '.lane-ch.limiter' }, tip: { sel: '.lane-ch.limiter', text: 'Red ring = the lane holding your next gate shut.' } },
  { id: 'sled', group: 'map', title: 'The sled', text: 'Your Engine character pushes a sled. Every Engine stage you clear, it picks up the plate waiting at that level and loads it.',
    when: hyb, show: { tab: 'map', mapMode: 'hyb', sel: '#ln-av-hyb-engine' } },
  { id: 'locks', group: 'map', title: 'Locks', text: 'A locked session always says why: not enough XP in the level yet, a Rebuild after pain, or a lane that rests this block.',
    show: { tab: 'today', view: 'full', sel: '.level-check' } },

  // ---------- Races ----------
  { id: 'race-prep', group: 'race', title: 'Race prep: Alpha X and Hyrox', text: 'Pick Alpha X (Base or Open) or Hyrox (Open or Pro). Your simulations then follow that race\'s format and stations. "What is it?" links to the official website.',
    show: { tab: 'today', sel: '.race-card' }, quest: { label: 'Look at Race prep for Alpha X or Hyrox', done: (s, f) => !!s.hybrid?.race || f.race_info } },
  { id: 'race-weeks', group: 'race', title: 'Race prep, taper and race week', text: 'With a race set, your week changes by itself. Race prep (2-4 weeks out): strength stays heavy but short, at most 2 sessions. Taper (last 2 weeks): less volume, same intensity, no gates or tests. Race week: only short, easy sessions plus one race-pace touch (and light station practice for Hyrox / Alpha X). Race day is in your week, and the week after is recovery.' },
  { id: 'split', group: 'me', title: 'Strength split', text: 'How your lifting is grouped, picked for your strength days: 1-2 days full body, 3 days Lower / Upper / Full, 4 days Upper / Lower, 5 days Upper / Lower / Push / Pull / Legs, 6 days Push / Pull / Legs. In race prep it switches to 1-2 short full-body sessions, then one half-volume session in the taper and none in race week. Change it in Me.', show: { tab: 'me', sel: '.split-card' } },
  { id: 'gym', group: 'me', title: 'Gym track', text: 'For lifting: muscle, strength, fitness or fat loss. Your split is picked from your gym days, goal, experience, age and other sports (full body, Upper / Lower, Push / Pull / Legs, or a bro split like Chest + Triceps / Back + Biceps when muscle is the goal and you have 1+ years of lifting). Each session lists sets, reps, rest, effort and a suggested weight: log what you lifted and the next weights follow. Training runs in blocks: build weeks, then a deload week (half the sets). Main lifts stay; the other exercises change every block, and every few blocks the app offers a new split. Stages clear when your logged lifts reach the standard; each world ends with a Test Day. Gym only? The running questions and sessions are skipped.',
    when: gym, show: { tab: 'me', sel: '.gym-card' } },
  { id: 'cycle', group: 'me', when: s => s.profile?.sex === 'f', title: 'Your cycle (optional)', text: 'Tell the app when your last period started and it follows your cycle. Period days get a bit lighter sessions (one set fewer in the gym, about two-thirds of a run, ride or swim, fewer reps in intervals); tap "Feeling good? Full sessions today" any time, or "Feeling rough? Go lighter" on any other day. Each phase brings a short training and food tip, with a little more food in the second half of your cycle. When your period is due, the app asks once a day if it started, until you say yes, prefer not to say, or close it. It all stays on your phone; the AI coach only sees your phase if you switch that on in Me.' },
  { id: 'ages', group: 'me', title: 'Kids and teens', text: 'Under 13: Family mode, set up with a grown-up: a fun play mission every day and a sticker book, with no plans, times, calories, chat or sharing. 13-17: Teen mode: the full app, with food shown as portions (never a diet), no max-weight lifting gates, run levels up to 10K (under 16) or half marathon (16-17), and races limited to the usual minimum ages.' },
  { id: 'target', group: 'race', title: 'Competition mode', text: 'Tap 🎯 Set as my race on any race. The app checks it honestly against your level and training days: realistic, doable at a slower pace, or not yet (with a shorter distance or a later race instead). Your plan stays your levels; in the last 4 weeks Today switches to race prep, a taper and race week, then you log your result.',
    show: { tab: 'today', sel: '.race-card' }, quest: { label: 'Pick a race to prepare for', done: s => !!s.target } },
  { id: 'calendar', group: 'race', title: 'Competitions Calendar', text: 'Real events to enter. Egypt opens the Egypt Fitness Calendar with every event we can verify; worldwide is coming soon.',
    show: { tab: 'events', sel: '.comp-card' }, quest: { label: 'Find a competition in the calendar', done: (s, f) => f.tab_events } },
  { id: 'challenge', group: 'race', title: 'Challenge a friend', text: 'Send a friend a challenge link. It fits their level, so it is fair whoever you challenge.',
    show: { tab: 'challenge', socialTab: 'challenges', sel: '.seg' }, quest: { label: 'Challenge a friend', done: s => (s.challenges?.sent || []).length > 0 } },

  // ---------- Stats ----------
  { id: 'stats', group: 'stats', title: 'How you compare', text: 'Your bests compared with published race and lifting results: better than X% of runners, lifters or riders. Below the middle you see your next milestone instead.',
    show: { tab: 'stats', sel: '.stats-hero' }, quest: { label: 'Add your bests in Stats', done: s => !!s.bests } },
  { id: 'rarity', group: 'stats', title: 'Hybrid rarity', text: 'Good at two different sports at once? It estimates how rare that combination is. It is a cautious estimate.',
    show: { tab: 'stats', sel: '.rare' } },
  { id: 'community', group: 'stats', title: 'Compare with app athletes', text: 'Optional and anonymous: compare with other Stride Quest athletes of your sex and age group. Switch it off and your numbers are deleted.',
    show: { tab: 'stats', sel: '[data-act=share-toggle]' } },

  // ---------- Coach ----------
  { id: 'coach', group: 'coach', title: 'Your AI coach', text: 'Tap the little coach in the corner of any screen. Ask what to do today, how a drill works, what to eat, or tell it about pain. It can suggest changes, but nothing changes until you tap Apply.',
    show: { tab: 'coach', sel: '.chat-input' }, quest: { label: 'Ask the coach a question', done: (s, f) => f.coach_asked } },

  { id: 'nutrition', group: 'today', title: 'Nutrition', text: 'Daily calories and macros that follow your training: more carbs on long and hard days, protein spread over the day, fuelling for long sessions and races. If your goal clashes with your training (dieting in race week, while injured), a clear warning explains why, with a safer option you can apply.',
    show: { tab: 'nutrition', sel: '.nutri-today, .nutri-hero' }, quest: { label: 'Set up your nutrition', done: s => !!s.nutrition?.setup } },
  // ---------- Me and safety ----------
  { id: 'numbers', group: 'me', title: 'My numbers', text: 'Your bodyweight, lifts and pull-ups (and body fat, if you like). Updating them re-places your Strength lane.',
    when: hyb, show: { tab: 'me', sel: '[data-act=edit-numbers]' }, quest: { label: 'Check My numbers', done: s => (s.bodyLog || []).length > 0, when: hyb } },
  { id: 'background', group: 'me', title: 'Sporting background', text: 'Trained seriously before? Add it: your technique is credited and gates open early while you climb back.',
    show: { tab: 'me', sel: '[data-act=edit-bg]' } },
  { id: 'dream', group: 'me', title: 'Your dream', text: 'Your goal sits on the summit of your map. Tap the summit to set or change it.',
    show: { tab: 'map', sel: '.fog-summit' }, quest: { label: 'Set your dream', done: s => !!(s.profile?.dream?.text || s.profile?.dream?.event) } },
  { id: 'pain', group: 'me', title: 'Pain and the Rebuild track', text: 'Report pain when you log a session. The app moves you to the Rebuild track, locks impact work and tells you why. Once you are pain-free, you come back near your old level.',
    when: runs, show: { tab: 'today', sel: '.card.next' } },
  { id: 'strava', group: 'me', title: 'Connect Strava', text: 'Connect once in Me and your workouts come in by themselves from any watch or app that syncs to Strava (Garmin, Apple Watch, COROS, Runna…). A run can count as your planned session with one tap; other workouts count in your week and Nutrition. Read-only, and you can disconnect any time.',
    show: { tab: 'me', sel: '.strava-card' } },
  { id: 'data', group: 'me', title: 'Your data', text: 'Everything is saved in this browser. Export it to move to another phone, or retake the assessment (with your previous answers in one tap).',
    show: { tab: 'me', sel: '[data-act=export]' } },
];

// For the coach: one short line per feature (title, the first sentence, and where it lives).
const WHERE = { today: 'Today tab', map: 'Map tab', stats: 'Stats tab', coach: 'Coach tab', me: 'Me tab', events: 'Competitions Calendar tab', challenge: 'Challenge tab' };
export const FEATURE_BRIEF = FEATURES.map(f => `- ${f.title} (${WHERE[f.show?.tab] || 'app'}): ${f.text.split(/(?<=\.) /)[0]}`).join('\n');
