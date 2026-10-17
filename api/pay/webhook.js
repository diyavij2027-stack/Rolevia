// Razorpay webhook: server-to-server confirmation, so a paid order unlocks sessions even if the browser closes.
// Configure in Razorpay Dashboard -> Webhooks: URL https://YOUR-SITE/api/pay/webhook, events payment.captured and order.paid.
const L = require("../_lib");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const e = L.env();
  if (!L.paymentsOn() || !e.rzpWebhook) return res.status(503).json({ error: "Webhook not configured." });
  const raw = await L.readRaw(req);
  const sig = String(req.headers["x-razorpay-signature"] || "");
  if (!sig || !L.safeEq(L.hmac(e.rzpWebhook, raw), sig)) return res.status(400).json({ error: "Bad signature." });
  let ev; try { ev = JSON.parse(raw.toString("utf8")); } catch (err) { return res.status(400).json({ error: "Bad body." }); }
  const type = ev && ev.event;
  if (type !== "payment.captured" && type !== "order.paid") return res.status(200).json({ ok: true, ignored: type });
  const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
  const ord = ev.payload && ev.payload.order && ev.payload.order.entity;
  const orderId = (pay && pay.order_id) || (ord && ord.id), payId = pay && pay.id;
  if (!orderId || !payId) return res.status(200).json({ ok: true, ignored: "no ids" });
  const g = await L.rpc("grant_plan", { p_order: orderId, p_payment: payId, p_user: null });
  if (!g.ok) return res.status(500).json({ error: "grant failed" });   // non-2xx makes Razorpay retry
  return res.status(200).json({ ok: true, granted: g.data === true });
};
module.exports.config = { api: { bodyParser: false } };
