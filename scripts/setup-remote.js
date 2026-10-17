#!/usr/bin/env node
/* One-command setup: runs the SQL in Supabase, sets the auth URLs, copies the keys into Vercel and redeploys.
   Safe to re-run (the SQL is idempotent, env vars are upserted).

   You need (all created in your own accounts):
     SUPABASE_ACCESS_TOKEN  personal access token  (supabase.com/dashboard/account/tokens)
     SUPABASE_PROJECT_REF   the xxxx in https://xxxx.supabase.co  (Project Settings > General)
     VERCEL_TOKEN           vercel.com/account/tokens
     VERCEL_PROJECT         your Vercel project name (e.g. rolevia)
     SITE_URL               e.g. https://rolevia.xyz
   Optional: VERCEL_TEAM_ID, GEMINI_API_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET

   Run:  node scripts/setup-remote.js
*/
const fs = require("fs"), path = require("path");
const E = process.env;
const need = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF", "VERCEL_TOKEN", "VERCEL_PROJECT", "SITE_URL"].filter(k => !E[k]);
if (need.length) { console.error("Missing: " + need.join(", ") + "\nSee the comment at the top of this file."); process.exit(1); }
const ref = E.SUPABASE_PROJECT_REF.trim(), site = E.SITE_URL.replace(/\/+$/, "");
const team = E.VERCEL_TEAM_ID ? "teamId=" + encodeURIComponent(E.VERCEL_TEAM_ID) : "";
const q = (u, extra = "") => u + (u.includes("?") ? "&" : "?") + [team, extra].filter(Boolean).join("&");

async function call(name, url, opts, token) {
  const r = await fetch(url, { ...opts, headers: { "content-type": "application/json", authorization: "Bearer " + token, ...(opts && opts.headers) } });
  const text = await r.text(); let body; try { body = JSON.parse(text); } catch (e) { body = text; }
  if (!r.ok) throw new Error(`${name} failed (${r.status}): ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  return body;
}
const sb = (n, p, o) => call(n, "https://api.supabase.com/v1/projects/" + ref + p, o, E.SUPABASE_ACCESS_TOKEN);
const vc = (n, p, o) => call(n, "https://api.vercel.com" + p, o, E.VERCEL_TOKEN);

(async () => {
  console.log("1/5 Reading Supabase keys…");
  const keys = await sb("api-keys", "/api-keys");
  const pick = n => (keys.find(k => k.name === n) || {}).api_key;
  const anon = pick("anon"), service = pick("service_role");
  if (!anon || !service) throw new Error("Could not find the anon and service_role keys for this project.");

  console.log("2/5 Running the database SQL…");
  const root = path.join(__dirname, "..", "supabase");
  for (const f of ["schema.sql", "plans_seed.sql"]) {
    await sb("sql " + f, "/database/query", { method: "POST", body: JSON.stringify({ query: fs.readFileSync(path.join(root, f), "utf8") }) });
    console.log("   ran " + f);
  }

  console.log("3/5 Setting the sign-in URLs…");
  await sb("auth config", "/config/auth", { method: "PATCH", body: JSON.stringify({ site_url: site, uri_allow_list: site + "/**" }) });

  console.log("4/5 Adding environment variables in Vercel…");
  const proj = await vc("project", q("/v9/projects/" + encodeURIComponent(E.VERCEL_PROJECT)));
  const vars = { SUPABASE_URL: "https://" + ref + ".supabase.co", SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service };
  for (const k of ["GEMINI_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]) if (E[k]) vars[k] = E[k];
  for (const [key, value] of Object.entries(vars)) {
    await vc("env " + key, q("/v10/projects/" + proj.id + "/env", "upsert=true"), { method: "POST", body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview", "development"] }) });
    console.log("   set " + key);
  }

  console.log("5/5 Redeploying…");
  const list = await vc("deployments", q("/v6/deployments", "projectId=" + proj.id + "&target=production&limit=1"));
  const last = list.deployments && list.deployments[0];
  if (!last) { console.log("   No earlier deployment found. Push a commit or click Deploy in Vercel."); return; }
  const d = await vc("redeploy", q("/v13/deployments", "forceNew=1"), { method: "POST", body: JSON.stringify({ name: E.VERCEL_PROJECT, deploymentId: last.uid, target: "production" }) });
  console.log("   Deployment started: https://" + (d.url || "(see Vercel dashboard)"));
  console.log("\nDone. In about a minute open " + site + "/api/ai : backend should say true.\nStill to do by hand: Razorpay webhook (" + site + "/api/pay/webhook) if you use payments.");
})().catch(e => { console.error("\nStopped: " + e.message); process.exit(1); });
