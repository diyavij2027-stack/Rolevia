// Creates the paid-plan products in Dodo Payments from plans.json and prints the env lines for Vercel.
// Usage:  DODO_PAYMENTS_API_KEY=... [DODO_MODE=test|live] node scripts/setup-dodo.js
// Run it once per mode (test key + DODO_MODE=test, later live key + DODO_MODE=live). Product ids differ per mode.
const plans = require("../plans.json");
const key = (process.env.DODO_PAYMENTS_API_KEY || "").trim();
if (!key) { console.error("Set DODO_PAYMENTS_API_KEY first."); process.exit(1); }
const live = (process.env.DODO_MODE || "test").toLowerCase() === "live";
const base = live ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
(async () => {
  console.log("Mode:", live ? "LIVE" : "test", "\n");
  const lines = [];
  for (const p of (plans.plans || plans).filter(x => x.buyable)) {
    const cents = Math.round(parseFloat(String(p.price).replace(/[^0-9.]/g, "")) * 100);
    if (!(cents > 0)) { console.log("skip", p.id, "(no price)"); continue; }
    const r = await fetch(base + "/products", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ name: "ROLEVIA " + p.name, description: (p.blurb || p.name).slice(0, 300), tax_category: "digital_products",
        price: { type: "one_time_price", currency: "USD", price: cents, discount: 0, purchasing_power_parity: false } })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.product_id) { console.error("FAILED", p.id, r.status, JSON.stringify(j).slice(0, 300)); process.exit(1); }
    console.log("created", p.id, "$" + (cents / 100), j.product_id);
    lines.push("DODO_PRODUCT_" + p.id.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "=" + j.product_id);
  }
  console.log("\nAdd these to Vercel (Settings -> Environment Variables):\n" + lines.join("\n"));
})();
