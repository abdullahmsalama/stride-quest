// The two hybrid races the app prepares athletes for. Alpha X facts come from the athlete community
// (see the project notes); weights are not listed anywhere here: always "your division's official weights".
export const RACES = {
  hyrox: {
    name: 'Hyrox', icon: '🏁', site: 'https://hyrox.com', share: 'about 80% endurance',
    divisions: [['open', 'Open'], ['pro', 'Pro']],
    format: () => '8 × (1 km run + station): 8 km of running',
    stations: ['SkiErg 1000 m', 'Sled push 50 m', 'Sled pull 50 m', 'Burpee broad jumps 80 m', 'Row 1000 m', 'Farmers carry 200 m', 'Sandbag lunges 100 m', 'Wall balls 100'],
    firstTime: 'First-timers often finish in 1:30 or more.',
  },
  alphax: {
    name: 'Alpha X', icon: '⚡', site: 'https://alphaxrace.com/', share: 'about 75% endurance',
    divisions: [['base', 'Base'], ['open', 'Open']],
    format: div => (div === 'base' ? '10 × (400 m run + station), shorter and lighter: 4 km of running' : '10 × (800 m run + station): 8 km of running'),
    stations: ['Row', 'SkiErg', 'Sled push', 'Sled pull', 'Burpee broad jumps', 'Box jump overs', 'Farmers carry', 'Bear hug walk', 'Sandbag lunges', 'Wall balls'],
    firstTime: 'First-timers often take 90+ min (Open) or 60+ min (Base).',
  },
};
