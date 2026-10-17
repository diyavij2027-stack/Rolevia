import pg from 'pg';import fs from 'fs';
const R='/home/claude/rolevia-repo/supabase/';
const cfg={host:'/tmp/pgdata',port:54329,user:'pgtest',database:'postgres'};
const admin=new pg.Client(cfg);await admin.connect();
await admin.query('drop database if exists rt'); await admin.query('create database rt');await admin.end();
const mk=async()=>{const c=new pg.Client({...cfg,database:'rt'});await c.connect();return c};
const a=await mk();
await a.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated; grant usage on schema public to authenticated, service_role;`);
await a.query(fs.readFileSync(R+'schema.sql','utf8'));await a.query(fs.readFileSync(R+'plans_seed.sql','utf8'));
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const users=[];for(let i=0;i<14;i++)users.push((await a.query('insert into auth.users(email) values ($1) returning id',['c'+i])).rows[0].id);
const slot=new Date(Math.ceil((Date.now()+3*3600e3)/1800e3)*1800e3).toISOString();
const run=async(uid,sql,params)=>{const c=await mk();try{await c.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid]);await c.query('set role authenticated');await c.query(sql,params);return null}catch(e){return e.message}finally{await c.end()}};
// 14 users + duplicates (each user fires 2 concurrent requests)
const jobs=[];for(const u of users){jobs.push(run(u,'select book_gd($1::timestamptz,$2,$3)',[slot,'U','random']));jobs.push(run(u,'select book_gd($1::timestamptz,$2,$3)',[slot,'U','random']))}
const res=await Promise.all(jobs);
const okc=res.filter(x=>x===null).length;
const cnt=(await a.query('select count(*)::int c, count(distinct user_id)::int d from gd_bookings where slot=$1',[slot])).rows[0];
ok(cnt.c===6&&cnt.d===6,`28 parallel requests (14 users x2) -> exactly 6 rows, 6 distinct users (rows ${cnt.c}, distinct ${cnt.d})`);
ok(okc===6,`exactly 6 requests succeeded (got ${okc})`);
const reasons={};res.filter(Boolean).forEach(m=>reasons[m]=(reasons[m]||0)+1);console.log('  failure reasons:',JSON.stringify(reasons));
const used=(await a.query("select count(*)::int c from credit_uses where kind='gd' and refunded_at is null")).rows[0].c;
ok(used===6,`only the 6 seated users spent a GD credit (spent ${used})`);
const left=(await a.query("select count(*)::int c from credit_grants where kind='gd' and remaining=0")).rows[0].c;ok(left===6,'credit balances consistent');
// concurrent webhook + verify for same order
const u=users[13];await a.query("select create_payment($1,'ord_c','combo')",[u]);
const g=await Promise.all([1,2,3,4].map(async()=>{const c=await mk();try{return (await c.query("select grant_plan('ord_c','pay_c',$1) g",[u])).rows[0].g}finally{await c.end()}}));
ok(g.filter(Boolean).length===1,`4 racing grant_plan calls -> exactly one applies (${g.filter(Boolean).length})`);
const cg=(await a.query("select kind,amount,remaining from credit_grants where ref='ord_c' order by kind")).rows;ok(cg.length===2,'combo created exactly 2 grants (no double credit)');
// concurrent interview start with 1 credit
const u2=users[0];const st=await Promise.all([1,2,3].map(()=>run(u2,"select start_session('interview','{}')")));
ok(st.filter(x=>x===null).length===1,`3 parallel interview starts with 1 credit -> exactly 1 succeeds (${st.filter(x=>x===null).length})`);
console.log(`\n${pass} passed, ${fail} failed`);await a.end();process.exit(fail?1:0);
