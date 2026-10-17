-- Generated from plans.json by scripts/gen-plans.js. Run after schema.sql; safe to re-run.
insert into plans (id, name, amount_paise, grants, valid_days, buyable) values
('free', 'Free', 0, '{"interview":1,"gd":1}'::jsonb, null, false),
('combo', '1 GD + 1 Interview', 17900, '{"gd":1,"interview":1}'::jsonb, null, true),
('gd3', '3 GD Session Pack', 53700, '{"gd":3}'::jsonb, null, true),
('pro', 'Placement Pro', 59900, '{"interview":60,"gd":8}'::jsonb, 30, true),
('premium', 'Premium', 79900, '{"interview":30,"gd":4}'::jsonb, 30, true),
('college', 'College Plan', 179900, '{}'::jsonb, null, false)
on conflict (id) do update set name = excluded.name, amount_paise = excluded.amount_paise, grants = excluded.grants, valid_days = excluded.valid_days, buyable = excluded.buyable;
-- plans removed from plans.json can no longer be bought (kept so past purchases still resolve)
update plans set buyable = false where id not in ('free', 'combo', 'gd3', 'pro', 'premium', 'college');
