// Generates supabase/plans_seed.sql from plans.json (single source of truth for prices and grants).
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const plans = JSON.parse(fs.readFileSync(path.join(root, "plans.json"), "utf8"));
const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const rows = plans.map(p => `(${q(p.id)}, ${q(p.name)}, ${Math.round(p.amountInr * 100)}, ${q(JSON.stringify(p.grants))}::jsonb, ${p.validDays == null ? "null" : p.validDays}, ${p.buyable ? "true" : "false"})`);
const sql = `-- Generated from plans.json by scripts/gen-plans.js. Run after schema.sql; safe to re-run.
insert into plans (id, name, amount_paise, grants, valid_days, buyable) values
${rows.join(",\n")}
on conflict (id) do update set name = excluded.name, amount_paise = excluded.amount_paise, grants = excluded.grants, valid_days = excluded.valid_days, buyable = excluded.buyable;
`;
fs.writeFileSync(path.join(root, "supabase", "plans_seed.sql"), sql);
console.log("plans_seed.sql written for", plans.length, "plans");
