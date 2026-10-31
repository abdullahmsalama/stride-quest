// URL of your deployed Cloudflare Worker, e.g. 'https://stride-quest-coach.yourname.workers.dev'.
// Leave empty to use the built-in offline coach.
// Shown on the Me tab; keep in step with VERSION in sw.js.
export const APP_VERSION = 'v111';
export const WORKER_URL = 'https://stride-quest-coach.stridequest.workers.dev';

// Look A/B test. 'ab': each new device gets A (classic) or B (new look) at random, and everyone can
// switch in Me. 'A' or 'B': everyone who didn't pick one themselves gets that look (one-line rollback).
export const UI_DEFAULT = 'ab';
