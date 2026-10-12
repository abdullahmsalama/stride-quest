// Published distributions behind the Stats tab. Every table cites its source; nothing here is
// estimated by an AI. Each table is [[share of the group you beat, value], ...].
// Gaps we deliberately leave out (no reliable distribution found): pull-ups, swimming, Hyrox
// percentiles beyond the median, running by age group.

const t = s => { const p = s.split(':').map(Number); return p.length === 3 ? p[0] * 60 + p[1] + p[2] / 60 : p[0] + p[1] / 60; };
// RunRepeat lists times at the 1st..90th percentile from the fastest; "better than" = 100 - that.
const rr = (...times) => [1, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((c, i) => [100 - c, times[i] == null ? null : t(times[i])]).filter(x => x[1] != null);

const RUNREPEAT = { name: 'RunRepeat runners\' percentile calculator (35M race results, 28,000+ races, updated Mar 2024)', url: 'https://runrepeat.com/uk/how-do-you-masure-up-the-runners-percentile-calculator', note: 'race finishers, by sex; no age split published' };
const OPL = { name: 'FitnessVolt powerlifting strength percentiles, from OpenPowerlifting data (raw lifters)', url: 'https://fitnessvolt.com/strength-standards/research/powerlifting-strength-percentiles/', note: 'competition 1-rep max ÷ weight-class limit; 50th, 90th and 95th percentile' };
const HYROX = { name: 'BoxLife: 700,000 Hyrox results analysed (Pyrox public results dataset)', url: 'https://boxlifemagazine.com/700000-hyrox-results-analysed-here-is-exactly-where-your-finish-time-actually-ranks/', note: 'medians only' };
const AFY = { name: 'A Faster You: FTP W/kg by age (1,710 riders, 2020-2026)', url: 'https://afasteryou.com/blog/en/ftp-watt-per-kg-by-age/', note: 'self-selected trained riders with power meters' };

const run = (label, what, m, f) => ({ label, sport: 'run', fmt: 'time', source: RUNREPEAT, group: who => `${who} who finish ${what} races`, tables: { m: { all: m }, f: { all: f } } });

// Powerlifting tables per weight class (kg limit -> [p50, p90, p95]).
const lifts = cls => Object.fromEntries(Object.entries(cls).map(([k, [a, b, c]]) => [k, [[50, a], [90, b], [95, c]]]));
const SQUAT = {
  m: lifts({ 66: [2.31, 2.95, 3.18], 74: [2.30, 2.91, 3.07], 83: [2.23, 2.80, 2.95], 93: [2.15, 2.69, 2.82], 105: [2.02, 2.52, 2.67], 120: [1.90, 2.38, 2.52] }),
  f: lifts({ 52: [1.78, 2.36, 2.55], 57: [1.80, 2.33, 2.50], 63: [1.71, 2.22, 2.38], 69: [1.78, 2.28, 2.41], 76: [1.68, 2.17, 2.34], 84: [1.46, 1.93, 2.08] }),
};
const DEADLIFT = {
  m: lifts({ 66: [2.80, 3.48, 3.67], 74: [2.74, 3.38, 3.53], 83: [2.62, 3.19, 3.37], 93: [2.47, 3.01, 3.15], 105: [2.29, 2.76, 2.90], 120: [2.08, 2.52, 2.67] }),
  f: lifts({ 52: [2.21, 2.85, 3.03], 57: [2.19, 2.76, 2.94], 63: [2.10, 2.62, 2.78], 69: [2.10, 2.61, 2.75], 76: [1.97, 2.43, 2.61], 84: [1.73, 2.17, 2.29] }),
};
// The lifter's class: the smallest limit at or above their bodyweight (none above the top class).
export function weightClass(sex, bwKg) {
  const limits = Object.keys(SQUAT[sex] || {}).map(Number).sort((a, b) => a - b);
  return limits.find(l => bwKg <= l) ?? null;
}
const lift = (label, data) => ({
  label, sport: 'strength', fmt: 'ratio', source: OPL, lift: true,
  group: who => `raw powerlifting competitors (${who})`,
  // Value is 1RM ÷ bodyweight; the source divides by the class limit, so convert to match.
  resolve: (sex, age, ctx) => {
    if (sex !== 'm' && sex !== 'f') return null;
    const cls = weightClass(sex, ctx.bwKg);
    if (!cls) return null;
    return { table: data[sex][cls], who: `${sex === 'm' ? 'men' : 'women'}, ${cls} kg class`, scale: ctx.bwKg / cls };
  },
});

// FTP W/kg: median and top 10% (25th where published) by age.
const ftpM = { '18-29': [[50, 4.95], [90, 5.77]], '30-39': [[50, 4.30], [90, 5.59]], '40-49': [[25, 3.49], [50, 4.00], [90, 4.88]], '50-59': [[25, 3.27], [50, 3.63], [90, 4.38]], '60+': [[50, 3.23], [90, 4.18]] };
const ftpF = { '18-29': [[50, 4.07], [90, 4.79]], '30-39': [[50, 3.57], [90, 4.68]], '40-49': [[50, 3.48], [90, 4.21]], '50-59': [[50, 3.48], [90, 4.21]], '60+': [[50, 3.48], [90, 4.21]] };

export const NORMS = {
  run5k: run('5K', '5K', rr('17:30', '23:26', '26:04', '27:58', '29:41', '31:28', '33:28', '35:55', '39:21', '45:43'), rr('21:39', '28:24', '31:09', '33:19', '35:21', '37:28', '39:47', '42:36', '46:23', '52:24')),
  run10k: run('10K', '10K', rr('34:24', '45:11', '49:37', '52:28', '54:50', '57:15', '1:00:02', '1:03:43', '1:09:13', '1:19:21'), rr('41:12', '53:35', '58:01', '1:01:02', '1:03:50', '1:06:54', '1:10:38', '1:15:36', '1:22:46', '1:33:14')),
  // Men's half: the source's 40th-60th values (1:58:16, 1:59:48, 2:09:58) break the curve, so they are left out.
  half: run('Half marathon', 'half marathon', rr('1:18:37', '1:40:35', '1:49:13', '1:55:03', null, null, null, '2:16:31', '2:25:57', '2:42:48'), rr('1:35:55', '1:57:01', '2:05:58', '2:12:25', '2:18:10', '2:24:03', '2:30:44', '2:39:05', '2:50:31', '3:08:21')),
  marathon: run('Marathon', 'marathon', rr('2:44:18', '3:22:40', '3:40:13', '3:53:07', '4:03:47', '4:14:29', '4:25:33', '4:38:26', '4:55:33', '5:25:26'), rr('3:11:35', '3:49:22', '4:06:58', '4:20:24', '4:31:21', '4:42:09', '4:53:37', '5:07:36', '5:26:40', '5:56:31')),
  squat: lift('Back squat (est. 1-rep max)', SQUAT),
  deadlift: lift('Deadlift (est. 1-rep max)', DEADLIFT),
  hyrox_open: { label: 'Hyrox Open', sport: 'hyrox', fmt: 'time', source: HYROX, median: true, group: who => `Hyrox Open ${who} finishers`, tables: { m: { all: [[50, t('1:27:56')]] }, f: { all: [[50, t('1:36:20')]] } } },
  hyrox_pro: { label: 'Hyrox Pro', sport: 'hyrox', fmt: 'time', source: HYROX, median: true, group: who => `Hyrox Pro ${who} finishers`, tables: { m: { all: [[50, t('1:20:54')]] }, f: { all: [[50, t('1:26:53')]] } } },
  ftp: { label: 'Cycling FTP', sport: 'bike', fmt: 'wkg', source: AFY, group: who => `power-meter riders (${who})`, tables: { m: ftpM, f: ftpF } },
};

// "Training like this" lines, from national survey data.
const NHIS = { name: 'Bhattacharyya et al., Medicine 2024 (US NHIS 2022, n = 26,494)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11384062' };
const CDC = { name: 'CDC NCHS Data Brief 555 (US NHIS 2024)', url: 'https://www.cdc.gov/nchs/products/databriefs/db555.htm' };
export const ACTIVITY = {
  both: { text: 'Cardio and strength every week: only about 1 in 4 adults (24%) train like you do.', source: NHIS },
  aerobic: { text: 'More than half of adults (53%) don\'t get the recommended weekly activity. You do.', source: CDC },
  started: { text: 'You\'ve started, and that counts: nearly half of adults (46.5%) do neither regular cardio nor strength training.', source: NHIS },
};

// How much endurance and strength go together in adults: r = 0.40 (n = 400, ages 18-40) and 0.55
// (UK Biobank, n = 70,913, ages 40-69). We use 0.5: the higher the correlation, the less rare the
// combination, so this keeps the estimate cautious.
export const RHO = { value: 0.5, source: 'Ajepe et al. 2022 (r = 0.40); Kim et al., Eur J Epidemiol 2018 (r = 0.55)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6153509/' };
