// Creates a Razorpay order for a plan. The amount always comes from the plans table, never from the browser.
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
  // look up the plan price server-side
  let plan;
  try {
    const r = await fetch(e.supabaseUrl + "/rest/v1/plans?id=eq." + encodeURIComponent(planId) + "&select=id,name,amount_paise,buyable", { headers: { apikey: e.service, Authorization: "Bearer " + e.service } });
    const rows = await r.json(); plan = Array.isArray(rows) && rows[0];
  } catch (err) { return res.status(502).json({ error: "Could not load the plan." }); }
  if (!plan || !plan.buyable || !(plan.amount_paise > 0)) return res.status(400).json({ error: "This plan cannot be bought online.", code: "bad_plan" });
  let order;
  try {
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Basic " + Buffer.from(e.rzpId + ":" + e.rzpSecret).toString("base64") },
      body: JSON.stringify({ amount: plan.amount_paise, currency: "INR", receipt: ("rv_" + user.id.slice(0, 8) + "_" + Date.now()).slice(0, 40), notes: { user_id: user.id, plan_id: plan.id } })
    });
    order = await r.json();
    if (!r.ok || !order.id) return res.status(502).json({ error: (order && order.error && order.error.description) || "Payment provider error." });
  } catch (err) { return res.status(502).json({ error: "Could not reach the payment provider." }); }
  const c = await L.rpc("create_payment", { p_user: user.id, p_order: order.id, p_plan: plan.id });
  if (!c.ok) return res.status(502).json({ error: "Could not record the order." });
  return res.status(200).json({ orderId: order.id, amount: plan.amount_paise, currency: "INR", keyId: e.rzpId, planName: plan.name });
};
