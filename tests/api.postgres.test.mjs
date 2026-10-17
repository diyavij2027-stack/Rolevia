import pg from 'pg';import fs from 'fs';import crypto from 'crypto';import {createRequire} from 'module';
const require=createRequire(import.meta.url);const A='/home/claude/rolevia-repo/api/';
const R='/home/claude/rolevia-repo/supabase/';
const cfg={host:'/tmp/pgdata',port:54329,user:'pgtest',database:'postgres'};
let admin=new pg.Client(cfg);await admin.connect();await admin.query('drop database if exists rt2');await admin.query('create database rt2');await admin.end();
const pool=new pg.Pool({...cfg,database:'rt2',max:10});
await pool.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
create schema if not exists auth; create table if not exists auth.users(id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated; grant usage on schema public to authenticated, service_role;`);
await pool.query(fs.readFileSync(R+'schema.sql','utf8'));await pool.query(fs.readFileSync(R+'plans_seed.sql','utf8'));
// env
Object.assign(process.env,{SUPABASE_URL:'https://sb.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'svc',GEMINI_API_KEY:'AIza'+'x'.repeat(35),RAZORPAY_KEY_ID:'rzp_test_1',RAZORPAY_KEY_SECRET:'sec123',RAZORPAY_WEBHOOK_SECRET:'whsec'});
const tokens=new Map();let geminiCalls=[],rzpOrders=0,gemReply=null;
const mkUser=async(email)=>{const id=(await pool.query('insert into auth.users(email) values ($1) returning id',[email])).rows[0].id;const t='tok_'+id;tokens.set(t,{id,email});return{id,token:t}};
const jres=(status,body)=>({ok:status<400,status,headers:{get:()=>null},json:async()=>body,text:async()=>JSON.stringify(body)});
global.fetch=async(url,o={})=>{url=String(url);
 if(url.startsWith('https://sb.test/auth/v1/user')){const t=/Bearer (.+)/.exec(o.headers.Authorization)?.[1];const u=tokens.get(t);return u?jres(200,u):jres(401,{message:'bad jwt'})}
 if(url.startsWith('https://sb.test/rest/v1/rpc/')){const fn=url.split('/rpc/')[1];const args=JSON.parse(o.body||'{}');const keys=Object.keys(args);const c=await pool.connect();try{await c.query('set role service_role');const q=`select ${fn}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as r`;const r=await c.query(q,keys.map(k=>args[k]));return jres(200,r.rows[0].r)}catch(e){return jres(400,{message:e.message})}finally{await c.query('reset role').catch(()=>{});c.release()}}
 if(url.startsWith('https://sb.test/rest/v1/plans')){const id=/id=eq\.([^&]+)/.exec(url)[1];const r=await pool.query('select id,name,amount_paise,buyable from plans where id=$1',[decodeURIComponent(id)]);return jres(200,r.rows)}
 if(url.startsWith('https://api.razorpay.com/v1/orders')){rzpOrders++;const b=JSON.parse(o.body);return jres(200,{id:'order_T'+rzpOrders,amount:b.amount,currency:b.currency})}
 if(url.includes('generativelanguage.googleapis.com')){const b=JSON.parse(o.body);geminiCalls.push({url,b});return jres(200,gemReply||{candidates:[{content:{parts:[{text:'{"ok":1}'}]},finishReason:'STOP'}]})}
 if(url.startsWith('https://redir.test/')){return {ok:false,status:302,headers:{get:h=>h==='location'?'https://www.example.com/careers':null}}}
 throw new Error('unmocked '+url)};
const call=async(mod,{method='POST',body,headers={},token,ip='9.9.9.9',raw}={})=>{const h=require(A+mod);const res={code:200,headers:{},body:null,setHeader(k,v){res.headers[k]=v},status(c){res.code=c;return res},json(b){res.body=b;return res}};
 const hd={'x-forwarded-for':ip,...headers};if(token)hd.authorization='Bearer '+token;
 const {Readable}=await import('stream');let req;
 if(raw!==undefined){req=Readable.from([Buffer.from(raw)]);req.headers=hd;req.method=method;req.socket={}}
 else req={method,headers:hd,body,socket:{}};
 await h(req,res);return res};
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m)};
const u1=await mkUser('a@x.co'),u2=await mkUser('b@x.co');
let r=await call('config.js',{method:'GET'});ok(r.body.backend&&r.body.payments&&r.body.supabaseUrl&&!JSON.stringify(r.body).includes('svc')&&!JSON.stringify(r.body).includes('sec123'),'config exposes only public values (no service key / secrets)');
// AI gating
r=await call('ai.js',{body:{prompt:'hi'}});ok(r.code===401,'AI without sign-in -> 401');
r=await call('ai.js',{body:{prompt:'hi'},token:'tok_bad'});ok(r.code===401,'AI with invalid token -> 401');
r=await call('ai.js',{body:{prompt:'hi'},token:u1.token});ok(r.code===200,'AI misc call (CV analysis etc.) with sign-in works');
// interview session via DB (as the browser would)
const rpcUser=async(u,sql,p=[])=>{const c=await pool.connect();try{await c.query(`select set_config('request.jwt.claim.sub',$1,false)`,[u.id]);await c.query('set role authenticated');return (await c.query(sql,p)).rows[0]}finally{await c.query('reset role');c.release()}};
const s=(await rpcUser(u1,"select start_session('interview','{}') r")).r;
r=await call('ai.js',{body:{prompt:'q',sessionId:s.id},token:u1.token});ok(r.code===200,'AI call inside own open session works');
r=await call('ai.js',{body:{prompt:'q',sessionId:s.id},token:u2.token});ok(r.code===403&&r.body.code==='bad_session',"AI call using someone else's session -> 403");
r=await call('ai.js',{body:{prompt:'q',sessionId:'00000000-0000-0000-0000-000000000000'},token:u1.token});ok(r.code===403,'unknown session id -> 403');
await rpcUser(u1,"select close_session($1,'completed') r",[s.id]);
r=await call('ai.js',{body:{prompt:'q',sessionId:s.id},token:u1.token});ok(r.code===403&&r.body.code==='session_closed','AI call on a finished session -> 403');
const s2=(await rpcUser(u2,"select start_session('gd_solo','{}') r")).r;await pool.query('update app_sessions set ai_calls=40 where id=$1',[s2.id]);
r=await call('ai.js',{body:{prompt:'q',sessionId:s2.id},token:u2.token});ok(r.code===403&&r.body.code==='session_cap','per-session AI cap enforced');
await pool.query("insert into ai_usage(user_id,day,calls) values ($1,current_date,300) on conflict (user_id,day) do update set calls=300",[u2.id]);
r=await call('ai.js',{body:{prompt:'q'},token:u2.token});ok(r.code===429&&r.body.code==='daily_cap','daily misc cap enforced');
r=await call('ai.js',{body:{prompt:'x'.repeat(70000)},token:u1.token});ok(r.code===413,'oversized prompt rejected');
// research
gemReply={candidates:[{content:{parts:[{text:'```json\n{"found":true,"officialName":"Acme Ltd","summary":"Makes things.","businessModel":"B2B","products":["Widgets"],"culture":["Frugal"],"recentDevelopments":[{"date":"Sep 2026","item":"Opened plant"}],"roleRequirements":["Excel"],"hiringProcess":null,"interviewSignals":[],"likelyCaseAreas":["Margin pressure"],"limits":"No interview data"}\n```'}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://redir.test/a',title:'acme.com'}},{web:{uri:'https://redir.test/a',title:'acme.com'}}],webSearchQueries:['acme ltd']},finishReason:'STOP'}]};
geminiCalls=[];r=await call('research.js',{body:{company:'Acme Ltd',role:'Marketing'},token:u1.token});
ok(r.code===200&&r.body.found&&r.body.grounded&&r.body.sources.length===1&&r.body.sources[0].url==='https://www.example.com/careers','research returns structured data + de-duplicated, resolved source links');
ok(geminiCalls[0].b.tools?.[0]?.google_search&&/ONLY on what you find/.test(geminiCalls[0].b.contents[0].parts[0].text),'research call uses Google Search grounding and a no-invention instruction');
gemReply={candidates:[{content:{parts:[{text:'{"found":true,"officialName":"Ghost Co","summary":"Made up","products":["x"]}'}]},finishReason:'STOP'}]};
r=await call('research.js',{body:{company:'Ghost Co'},token:u1.token});ok(r.code===200&&r.body.found===false&&r.body.grounded===false,'no search sources -> NOT presented as found/verified');
r=await call('research.js',{body:{company:'A'},token:u1.token});ok(r.code===400,'research validates company name');
r=await call('research.js',{body:{company:'Acme'}});ok(r.code===401,'research requires sign-in');
gemReply=null;
// payments
const price=async id=>(await pool.query('select amount_paise from plans where id=$1',[id])).rows[0].amount_paise;
r=await call('pay/order.js',{body:{planId:'combo'}});ok(r.code===401,'order requires sign-in');
r=await call('pay/order.js',{body:{planId:'free'},token:u1.token});ok(r.code===400,'free plan cannot be ordered');
r=await call('pay/order.js',{body:{planId:'college'},token:u1.token});ok(r.code===400,'college plan cannot be ordered online');
r=await call('pay/order.js',{body:{planId:'nope'},token:u1.token});ok(r.code===400,'unknown plan rejected');
r=await call('pay/order.js',{body:{planId:'combo',amount:1},token:u1.token});ok(r.code===200&&r.body.amount===17900&&r.body.keyId==='rzp_test_1','order amount comes from the server (₹179 = 17900 paise), client amount ignored');
const ord=r.body.orderId;
const before=(await rpcUser(u1,'select my_summary() s')).s;
const sigOf=(o,p,sec='sec123')=>crypto.createHmac('sha256',sec).update(o+'|'+p).digest('hex');
r=await call('pay/verify.js',{body:{razorpay_order_id:ord,razorpay_payment_id:'pay_A1',razorpay_signature:'0'.repeat(64)},token:u1.token});ok(r.code===400&&r.body.code==='bad_signature','forged signature rejected');
let mid=(await rpcUser(u1,'select my_summary() s')).s;ok(mid.gd===before.gd&&mid.interviews===before.interviews,'nothing unlocked after a forged signature');
r=await call('pay/verify.js',{body:{razorpay_order_id:ord,razorpay_payment_id:'pay_A1',razorpay_signature:sigOf(ord,'pay_A1')},token:u2.token});ok(r.code===200&&r.body.granted===false,"another user cannot claim someone else's paid order");
r=await call('pay/verify.js',{body:{razorpay_order_id:ord,razorpay_payment_id:'pay_A1',razorpay_signature:sigOf(ord,'pay_A1')},token:u1.token});ok(r.code===200&&r.body.granted===true,'valid signature unlocks the plan');
let after=(await rpcUser(u1,'select my_summary() s')).s;ok(after.gd===before.gd+1&&after.interviews===before.interviews+1,`combo unlocked exactly +1 GD, +1 interview (gd ${before.gd}->${after.gd}, int ${before.interviews}->${after.interviews})`);
r=await call('pay/verify.js',{body:{razorpay_order_id:ord,razorpay_payment_id:'pay_A1',razorpay_signature:sigOf(ord,'pay_A1')},token:u1.token});ok(r.code===200&&r.body.granted===false&&r.body.alreadyApplied,'repeat verify is idempotent');
// webhook
const evBody=(o,p)=>JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:p,order_id:o}}}});
r=await call('pay/order.js',{body:{planId:'gd3'},token:u2.token});const ord2=r.body.orderId;
let b2=evBody(ord2,'pay_B1');
r=await call('pay/webhook.js',{raw:b2,headers:{'x-razorpay-signature':'bad'}});ok(r.code===400,'webhook with bad signature rejected');
const wsig=crypto.createHmac('sha256','whsec').update(b2).digest('hex');
const pre=(await rpcUser(u2,'select my_summary() s')).s;
const rs=await Promise.all([call('pay/webhook.js',{raw:b2,headers:{'x-razorpay-signature':wsig}}),call('pay/webhook.js',{raw:b2,headers:{'x-razorpay-signature':wsig}}),call('pay/verify.js',{body:{razorpay_order_id:ord2,razorpay_payment_id:'pay_B1',razorpay_signature:sigOf(ord2,'pay_B1')},token:u2.token})]);
const post=(await rpcUser(u2,'select my_summary() s')).s;ok(post.gd===pre.gd+3,`2 webhooks + 1 verify racing -> pack credited exactly once (+3 GD: ${pre.gd}->${post.gd})`);
r=await call('pay/webhook.js',{raw:JSON.stringify({event:'payment.failed',payload:{}}),headers:{'x-razorpay-signature':crypto.createHmac('sha256','whsec').update(JSON.stringify({event:'payment.failed',payload:{}})).digest('hex')}});ok(r.code===200&&r.body.ignored,'unrelated events ignored');
// payments off when keys missing
const k=process.env.RAZORPAY_KEY_SECRET;delete process.env.RAZORPAY_KEY_SECRET;r=await call('pay/order.js',{body:{planId:'combo'},token:u1.token});ok(r.code===503&&r.body.code==='payments_off','without Razorpay keys checkout reports payments_off (no fake success)');
r=await call('config.js',{method:'GET'});ok(r.body.payments===false,'config reports payments:false when keys missing');process.env.RAZORPAY_KEY_SECRET=k;
console.log(`\n${pass} passed, ${fail} failed`);await pool.end();process.exit(fail?1:0);
