-- ROLEVIA backend schema for Supabase. Run once in the SQL editor (Dashboard -> SQL -> New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- All writes go through SECURITY DEFINER functions; tables have RLS enabled with NO direct policies.


-- ---------- plans (seeded from plans.json by scripts/build.js -> supabase/plans_seed.sql) ----------
create table if not exists plans (
  id text primary key,
  name text not null,
  amount_paise int not null check (amount_paise >= 0),
  grants jsonb not null default '{}',
  valid_days int,
  buyable boolean not null default false
);

-- ---------- credits ----------
create table if not exists credit_grants (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('interview','gd')),
  amount int not null check (amount > 0),
  remaining int not null check (remaining >= 0),
  expires_at timestamptz,
  source text not null,              -- 'free' | 'payment'
  ref text,                          -- payment order id (idempotency)
  created_at timestamptz not null default now()
);
create unique index if not exists credit_grants_ref_uniq on credit_grants(source, ref, kind) where ref is not null;
create index if not exists credit_grants_user on credit_grants(user_id, kind);

create table if not exists credit_uses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  grant_id bigint not null references credit_grants(id),
  ref text,
  used_at timestamptz not null default now(),
  refunded_at timestamptz
);

-- ---------- sessions (interview / solo GD) ----------
create table if not exists app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('interview','gd_solo')),
  meta jsonb not null default '{}',
  credit_use_id bigint references credit_uses(id),
  status text not null default 'open' check (status in ('open','completed','abandoned')),
  ai_calls int not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists app_sessions_user on app_sessions(user_id, created_at desc);

create table if not exists ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (user_id, day)
);

-- ---------- group GD bookings (capacity 6) ----------
create table if not exists gd_bookings (
  slot timestamptz not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  pref text not null default 'random',
  credit_use_id bigint references credit_uses(id),
  created_at timestamptz not null default now(),
  primary key (slot, user_id)
);

-- generic documents used during a live GD (topic, meeting override, transcripts, evaluation)
create table if not exists kv (
  col text not null,
  id text not null,
  data jsonb not null default '{}',
  owner uuid,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
create table if not exists leases (
  col text not null,
  id text not null,
  holder text not null,
  expires_at timestamptz not null,
  primary key (col, id)
);

-- ---------- payments ----------
create table if not exists payments (
  order_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references plans(id),
  amount_paise int not null,
  status text not null default 'created' check (status in ('created','paid','failed')),
  payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table plans enable row level security;
alter table credit_grants enable row level security;
alter table credit_uses enable row level security;
alter table app_sessions enable row level security;
alter table ai_usage enable row level security;
alter table gd_bookings enable row level security;
alter table kv enable row level security;
alter table leases enable row level security;
alter table payments enable row level security;

-- plans are public information
drop policy if exists plans_read on plans;
create policy plans_read on plans for select using (true);

-- ---------- internal helpers ----------
create or replace function _use_credit(p_user uuid, p_kind text, p_ref text) returns bigint
language plpgsql security definer set search_path = public as $$
declare g credit_grants%rowtype; u bigint;
begin
  select * into g from credit_grants
   where user_id = p_user and kind = p_kind and remaining > 0 and (expires_at is null or expires_at > now())
   order by expires_at nulls last, id
   limit 1 for update;
  if not found then raise exception 'no_credits'; end if;
  update credit_grants set remaining = remaining - 1 where id = g.id;
  insert into credit_uses(user_id, kind, grant_id, ref) values (p_user, p_kind, g.id, p_ref) returning id into u;
  return u;
end $$;

create or replace function _refund_credit(p_use bigint) returns boolean
language plpgsql security definer set search_path = public as $$
declare gid bigint;
begin
  update credit_uses set refunded_at = now() where id = p_use and refunded_at is null returning grant_id into gid;
  if gid is null then return false; end if;
  update credit_grants set remaining = remaining + 1 where id = gid and (expires_at is null or expires_at > now());
  return found;
end $$;

-- new users get the Free plan grants (1 interview + 1 GD)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare g jsonb; k text; n int;
begin
  select grants into g from plans where id = 'free';
  if g is not null then
    for k, n in select key, value::int from jsonb_each_text(g) loop
      if n > 0 then insert into credit_grants(user_id, kind, amount, remaining, source, ref) values (new.id, k, n, n, 'free', new.id::text); end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- sessions ----------
create or replace function start_session(p_kind text, p_meta jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); use_id bigint; sid uuid; today int; left_n int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('interview','gd_solo') then raise exception 'bad_kind'; end if;
  if p_kind = 'interview' then
    use_id := _use_credit(uid, 'interview', 'session');
  else
    select count(*) into today from app_sessions where user_id = uid and kind = 'gd_solo' and created_at > now() - interval '24 hours';
    if today >= 5 then raise exception 'daily_limit'; end if;
  end if;
  insert into app_sessions(user_id, kind, meta, credit_use_id) values (uid, p_kind, coalesce(p_meta, '{}'), use_id) returning id into sid;
  if use_id is not null then update credit_uses set ref = sid::text where id = use_id; end if;
  select coalesce(sum(remaining),0) into left_n from credit_grants where user_id = uid and kind = 'interview' and (expires_at is null or expires_at > now());
  return jsonb_build_object('id', sid, 'interviewsLeft', left_n);
end $$;

create or replace function close_session(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s app_sessions%rowtype; refunded boolean := false;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_status not in ('completed','abandoned') then raise exception 'bad_status'; end if;
  select * into s from app_sessions where id = p_id and user_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if s.status <> 'open' then return jsonb_build_object('status', s.status, 'refunded', false); end if;
  -- an interview abandoned before the interviewer really started (setup/greeting only) does not use up the credit
  if p_status = 'abandoned' and s.kind = 'interview' and s.ai_calls <= 3 and s.credit_use_id is not null then
    refunded := _refund_credit(s.credit_use_id);
  end if;
  update app_sessions set status = p_status, closed_at = now() where id = p_id;
  return jsonb_build_object('status', p_status, 'refunded', refunded);
end $$;

-- called by the server (service role) before every AI call
create or replace function ai_touch(p_user uuid, p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s app_sessions%rowtype; c int; cap int;
begin
  if p_session is not null then
    select * into s from app_sessions where id = p_session and user_id = p_user for update;
    if not found then raise exception 'bad_session'; end if;
    if s.status <> 'open' then raise exception 'session_closed'; end if;
    cap := case s.kind when 'interview' then 150 else 40 end;
    if s.ai_calls >= cap then raise exception 'session_cap'; end if;
    update app_sessions set ai_calls = ai_calls + 1 where id = p_session;
  else
    insert into ai_usage(user_id, day, calls) values (p_user, current_date, 1)
      on conflict (user_id, day) do update set calls = ai_usage.calls + 1 returning calls into c;
    if c > 300 then raise exception 'daily_cap'; end if;
  end if;
end $$;

-- ---------- group GD booking ----------
create or replace function book_gd(p_slot timestamptz, p_name text, p_pref text default 'random') returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cnt int; use_id bigint; nm text := left(coalesce(nullif(trim(p_name), ''), 'Participant'), 40);
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if extract(epoch from p_slot)::bigint % 1800 <> 0 then raise exception 'bad_slot'; end if;
  if p_slot <= now() then raise exception 'started'; end if;
  if p_slot > now() + interval '8 days' then raise exception 'too_far'; end if;
  if p_pref not in ('random','ai','current','faq') then p_pref := 'random'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gd:' || p_slot::text, 0));
  if exists (select 1 from gd_bookings where user_id = uid and slot = p_slot) then raise exception 'already_booked'; end if;
  if exists (select 1 from gd_bookings where user_id = uid and slot > p_slot - interval '30 minutes' and slot < p_slot + interval '30 minutes') then
    raise exception 'conflict';
  end if;
  select count(*) into cnt from gd_bookings where slot = p_slot;
  if cnt >= 6 then raise exception 'full'; end if;
  use_id := _use_credit(uid, 'gd', 'gd:' || p_slot::text);
  insert into gd_bookings(slot, user_id, name, pref, credit_use_id) values (p_slot, uid, nm, p_pref, use_id);
  return jsonb_build_object('slot', (extract(epoch from p_slot) * 1000)::bigint, 'taken', cnt + 1, 'capacity', 6);
end $$;

create or replace function cancel_gd(p_slot timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b gd_bookings%rowtype; refunded boolean := false;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended('gd:' || p_slot::text, 0));
  select * into b from gd_bookings where slot = p_slot and user_id = uid for update;
  if not found then raise exception 'not_found'; end if;
  if p_slot <= now() then raise exception 'started'; end if;
  delete from gd_bookings where slot = p_slot and user_id = uid;
  if p_slot - now() >= interval '1 hour' and b.credit_use_id is not null then refunded := _refund_credit(b.credit_use_id); end if;
  return jsonb_build_object('refunded', refunded);
end $$;

-- seats as the app expects them (no credit info). Runs as owner so it can read the RLS-protected table.
create or replace view gd_seats as
  select (extract(epoch from slot) * 1000)::bigint as slot_ms,
         user_id, name, pref,
         row_number() over (partition by slot order by created_at, user_id) as n,
         (extract(epoch from created_at) * 1000)::bigint as at_ms
    from gd_bookings
   where slot > now() - interval '3 hours';
grant select on gd_seats to authenticated;

-- ---------- documents used during a live GD ----------
create or replace function _kv_slot(p_id text) returns timestamptz
language plpgsql immutable as $$
begin
  return to_timestamp(split_part(p_id, '_', 2)::bigint / 1000.0);
exception when others then return null;
end $$;

create or replace function _kv_member(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from gd_bookings b where b.user_id = auth.uid() and b.slot = _kv_slot(p_id));
$$;

create or replace function kv_get(p_col text, p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb;
begin
  if auth.uid() is null or p_col not in ('gdbookings','gdreports') then return null; end if;
  if not _kv_member(p_id) then return null; end if;
  select data into d from kv where col = p_col and id = p_id;
  return d;
end $$;

create or replace function kv_list(p_col text) returns table(id text, data jsonb)
language sql stable security definer set search_path = public as $$
  select k.id, k.data from kv k
   where k.col = p_col and auth.uid() is not null and p_col in ('gdbookings','gdreports') and _kv_member(k.id);
$$;

create or replace function kv_put(p_col text, p_id text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); kind text := split_part(p_id, '_', 1); inserted int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_col not in ('gdbookings','gdreports') then raise exception 'bad_collection'; end if;
  if (p_col = 'gdbookings' and kind not in ('topic','meet')) or (p_col = 'gdreports' and kind not in ('tr','ev')) then raise exception 'bad_doc'; end if;
  if _kv_slot(p_id) is null or not _kv_member(p_id) then raise exception 'not_in_session'; end if;
  if pg_column_size(p_data) > 60000 then raise exception 'too_large'; end if;
  if kind = 'tr' then
    if split_part(p_id, '_', 3) <> uid::text or coalesce(p_data->>'uid','') <> uid::text then raise exception 'not_yours'; end if;
    insert into kv(col, id, data, owner) values (p_col, p_id, p_data, uid)
      on conflict (col, id) do update set data = excluded.data, updated_at = now() where kv.owner = uid;
    return jsonb_build_object('written', true);
  elsif kind = 'meet' then
    if coalesce(p_data->>'url','') !~ '^https://' then raise exception 'bad_url'; end if;
    insert into kv(col, id, data, owner) values (p_col, p_id, p_data, uid)
      on conflict (col, id) do update set data = excluded.data, owner = uid, updated_at = now();
    return jsonb_build_object('written', true);
  else -- topic, ev: first writer wins, never overwritten
    insert into kv(col, id, data, owner) values (p_col, p_id, p_data, uid) on conflict (col, id) do nothing;
    get diagnostics inserted = row_count;
    return jsonb_build_object('written', inserted > 0);
  end if;
end $$;

create or replace function kv_delete(p_col text, p_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_col = 'gdbookings' and split_part(p_id, '_', 1) = 'meet' and _kv_member(p_id) then
    delete from kv where col = p_col and id = p_id;
  end if;
end $$;

create or replace function kv_acquire(p_col text, p_id text, p_holder text, p_ttl_ms int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null or not _kv_member(p_id) then return false; end if;
  insert into leases(col, id, holder, expires_at) values (p_col, p_id, left(p_holder, 100), now() + make_interval(secs => least(p_ttl_ms, 300000) / 1000.0))
    on conflict (col, id) do update set holder = excluded.holder, expires_at = excluded.expires_at
    where leases.expires_at < now() or leases.holder = excluded.holder;
  select (holder = left(p_holder, 100) and expires_at > now()) into ok from leases where col = p_col and id = p_id;
  return coalesce(ok, false);
end $$;

-- ---------- dashboard summary ----------
create or replace function my_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  return jsonb_build_object(
    'interviews', (select coalesce(sum(remaining),0) from credit_grants where user_id = uid and kind = 'interview' and (expires_at is null or expires_at > now())),
    'gd', (select coalesce(sum(remaining),0) from credit_grants where user_id = uid and kind = 'gd' and (expires_at is null or expires_at > now())),
    'grants', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'remaining', remaining, 'expires', expires_at, 'source', source) order by created_at), '[]'::jsonb)
                 from credit_grants where user_id = uid and remaining > 0 and (expires_at is null or expires_at > now())),
    'bookings', (select coalesce(jsonb_agg(jsonb_build_object('slot', (extract(epoch from slot) * 1000)::bigint, 'pref', pref) order by slot), '[]'::jsonb)
                   from gd_bookings where user_id = uid and slot > now() - interval '1 hour'),
    'completedInterviews', (select count(*) from app_sessions where user_id = uid and kind = 'interview' and status = 'completed'),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('plan', plan_id, 'amount', amount_paise, 'paidAt', paid_at) order by paid_at desc), '[]'::jsonb)
                   from (select * from payments where user_id = uid and status = 'paid' order by paid_at desc limit 10) p)
  );
end $$;

-- ---------- payments (service role only) ----------
create or replace function create_payment(p_user uuid, p_order text, p_plan text) returns int
language plpgsql security definer set search_path = public as $$
declare pl plans%rowtype;
begin
  select * into pl from plans where id = p_plan and buyable;
  if not found then raise exception 'bad_plan'; end if;
  insert into payments(order_id, user_id, plan_id, amount_paise) values (p_order, p_user, p_plan, pl.amount_paise);
  return pl.amount_paise;
end $$;

create or replace function grant_plan(p_order text, p_payment text, p_user uuid default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype; pl plans%rowtype; k text; n int;
begin
  update payments set status = 'paid', payment_id = p_payment, paid_at = now()
   where order_id = p_order and status <> 'paid' and (p_user is null or user_id = p_user)
   returning * into pay;
  if not found then return false; end if;
  select * into pl from plans where id = pay.plan_id;
  for k, n in select key, value::int from jsonb_each_text(pl.grants) loop
    if n > 0 then
      insert into credit_grants(user_id, kind, amount, remaining, expires_at, source, ref)
      values (pay.user_id, k, n, n, case when pl.valid_days is null then null else now() + make_interval(days => pl.valid_days) end, 'payment', p_order)
      on conflict do nothing;
    end if;
  end loop;
  return true;
end $$;

-- ---------- permissions ----------
revoke all on function _use_credit(uuid, text, text), _refund_credit(bigint), handle_new_user() from public, anon, authenticated;
revoke all on function ai_touch(uuid, uuid), create_payment(uuid, text, text), grant_plan(text, text, uuid) from public, anon, authenticated;
grant execute on function ai_touch(uuid, uuid), create_payment(uuid, text, text), grant_plan(text, text, uuid) to service_role;
revoke all on function start_session(text, jsonb), close_session(uuid, text), book_gd(timestamptz, text, text), cancel_gd(timestamptz),
  kv_get(text, text), kv_list(text), kv_put(text, text, jsonb), kv_delete(text, text), kv_acquire(text, text, text, int), my_summary() from public, anon;
grant execute on function start_session(text, jsonb), close_session(uuid, text), book_gd(timestamptz, text, text), cancel_gd(timestamptz),
  kv_get(text, text), kv_list(text), kv_put(text, text, jsonb), kv_delete(text, text), kv_acquire(text, text, text, int), my_summary() to authenticated;
revoke all on gd_seats from anon;
