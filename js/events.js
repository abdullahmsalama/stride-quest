// Real races from the Egypt Fitness Calendar (its .ics feed), shown per sport the athlete trains for.
// Cached on the device for 12 hours; works offline with the last copy.
const ICS_URL = 'https://abdullahmsalama.github.io/egypt-fitness-calendar/egypt-fitness.ics';
const KEY = 'stride-quest:events';
const TTL = 12 * 3600 * 1000;

// The calendar's sport labels -> the app's tracks.
const SPORT = [
  [/road running|trail|running/i, 'run'],
  [/triathlon|aquathlon/i, 'tri'],
  [/swimming|cycling/i, 'tri'],
  [/hybrid|strength|crossfit/i, 'hybrid'],
];

const unescape = v => v.replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1');
const ymd = v => (/(\d{4})(\d{2})(\d{2})/.exec(v || '') || []).slice(1).join('-');

export function parseIcs(text) {
  const t = String(text || '').replace(/\r?\n[ \t]/g, '');
  const raw = t.split('BEGIN:VEVENT').slice(1).map(ev => {
    const get = k => { const m = new RegExp(`\\n${k}[^:\\n]*:(.*)`).exec(ev); return m ? unescape(m[1].trim()) : ''; };
    return { uid: get('UID'), date: ymd(get('DTSTART')), name: get('SUMMARY'), location: get('LOCATION'), desc: get('DESCRIPTION'), url: get('URL') };
  });
  // "Registration closes: X" entries become a deadline on X.
  const closes = {};
  for (const e of raw) { const m = /^Registration closes:\s*(.+)$/i.exec(e.name); if (m) closes[m[1].trim().toLowerCase()] = e.date; }
  return raw.filter(e => e.date && e.name && !/^Registration closes:/i.test(e.name)).map(e => {
    const [nature = '', label = ''] = e.desc.split('\n')[0].split(' · ');
    const track = (SPORT.find(([re]) => re.test(label)) || [])[1] || null;
    return { ...e, nature, label, track, closes: closes[e.name.toLowerCase()] || null, distance: distanceOf(`${e.name} ${nature}`) };
  });
}

// What kind of race it is, for preparing (and checking the athlete's level against it).
export function distanceOf(text) {
  const t = text.toLowerCase();
  if (/70\.3|half (iron|tri)/.test(t)) return '70.3';
  if (/ironman|full distance|iron(star)?\b/.test(t)) return /ironstar/.test(t) ? 'tri' : 'full';
  if (/triathlon|aquathlon/.test(t)) return 'tri';
  if (/half marathon|half\b/.test(t)) return 'half';
  if (/marathon/.test(t)) return 'marathon';
  if (/\b10\s?k\b/.test(t)) return '10k';
  if (/\b5\s?k\b/.test(t)) return '5k';
  if (/hyrox/.test(t)) return 'hyrox';
  if (/alpha ?x/.test(t)) return 'alphax';
  return null;
}

export async function loadEvents(force = false) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  if (!force && cached && Date.now() - cached.ts < TTL) return cached.events;
  try {
    const r = await fetch(ICS_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const events = parseIcs(await r.text());
    try { localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), events })); } catch { /* ignore */ }
    return events;
  } catch { return cached?.events || []; }
}

// Races for these tracks. Each track gets:
//   soon:     the next two weeks (too close to prepare for: shown as one line),
//   main:     races you can prepare for, major ones first (half/full marathon, 70.3, Alpha X, Hyrox,
//             "flagship" or "historic" in the calendar), then the rest by date,
//   expected: passed yearly races whose next date isn't announced yet ("~same month next year").
const MAJOR = new Set(['half', 'marathon', '70.3', 'full', 'tri', 'hyrox', 'alphax']);
export const isMajor = e => MAJOR.has(e.distance) || /flagship|historic/i.test(e.nature || ''); // (not "world championship": elite-only)
export function upcoming(events, tracks, todayYmd, perTrack = 5) {
  const soonEnd = new Date(new Date(`${todayYmd}T12:00:00`).getTime() + 14 * 864e5).toISOString().slice(0, 10);
  const base = n => n.toLowerCase().replace(/\s*\d{4}\s*$/, '');
  const out = {};
  for (const tr of tracks) {
    const mine = events.filter(e => e.track === tr);
    const next = mine.filter(e => e.date >= todayYmd).sort((a, b) => a.date.localeCompare(b.date));
    const soon = next.filter(e => e.date < soonEnd);
    const later = next.filter(e => e.date >= soonEnd).sort((a, b) => (isMajor(b) - isMajor(a)) || a.date.localeCompare(b.date));
    const announced = new Set(next.map(e => base(e.name)));
    const expected = mine.filter(e => e.date < todayYmd && !announced.has(base(e.name)) && isMajor(e))
      .map(e => ({ ...e, expected: `${+e.date.slice(0, 4) + 1}-${e.date.slice(5, 7)}` }));
    out[tr] = { soon, main: [...later, ...expected].slice(0, perTrack), more: Math.max(0, later.length + expected.length - perTrack) };
  }
  return out;
}

// The two featured races per sport (picked by Abdullah), everything else goes under "Other competitions".
// A featured race that has passed shows as "next edition expected" until its new date is in the calendar.
// `next: 'tri'` = the nearest other race of that kind.
export const FEATURED = {
  run: [/pyramids half/i, /egyptian marathon/i],
  tri: [/ironman 70\.3/i, { next: 'tri' }],
  hybrid: [/alpha ?x/i, /hyrox/i],
};
export function featured(events, track, todayYmd) {
  const mine = events.filter(e => e.track === track);
  const picks = [];
  for (const rule of FEATURED[track] || []) {
    let e;
    if (rule instanceof RegExp) {
      const all = mine.filter(x => rule.test(x.name));
      e = all.filter(x => x.date >= todayYmd).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!e) { const last = all.sort((a, b) => b.date.localeCompare(a.date))[0]; if (last) e = { ...last, expected: `${+last.date.slice(0, 4) + 1}-${last.date.slice(5, 7)}` }; }
    } else {
      e = mine.filter(x => x.distance === rule.next && x.date >= todayYmd && !picks.some(p => p.uid === x.uid)).sort((a, b) => a.date.localeCompare(b.date))[0];
    }
    if (e && !picks.some(p => p.uid === e.uid)) picks.push(e);
  }
  const others = mine.filter(x => x.date >= todayYmd && !picks.some(p => p.uid === x.uid)).sort((a, b) => a.date.localeCompare(b.date));
  return { picks, others };
}

// Days from today to a race (negative = passed).
export const daysTo = (dateYmd, now) => Math.round((new Date(`${dateYmd}T12:00:00`) - new Date(new Date(now).toDateString())) / 864e5);
