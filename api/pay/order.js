// Starts a Dodo Payments checkout for a plan. The product (and so the price) is chosen server-side, never by the browser.
const crypto = require("crypto");
const L = require("../_lib");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!L.paymentsOn()) return res.status(503).json({ error: "Payments are not configured on this site yet.", code: "payments_off" });
  if (!L.allowedOrigin(req)) return res.status(403).json({ error: "Origin not allowed." });
  const user = await L.userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Please sign in to buy a plan.", code: "session_expired" });
  if (L.limited("ord:" + user.id, 20, 60 * 60 * 1000)) return res.status(429).json({ error: "Too many attempts. Try again later." });
  const body = await L.readJson(req); const planId = body && String(body.planId || "");
  if (!/^[a-z0-9_-]{1,30}$/.test(planId)) return res.status(400).json({ error: "Unknown plan." });
  const e = L.env();
  let plan;
  try {
    const r = await fetch(e.supabaseUrl + "/rest/v1/plans?id=eq." + encodeURIComponent(planId) + "&select=id,name,amount_paise,buyable", { headers: { apikey: e.service, Authorization: "Bearer " + e.service } });
    const rows = await r.json(); plan = Array.isArray(rows) && rows[0];
  } catch (err) { return res.status(502).json({ error: "Could not load the plan." }); }
  if (!plan || !plan.buyable || !(plan.amount_paise > 0)) return res.status(400).json({ error: "This plan cannot be bought online.", code: "bad_plan" });
  const productId = L.dodoProduct(plan.id);
  if (!productId) return res.status(503).json({ error: "This plan is not set up for checkout yet.", code: "payments_off" });
  const ref = "dd_" + crypto.randomBytes(12).toString("hex");
  const c = await L.rpc("create_payment", { p_user: user.id, p_order: ref, p_plan: plan.id });
  if (!c.ok) return res.status(502).json({ error: "Could not record the order." });
  const origin = e.siteUrl || (req.headers.origin || "");
  try {
    const r = await fetch(e.dodoBase + "/checkouts", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + e.dodoKey },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email },
        return_url: origin ? origin + "/?paid=1" : undefined,
        metadata: { order_ref: ref, user_id: user.id, plan_id: plan.id }
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.checkout_url) return res.status(502).json({ error: (j && (j.message || j.error)) || "Payment provider error." });
    return res.status(200).json({ checkoutUrl: j.checkout_url, orderRef: ref, planName: plan.name });
  } catch (err) { return res.status(502).json({ error: "Could not reach the payment provider." }); }
};
