import {PGlite} from '@electric-sql/pglite';import fs from 'fs';
const R='/home/claude/rolevia-repo/supabase/';
const db=new PGlite();
await db.exec(`
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create role anon; create role authenticated; create role service_role;
`);
await db.exec(fs.readFileSync(R+'schema.sql','utf8'));await db.exec(fs.readFileSync(R+'plans_seed.sql','utf8'));
await db.exec('grant usage on schema public to authenticated, service_role, anon; grant usage on schema auth to authenticated; grant select on plans to anon, authenticated;');
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const mkUser=async()=>(await db.query('insert into auth.users(email) values ($1) returning id',['u'+Math.random()+'@x.co'])).rows[0].id;
const as=async(uid,sql,params=[])=>{await db.exec(`select set_config('request.jwt.claim.sub','${uid||''}',false); set role authenticated;`);try{return await db.query(sql,params)}finally{await db.exec('reset role')}};
const err=async(uid,sql,params)=>{try{await as(uid,sql,params);return null}catch(e){return e.message}};
const svc=async(sql,params=[])=>{await db.exec('set role service_role');try{return await db.query(sql,params)}finally{await db.exec('reset role')}};
const slotAt=(mins)=>{const t=Math.ceil((Date.now()+mins*60000)/1800000)*1800000;return new Date(t).toISOString()};
const sum=async u=>(await as(u,'select my_summary() s')).rows[0].s;

// signup grants
const u1=await mkUser();let s=await sum(u1);ok(s.interviews==1&&s.gd==1,'new user gets 1 interview + 1 GD credit');
// interview session consumes credit
let r=(await as(u1,"select start_session('interview','{}') r")).rows[0].r;ok(r.interviewsLeft==0,'start_session consumes the free interview');
ok((await err(u1,"select start_session('interview','{}')"))?.includes('no_credits'),'second interview blocked server-side (no_credits)');
// abandoned with <=3 calls refunds
let c=await as(u1,"select close_session($1,'abandoned') r",[r.id]);ok(c.rows[0].r.refunded===true,'abandoned-before-start interview refunded');
s=await sum(u1);ok(s.interviews==1,'credit restored after refund');
r=(await as(u1,"select start_session('interview','{}') r")).rows[0].r;
await svc('select ai_touch($1,$2)',[u1,r.id]);await svc('select ai_touch($1,$2)',[u1,r.id]);await svc('select ai_touch($1,$2)',[u1,r.id]);await svc('select ai_touch($1,$2)',[u1,r.id]);
c=await as(u1,"select close_session($1,'abandoned') r",[r.id]);ok(c.rows[0].r.refunded===false,'abandoned after real use is NOT refunded');
ok((await err(u1,"select close_session($1,'completed')",[r.id]))===null,'closing an already closed session is harmless');
// ai_touch gating
ok((await svc('select ai_touch($1,$2)',[u1,r.id]).catch(e=>e.message))?.includes?.('session_closed'),'AI call on closed session rejected');
const u2=await mkUser();ok((await svc('select ai_touch($1,$2)',[u2,r.id]).catch(e=>e.message))?.includes?.('bad_session'),"AI call with someone else's session rejected");
ok((await err(u1,'select ai_touch($1,null)',[u1]))?.includes('permission denied'),'ai_touch not callable by a normal user');
// solo gd daily limit
let lim=null;for(let i=0;i<6;i++){lim=await err(u2,"select start_session('gd_solo','{}')")}ok(lim?.includes('daily_limit'),'solo GD capped at 5/day');

// GD booking: capacity 6
const slot=slotAt(120);const users=[];for(let i=0;i<8;i++)users.push(await mkUser());
const res=[];for(const u of users)res.push(await err(u,'select book_gd($1::timestamptz,$2,$3)',[slot,'U','random']));
const okc=res.filter(x=>x===null).length,full=res.filter(x=>x&&x.includes('full')).length;
ok(okc===6&&full===2,`8 users, 1 slot -> exactly 6 booked, 2 'full' (got ${okc}/${full})`);
const seats=(await as(users[0],'select * from gd_seats where slot_ms=$1 order by n',[new Date(slot).getTime()])).rows;ok(seats.length===6&&seats.map(x=>+x.n).join()==='1,2,3,4,5,6','seat numbers 1..6 assigned');
// duplicate
const booked=users.filter((u,i)=>res[i]===null)[0];
ok((await err(booked,'select book_gd($1::timestamptz,$2,$3)',[slot,'U','random']))?.includes('already_booked'),'duplicate booking blocked');
// credit consumed -> a user whose only GD credit is used can't book another slot
ok((await err(booked,'select book_gd($1::timestamptz,$2,$3)',[slotAt(300),'U','random']))?.includes('no_credits'),'free user cannot book a 2nd GD (credit used)');
// bad slots
const u3=await mkUser();
ok((await err(u3,"select book_gd(now() + interval '97 minutes','U','random')"))?.includes('bad_slot'),'non-30-minute slot rejected');
ok((await err(u3,"select book_gd($1::timestamptz,'U','random')",[new Date(Math.floor((Date.now()-3600000)/1800000)*1800000).toISOString()]))?.includes('started'),'past slot rejected');
ok((await err(u3,"select book_gd($1::timestamptz,'U','random')",[new Date(Math.ceil((Date.now()+10*86400000)/1800000)*1800000).toISOString()]))?.includes('too_far'),'slot > 8 days away rejected');
ok((await err(null,"select book_gd($1::timestamptz,'U','random')",[slot]))?.includes('not_signed_in'),'anonymous booking rejected');
// conflict: user with 2 credits books overlapping? slots are 30-min aligned so adjacent ok, same slot dup
await svc("select grant_plan('x','y')").catch(()=>{});
// payments
await svc("select create_payment($1,'order_1','gd3')",[u3]);
ok((await svc("select grant_plan('order_1','pay_1',$1) g",[u3])).rows[0].g===true,'payment grants plan');
ok((await svc("select grant_plan('order_1','pay_1',$1) g",[u3])).rows[0].g===false,'second grant for same order is a no-op (idempotent)');
s=await sum(u3);ok(s.gd==4,`gd3 pack adds 3 GD credits on top of free 1 (got ${s.gd})`);
ok((await svc("select create_payment($1,'order_2','free')",[u3]).catch(e=>e.message))?.includes?.('bad_plan'),'free/unbuyable plan cannot be purchased');
ok((await svc("select create_payment($1,'order_3','college')",[u3]).catch(e=>e.message))?.includes?.('bad_plan'),'college plan not buyable online');
await svc("select create_payment($1,'order_4','combo')",[u3]);await svc("select grant_plan('order_4','pay_4',$1)",[u3]);s=await sum(u3);
ok(s.gd==5&&s.interviews==2,`combo adds 1 GD + 1 interview (gd ${s.gd}, interviews ${s.interviews})`);
await svc("select create_payment($1,'order_5','pro')",[u3]);await svc("select grant_plan('order_5','pay_5',$1)",[u3]);s=await sum(u3);
ok(s.interviews==62&&s.gd==13,'pro adds 60 interviews + 8 GD');ok(s.grants.some(g=>g.expires),'pro grants expire (30 days)');
ok((await svc("select grant_plan('order_4','pay_x',$1) g",[u2])).rows[0].g===false,"another user's id cannot claim an order");
// expired credits not usable; consumption order prefers expiring
await db.exec(`update credit_grants set expires_at=now()-interval '1 day' where source='payment' and ref='order_5'`);s=await sum(u3);ok(s.interviews==2&&s.gd==5,'expired grants excluded');
// cancel refund rules
const far=slotAt(180);const u4=await mkUser();await as(u4,"select book_gd($1::timestamptz,'U','ai')",[far]);
let cn=await as(u4,'select cancel_gd($1::timestamptz) r',[far]);ok(cn.rows[0].r.refunded===true,'cancel >=1h before refunds the GD credit');s=await sum(u4);ok(s.gd==1,'credit back after cancel');
const near=slotAt(35);const u5=await mkUser();await as(u5,"select book_gd($1::timestamptz,'U','ai')",[near]);
cn=await as(u5,'select cancel_gd($1::timestamptz) r',[near]);ok(cn.rows[0].r.refunded===false,'cancel <1h before does NOT refund');
ok((await err(u5,'select cancel_gd($1::timestamptz)',[near]))?.includes('not_found'),'cancel without booking rejected');
// seat freed after cancel
const seats2=(await as(u4,'select count(*) c from gd_seats where slot_ms=$1',[new Date(far).getTime()])).rows[0].c;ok(+seats2===0,'cancelled seat frees capacity');
// direct table access blocked
ok((await err(u4,'select * from gd_bookings'))?.includes('permission denied')||(await as(u4,'select * from gd_bookings')).rows.length===0,'users cannot read gd_bookings table directly');
ok((await err(u4,'update credit_grants set remaining=999'))?.includes('permission denied'),'users cannot edit credits directly');
ok((await err(u4,'select * from payments'))?.includes('permission denied'),'users cannot read payments table');
// kv docs
const kslot=slotAt(240);const a=await mkUser(),b=await mkUser(),o=await mkUser();for(const u of [a,b])await as(u,"select book_gd($1::timestamptz,'U','random')",[kslot]);
const ms=new Date(kslot).getTime();
ok((await as(a,"select kv_put('gdbookings',$1,$2::jsonb) r",['topic_'+ms,JSON.stringify({kind:'topic',topic:'T1'})])).rows[0].r.written===true,'participant writes topic');
ok((await as(b,"select kv_put('gdbookings',$1,$2::jsonb) r",['topic_'+ms,JSON.stringify({kind:'topic',topic:'T2'})])).rows[0].r.written===false,'topic is first-writer-wins');
ok((await as(b,"select kv_get('gdbookings',$1) r",['topic_'+ms])).rows[0].r.topic==='T1','all participants see the same topic');
ok((await err(o,"select kv_put('gdbookings',$1,'{}'::jsonb)",['topic_'+ms]))?.includes('not_in_session'),'non-participant cannot write session docs');
ok((await as(o,"select kv_get('gdbookings',$1) r",['topic_'+ms])).rows[0].r===null,'non-participant cannot read session docs');
ok((await err(a,"select kv_put('gdreports',$1,$2::jsonb)",['tr_'+ms+'_'+b,JSON.stringify({uid:b})]))?.includes('not_yours'),"cannot write another participant's transcript");
ok((await as(a,"select kv_put('gdreports',$1,$2::jsonb) r",['tr_'+ms+'_'+a,JSON.stringify({uid:a,text:'hi'})])).rows[0].r.written===true,'own transcript written');
ok((await as(b,"select count(*) c from kv_list('gdreports')")).rows[0].c==1,'participants can list session docs');
ok((await err(a,"select kv_put('gdbookings',$1,$2::jsonb)",['meet_'+ms,JSON.stringify({url:'http://evil'})]))?.includes('bad_url'),'meeting override must be https');
ok((await err(a,"select kv_put('gdbookings',$1,'{}'::jsonb)",['seat_'+ms+'_1']))?.includes('bad_doc'),'cannot forge seat documents via kv');
ok((await as(a,"select kv_acquire('gdreports',$1,'h1',5000) r",['lock_'+ms])).rows[0].r===true,'lease acquired');
ok((await as(b,"select kv_acquire('gdreports',$1,'h2',5000) r",['lock_'+ms])).rows[0].r===false,'second holder cannot take a live lease');
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
