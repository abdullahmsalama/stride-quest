# Stride Quest

A free, game-style running coach. A questionnaire places you on a level map; you climb through small XP steps on three tracks:

- **Run Track**: 13 levels in 6 worlds (Base Camp → Ultra Frontier), each with steps and a gate test
- **Prep Track**: P0–P7, from mobility and stability to landing, take-off and plyometrics; harder run work unlocks with it
- **Rebuild Track**: R1–R4 for anyone with pain or injury; the run level is saved and restored afterwards

The app also handles coming back after a break: the gap length, partial training and cross-training set a refresher course, and a "Prove It" run can skip it. Pain is rated after every session and the next morning (0–2 progress, 3–4 repeat, 5+ step back).

All game rules are plain JavaScript in `js/engine.js`. The LLM coach only explains and motivates; it never decides levels.

## Run locally

```bash
npm start                       # then open http://localhost:8000 (caching off)
npm test                        # engine tests (Node 18+)
```

Without a Worker URL the built-in offline coach answers.

## Deploy the site (GitHub Pages)

1. Create a repo (e.g. `stride-quest`) and push this folder.
2. Repo **Settings → Pages → Deploy from a branch → `main` / root**.
3. The site appears at `https://<username>.github.io/stride-quest/`.

## Deploy the coach (Cloudflare Worker, free)

1. Free API keys: [Google AI Studio](https://aistudio.google.com/apikey) (Gemini), [Groq](https://console.groq.com/keys), optional [OpenRouter](https://openrouter.ai/keys).
2. In `worker/wrangler.toml`, set `ALLOWED_ORIGINS` and `SITE_URL` to your Pages address.
3. Deploy:
   ```bash
   cd worker
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put OPENROUTER_API_KEY   # optional
   npx wrangler deploy
   ```
4. Put the printed Worker URL in `js/config.js` (`WORKER_URL`), commit and push.

The Worker tries Gemini → Groq → OpenRouter, keeps keys server-side, only accepts your site's origin, and rate-limits per IP (best effort). Model names are in `wrangler.toml`; update them if a provider retires one.

## Files

| Path | What it is |
| --- | --- |
| `js/data/tracks.js` | Worlds, levels, steps, gates, Prep and Rebuild stages |
| `js/data/exercises.js` | Exercise library (dose, cues, video search) |
| `js/data/motivation.js` | Encouragement by audience: starters, beginners, rebuild, comeback |
| `js/engine.js` | Placement, XP, stars, gates, pain rules, return-after-break logic |
| `js/app.js` | UI |
| `js/coach.js` | Coach client, offline coach, voice (Web Speech API) |
| `worker/` | Cloudflare Worker LLM proxy |
| `tests/` | Engine tests |

Not medical advice. Progress is stored in the browser (`localStorage`); use Me → Export to move it.

## Phase 2

GPX/TCX/FIT/CSV uploads, screenshot reading (Gemini vision), VO2max / LT pace / LTHR zones and field tests, WebLLM in-browser fallback, curated exercise videos.
