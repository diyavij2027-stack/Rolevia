# ROLEVIA

Voice-based interview practice (company- and CV-specific, plus a separate situational and case round), AI-scored group-discussion practice, strict evidence-based reports, and Dodo Payments.

Static front end (`index.html`, built from `src/*.html`) + Vercel serverless functions (`api/`) + Supabase (auth, credits, bookings) + Google Gemini (AI, grounded company research) + Dodo Payments (payments).

## Set-up (about 20 minutes)

1. **Supabase**: create a project. In *SQL Editor* run `supabase/schema.sql`, then `supabase/plans_seed.sql` (this order, before any user signs up). In *Authentication > URL configuration* set *Site URL* to your Vercel URL and add `https://YOUR-SITE/**` to redirect URLs. For the quickest testing you can turn off *Confirm email*.
2. **Vercel** > Project > Settings > Environment Variables (tick Production, Preview and Development), then **redeploy**:
   `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and for payments `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_MODE` (`test` or `live`), `SITE_URL`, and one `DODO_PRODUCT_<PLANID>` per paid plan (`COMBO`, `GD3`, `PRO`, `PREMIUM`).
3. **Dodo Payments** (test mode first): run `DODO_PAYMENTS_API_KEY=... node scripts/setup-dodo.js` to create the products from `plans.json` (it prints the `DODO_PRODUCT_*` lines),  add a webhook to `https://YOUR-SITE/api/pay/webhook` for the `payment.succeeded` event, and put its signing secret in `DODO_PAYMENTS_WEBHOOK_KEY`.
4. Open `https://YOUR-SITE/api/ai` : it should show `"ok": true`. If not, the JSON says which variable is missing.

The service-role key is only used inside `api/` functions. The browser receives only the public anon key (via `/api/config`).

## What is enforced on the server

- Free plan: **1 interview + 1 GD practice** per account (granted by a database trigger on sign-up).
- Every AI call is tied to a signed-in user and, for interviews and solo GDs, to a started session; per-session and daily caps apply. Starting a session spends a credit in the same transaction; abandoned sessions with almost no AI use are refunded.
- Group GD slot booking has been removed from the UI. The booking functions remain in the database but nothing in the app calls them.
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
node tests/t_front1.mjs ... t_nocv.mjs        # jsdom front-end tests against a real Postgres (paths inside are environment-specific)
```

## Known limits

- Reports, transcripts and the CV are stored in the user's browser (not synced across devices).
- Group-GD scoring is run by one participant's browser (elected by a lease); a malicious participant could tamper with it. Move it to a server function before using results for anything high-stakes.
- Free-tier Gemini data may be used by Google to improve its products (disclosed in the app).
- Self-service deletion of the server-side account is not built yet.
