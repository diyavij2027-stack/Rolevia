// Called by the browser after Razorpay Checkout succeeds. Verifies the signature, then grants the plan (idempotent).
const L = require("../_lib");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!L.paymentsOn()) return res.status(503).json({ error: "Payments are not configured on this site yet." });
  const user = await L.userFromRequest(req);
  if (!user) return res.status(401).json({ error: "Please sign in again.", code: "session_expired" });
  const b = await L.readJson(req) || {};
  const order = String(b.razorpay_order_id || ""), pay = String(b.razorpay_payment_id || ""), sig = String(b.razorpay_signature || "");
  if (!/^order_\w+$/.test(order) || !/^pay_\w+$/.test(pay) || !sig) return res.status(400).json({ error: "Invalid payment details." });
  const expected = L.hmac(L.env().rzpSecret, order + "|" + pay);
  if (!L.safeEq(expected, sig)) return res.status(400).json({ error: "Payment signature did not match. Nothing was unlocked.", code: "bad_signature" });
  const g = await L.rpc("grant_plan", { p_order: order, p_payment: pay, p_user: user.id });
  if (!g.ok) return res.status(502).json({ error: "Payment verified but unlocking failed. Contact support with payment id " + pay + "." });
  return res.status(200).json({ ok: true, granted: g.data === true, alreadyApplied: g.data !== true });
};
