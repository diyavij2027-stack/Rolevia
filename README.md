# ROLEVIA

Voice-based interview practice (company- and CV-specific, plus a separate situational and case round), group-discussion practice with live 6-person slots, strict evidence-based reports, and Razorpay payments.

Static front end (`index.html`, built from `src/*.html`) + Vercel serverless functions (`api/`) + Supabase (auth, credits, bookings) + Google Gemini (AI, grounded company research) + Razorpay (payments).

## Set-up (about 20 minutes)

1. **Supabase**: create a project. In *SQL Editor* run `supabase/schema.sql`, then `supabase/plans_seed.sql` (this order, before any user signs up). In *Authentication > URL configuration* set *Site URL* to your Vercel URL and add `https://YOUR-SITE/**` to redirect URLs. For the quickest testing you can turn off *Confirm email*.
2. **Vercel** > Project > Settings > Environment Variables (tick Production, Preview and Development), then **redeploy**:
   `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and for payments `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
3. **Razorpay** (test mode first): create a webhook to `https://YOUR-SITE/api/pay/webhook` for events `payment.captured` and `order.paid`, using the same secret as `RAZORPAY_WEBHOOK_SECRET`.
4. Open `https://YOUR-SITE/api/ai` : it should show `"ok": true`. If not, the JSON says which variable is missing.

The service-role key is only used inside `api/` functions. The browser receives only the public anon key (via `/api/config`).

## What is enforced on the server

- Free plan: **1 interview + 1 group GD** per account (granted by a database trigger on sign-up).
- Every AI call is tied to a signed-in user and, for interviews and solo GDs, to a started session; per-session and daily caps apply. Starting a session spends a credit in the same transaction; abandoned sessions with almost no AI use are refunded.
- Group GD: **max 6 per slot**, one seat per user per slot, no seats within 30 minutes of another booking, slots aligned to 30 minutes and up to 8 days ahead, booking spends a GD credit, cancelling at least 1 hour before the start refunds it. All inside one transaction with a per-slot lock (tested with 28 parallel requests: exactly 6 seats).
- Payments: the amount is read from the `plans` table on the server, never from the browser. Signatures are verified (HMAC-SHA256) for the checkout callback and the webhook; granting is idempotent.

## Pricing (single source: `plans.json`)

Edit `plans.json`, run `node scripts/build.js` (also regenerates `supabase/plans_seed.sql`), re-run the seed SQL, and push. The website, checkout and database all read from it.

## Develop and test

```
node scripts/build.js          # builds index.html and plans_seed.sql
npm i pg @electric-sql/pglite jsdom   # test-only, not needed to deploy
node tests/db-logic.pglite.test.mjs
node tests/db-concurrency.postgres.test.mjs   # needs a local Postgres
node tests/api.postgres.test.mjs
node tests/t_front1.mjs ... t_nocv.mjs        # jsdom front-end tests against a real Postgres
```

## Known limits

- Reports, transcripts and the CV are stored in the user's browser (not synced across devices).
- Group-GD scoring is run by one participant's browser (elected by a lease); a malicious participant could tamper with it. Move it to a server function before using results for anything high-stakes.
- Free-tier Gemini data may be used by Google to improve its products (disclosed in the app).
- Self-service deletion of the server-side account is not built yet.
