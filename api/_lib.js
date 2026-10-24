// Shared helpers for the serverless functions (files starting with "_" are not exposed as routes).
const crypto = require("crypto");

const env = () => ({
  supabaseUrl: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
  anon: process.env.SUPABASE_ANON_KEY || "",
  service: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  geminiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim().replace(/^["']|["']$/g, "").trim(),
  dodoKey: (process.env.DODO_PAYMENTS_API_KEY || "").trim(),
  dodoWebhook: (process.env.DODO_PAYMENTS_WEBHOOK_KEY || "").trim(),
  dodoBase: (process.env.DODO_MODE || "test").trim().toLowerCase() === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com",
  siteUrl: (process.env.SITE_URL || "").trim().replace(/\/+$/, "")
});
// Each buyable plan needs a product created in the Dodo dashboard: DODO_PRODUCT_<PLANID> (e.g. DODO_PRODUCT_COMBO).
const dodoProduct = id => (process.env["DODO_PRODUCT_" + String(id).toUpperCase().replace(/[^A-Z0-9]/g, "_")] || "").trim();
const backendOn = () => { const e = env(); return !!(e.supabaseUrl && e.anon && e.service); };
const paymentsOn = () => { const e = env(); return backendOn() && !!e.dodoKey; };

async function readJson(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return null;
}
async function readRaw(req) {
  return await new Promise((resolve, reject) => {
    const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject);
  });
}

// Verifies a Supabase access token and returns { id, email } or null.
async function userFromRequest(req) {
  const e = env(); const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h); if (!m || !e.supabaseUrl) return null;
  try {
    const r = await fetch(e.supabaseUrl + "/auth/v1/user", { headers: { apikey: e.anon, Authorization: "Bearer " + m[1] } });
    if (!r.ok) return null; const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email || "" } : null;
  } catch (err) { return null; }
}

// Calls a Postgres function with the service role. Returns { ok, data, error } where error is the SQL exception message.
async function rpc(fn, args) {
  const e = env();
  try {
    const r = await fetch(e.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: e.service, Authorization: "Bearer " + e.service },
      body: JSON.stringify(args || {})
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: (j && (j.message || j.error)) || "rpc_" + r.status };
    return { ok: true, data: j };
  } catch (err) { return { ok: false, error: "unreachable" }; }
}

// Standard Webhooks (used by Dodo): signature = base64(HMAC_SHA256(base64decode(secret), id.timestamp.body)), header "v1,<sig> v1,<sig2>".
function verifyStandardWebhook(secret, headers, raw) {
  const id = String(headers["webhook-id"] || ""), ts = String(headers["webhook-timestamp"] || ""), sigs = String(headers["webhook-signature"] || "");
  if (!secret || !id || !ts || !sigs) return false;
  if (!(Math.abs(Date.now() / 1000 - Number(ts)) <= 5 * 60)) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(id + "." + ts + "." + raw.toString("utf8")).digest("base64");
  return sigs.split(" ").some(p => { const [v, sig] = p.split(","); return v === "v1" && !!sig && safeEq(sig, expected); });
}
const hmac = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest("hex");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function allowedOrigin(req) {
  const list = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!list.length) return true;
  return list.includes(req.headers.origin || "");
}

const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs); arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}
const clientIp = req => String((req.headers["x-forwarded-for"] || "").split(",")[0] || (req.socket && req.socket.remoteAddress) || "unknown").trim();

module.exports = { dodoProduct, verifyStandardWebhook, env, backendOn, paymentsOn, readJson, readRaw, userFromRequest, rpc, hmac, safeEq, allowedOrigin, limited, clientIp };
