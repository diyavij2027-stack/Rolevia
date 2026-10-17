// Public (non-secret) configuration for the browser. The Supabase anon key is designed to be public;
// data is protected by the database functions, not by hiding this key.
const { env, backendOn, paymentsOn } = require("./_lib");
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const e = env();
  res.status(200).json({
    backend: backendOn(),
    supabaseUrl: backendOn() ? e.supabaseUrl : null,
    supabaseAnonKey: backendOn() ? e.anon : null,
    payments: paymentsOn(),
    razorpayKeyId: paymentsOn() ? e.rzpId : null,
    ai: !!e.geminiKey
  });
};
