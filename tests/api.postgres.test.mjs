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
Object.assign(process.env,{SUPABASE_URL:'https://sb.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'svc',GEMINI_API_KEY:'AIza'+'x'.repeat(35),DODO_PAYMENTS_API_KEY:'dodo_key',DODO_PAYMENTS_WEBHOOK_KEY:'whsec_'+Buffer.from('webhook-secret-bytes').toString('base64'),DODO_MODE:'test',SITE_URL:'https://site.test',DODO_PRODUCT_COMBO:'pdt_combo',DODO_PRODUCT_GD3:'pdt_gd3',DODO_PRODUCT_PRO:'pdt_pro',DODO_PRODUCT_PREMIUM:'pdt_premium'});
const tokens=new Map();let dodoReqs=[],geminiCalls=[],rzpOrders=0,gemReply=null;
const mkUser=async(email)=>{const id=(await pool.query('insert into auth.users(email) values ($1) returning id',[email])).rows[0].id;const t='tok_'+id;tokens.set(t,{id,email});return{id,token:t}};
const jres=(status,body)=>({ok:status<400,status,headers:{get:()=>null},json:async()=>body,text:async()=>JSON.stringify(body)});
global.fetch=async(url,o={})=>{url=String(url);
 if(url.startsWith('https://sb.test/auth/v1/user')){const t=/Bearer (.+)/.exec(o.headers.Authorization)?.[1];const u=tokens.get(t);return u?jres(200,u):jres(401,{message:'bad jwt'})}
 if(url.startsWith('https://sb.test/rest/v1/rpc/')){const fn=url.split('/rpc/')[1];const args=JSON.parse(o.body||'{}');const keys=Object.keys(args);const c=await pool.connect();try{await c.query('set role service_role');const q=`select ${fn}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')}) as r`;const r=await c.query(q,keys.map(k=>args[k]));return jres(200,r.rows[0].r)}catch(e){return jres(400,{message:e.message})}finally{await c.query('reset role').catch(()=>{});c.release()}}
 if(url.startsWith('https://sb.test/rest/v1/plans')){const id=/id=eq\.([^&]+)/.exec(url)[1];const r=await pool.query('select id,name,amount_paise,buyable from plans where id=$1',[decodeURIComponent(id)]);return jres(200,r.rows)}
 if(url.startsWith('https://test.dodopayments.com/checkouts')){rzpOrders++;const b=JSON.parse(o.body);dodoReqs.push({b,auth:o.headers.Authorization});return jres(200,{session_id:'cks_'+rzpOrders,checkout_url:'https://checkout.dodo.test/cks_'+rzpOrders})}
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
r=await call('pay/order.js',{body:{planId:'combo',amount:1,productId:'pdt_evil'},token:u1.token});
const dq=dodoReqs[dodoReqs.length-1];
ok(r.code===200&&/^https:\/\/checkout\.dodo\.test\//.test(r.body.checkoutUrl)&&dq.b.product_cart[0].product_id==='pdt_combo'&&dq.auth==='Bearer dodo_key','checkout uses the server-side product for the plan; client price/product ignored');
ok(dq.b.metadata.plan_id==='combo'&&dq.b.metadata.user_id===u1.id&&/^dd_/.test(dq.b.metadata.order_ref)&&dq.b.customer.email,'order carries our reference, user and email in metadata');
ok(dq.b.return_url==='https://site.test/?paid=1','return URL points back to the site');
const ord=dq.b.metadata.order_ref;
ok((await pool.query("select status from payments where order_id=$1",[ord])).rows[0].status==='created','payment recorded as created (unpaid) until the webhook confirms');
const before=(await rpcUser(u1,'select my_summary() s')).s;
const evBody=(o,p,type='payment.succeeded')=>JSON.stringify({type,data:{payment_id:p,metadata:{order_ref:o}}});
const sign=(body,o={})=>{const id=o.id||'msg_1',ts=o.ts||Math.floor(Date.now()/1000);const key=o.key||Buffer.from('webhook-secret-bytes');return{'webhook-id':id,'webhook-timestamp':String(ts),'webhook-signature':'v1,'+crypto.createHmac('sha256',key).update(id+'.'+ts+'.'+body).digest('base64')}};
let b1=evBody(ord,'pay_A1');
r=await call('pay/webhook.js',{raw:b1,headers:{'webhook-id':'m','webhook-timestamp':String(Math.floor(Date.now()/1000)),'webhook-signature':'v1,AAAA'}});ok(r.code===400,'forged webhook signature rejected');
r=await call('pay/webhook.js',{raw:b1,headers:sign(b1,{key:Buffer.from('wrong')})});ok(r.code===400,'webhook signed with the wrong secret rejected');
r=await call('pay/webhook.js',{raw:b1,headers:sign(b1,{ts:Math.floor(Date.now()/1000)-3600})});ok(r.code===400,'old (replayed) webhook rejected');
let mid=(await rpcUser(u1,'select my_summary() s')).s;ok(mid.gd===before.gd&&mid.interviews===before.interviews,'nothing unlocked by forged/old webhooks');
r=await call('pay/webhook.js',{raw:evBody(ord,'pay_A1','payment.failed'),headers:sign(evBody(ord,'pay_A1','payment.failed'))});ok(r.code===200&&r.body.ignored==='payment.failed','failed payment event ignored, nothing unlocked');
r=await call('pay/webhook.js',{raw:b1,headers:sign(b1)});ok(r.code===200&&r.body.granted===true,'valid signed payment.succeeded unlocks the plan');
let after=(await rpcUser(u1,'select my_summary() s')).s;ok(after.gd===before.gd+1&&after.interviews===before.interviews+1,`combo unlocked exactly +1 GD, +1 interview (gd ${before.gd}->${after.gd}, int ${before.interviews}->${after.interviews})`);
r=await call('pay/webhook.js',{raw:b1,headers:sign(b1,{id:'msg_2'})});ok(r.code===200&&r.body.granted===false,'webhook retry is idempotent');
// pack, with concurrent duplicate deliveries
r=await call('pay/order.js',{body:{planId:'gd3'},token:u2.token});const ord2=dodoReqs[dodoReqs.length-1].b.metadata.order_ref;
const pre=(await rpcUser(u2,'select my_summary() s')).s;
let b2=evBody(ord2,'pay_B1');
await Promise.all([call('pay/webhook.js',{raw:b2,headers:sign(b2,{id:'a'})}),call('pay/webhook.js',{raw:b2,headers:sign(b2,{id:'b'})}),call('pay/webhook.js',{raw:b2,headers:sign(b2,{id:'c'})})]);
const post=(await rpcUser(u2,'select my_summary() s')).s;ok(post.gd===pre.gd+3,`3 racing webhook deliveries -> pack credited exactly once (+3 GD: ${pre.gd}->${post.gd})`);
r=await call('pay/webhook.js',{raw:evBody('dd_unknown','pay_Z'),headers:sign(evBody('dd_unknown','pay_Z'))});ok(r.code===200&&r.body.granted===false,'unknown order reference grants nothing');
// plan without a Dodo product configured
const pc=process.env.DODO_PRODUCT_PRO;delete process.env.DODO_PRODUCT_PRO;r=await call('pay/order.js',{body:{planId:'pro'},token:u1.token});ok(r.code===503&&r.body.code==='payments_off','plan with no Dodo product reports payments_off, no pending order created');process.env.DODO_PRODUCT_PRO=pc;
// payments off when keys missing
const k=process.env.DODO_PAYMENTS_API_KEY;delete process.env.DODO_PAYMENTS_API_KEY;r=await call('pay/order.js',{body:{planId:'combo'},token:u1.token});ok(r.code===503&&r.body.code==='payments_off','without Dodo keys checkout reports payments_off (no fake success)');
r=await call('config.js',{method:'GET'});ok(r.body.payments===false,'config reports payments:false when keys missing');process.env.DODO_PAYMENTS_API_KEY=k;
console.log(`\n${pass} passed, ${fail} failed`);await pool.end();process.exit(fail?1:0);
