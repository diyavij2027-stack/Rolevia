# ROLEVIA

Company-specific, CV-based interview preparation. Upload your CV, pick a company, domain and role, and practise a **voice-only** mock interview whose questions come from your CV and from public interview research. Also includes solo GD practice, a question explorer, reports and progress tracking.

## What works on the website

| Feature | Status |
|---|---|
| Landing, sign-up/sign-in, onboarding, dashboard, progress, reports | Works. Data is stored in the visitor's own browser (localStorage). There is no server-side account system. |
| CV upload (PDF/DOCX), parsing, CV analysis | Works. Files are read in the browser; only extracted text is saved locally. |
| Voice mock interview (company + CV based) | Works in browsers with speech recognition and speech synthesis (Chrome/Edge). Needs the AI proxy for adaptive questions and scoring; without it a rule-based fallback is used and scoring is unavailable. |
| Solo GD practice, Question Explorer | Works; AI scoring/generation needs the AI proxy. |
| Group GD sessions (booking, waiting room, shared evaluation) | **Switched off** on this site: they need a shared database and realtime channel that this deployment does not include. |
| Payments | **Not implemented.** The pricing page is informational; there is no checkout. |

### Research data
There is no live web research. `src/rs.html` holds hand-collected, source-linked public interview reports for 8 companies (Tata Steel, JSW Steel, Puma, Deloitte, HUL, Amazon, Flipkart, Accenture). The evidence is anecdotal. Other companies get an AI briefing clearly labelled as not company-reported.

## Structure

```
index.html          built single-page app (generated, committed)
claude-shim.js      browser adapter: AI -> /api/ai, downloads -> normal download
api/ai.js           serverless proxy to the Anthropic API (key stays server-side)
src/*.html          app source parts (concatenated in order p1,p2,p3,p4,p5,rs,cvx,iv,p6,p7)
scripts/build.js    node scripts/build.js  -> regenerates index.html and syntax-checks
vercel.json         function timeout + security headers
```

## Deploy (Vercel, free tier works)

1. Import this repo at <https://vercel.com/new>. No framework, no build command, no output directory.
2. Add the environment variable **`ANTHROPIC_API_KEY`** (Project Settings → Environment Variables).
3. Deploy. Visit `/api/ai` — it should return `{"ok":true}`.

Optional variables: `ALLOWED_ORIGINS` (comma-separated origins allowed to call the proxy), `RATE_LIMIT_PER_10MIN` (default 40 per IP, best effort per warm instance), `MODEL_QUICK`, `MODEL_DEFAULT`, `MODEL_COMPLEX`.

> **Cost warning:** the proxy spends *your* API credits for every visitor. Set a spend limit on the key in the Anthropic console, and set `ALLOWED_ORIGINS` to your site. For real public traffic, add sign-in-based quotas.

GitHub Pages can host the static files but cannot run `api/ai.js`, so AI features would be off there.

## Develop

```bash
# edit src/*.html, then
node scripts/build.js
npx vercel dev      # serves index.html and /api/ai locally (needs ANTHROPIC_API_KEY in .env)
```

## Known limits
- Real microphone/speech recognition quality depends on the browser; unsupported browsers see a clear message.
- PDF/DOCX parsing libraries (pdf.js, mammoth) load from cdnjs.
- Practice scores and rankings are AI estimates for practice only, not hiring predictions.
