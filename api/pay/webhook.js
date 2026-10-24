// Dodo Payments webhook: the only thing that unlocks a paid plan. Signature-verified (Standard Webhooks), idempotent.
// Dodo dashboard -> Developer -> Webhooks: URL https://YOUR-SITE/api/pay/webhook, event payment.succeeded. Copy its signing secret to DODO_PAYMENTS_WEBHOOK_KEY.
const L = require("../_lib");
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const e = L.env();
  if (!L.paymentsOn() || !e.dodoWebhook) return res.status(503).json({ error: "Webhook not configured." });
  const raw = await L.readRaw(req);
  if (!L.verifyStandardWebhook(e.dodoWebhook, req.headers, raw)) return res.status(400).json({ error: "Bad signature." });
  let ev; try { ev = JSON.parse(raw.toString("utf8")); } catch (err) { return res.status(400).json({ error: "Bad body." }); }
  if (!ev || ev.type !== "payment.succeeded") return res.status(200).json({ ok: true, ignored: ev && ev.type });
  const d = ev.data || {}, payId = d.payment_id;
  let ref = d.metadata && d.metadata.order_ref;
  if (!ref && payId) {   // metadata not in the event body: read it from the payment itself (still authenticated with our API key)
    try {
      const r = await fetch(e.dodoBase + "/payments/" + encodeURIComponent(payId), { headers: { Authorization: "Bearer " + e.dodoKey } });
      const j = await r.json().catch(() => null); ref = j && j.metadata && j.metadata.order_ref;
    } catch (err) { return res.status(500).json({ error: "lookup failed" }); }
  }
  if (!ref || !payId) return res.status(200).json({ ok: true, ignored: "no ids" });
  const g = await L.rpc("grant_plan", { p_order: String(ref), p_payment: String(payId), p_user: null });
  if (!g.ok) return res.status(500).json({ error: "grant failed" });   // non-2xx makes Dodo retry
  return res.status(200).json({ ok: true, granted: g.data === true });
};
module.exports.config = { api: { bodyParser: false } };
