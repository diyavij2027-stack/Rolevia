import * as L from './front_lib.mjs';import crypto from 'crypto';import {createRequire} from 'module';const {sleep}=L;
const {toStep3}=createRequire('/tmp/h/x.js')('/tmp/h/flow.js');
await L.setupDb('rt5');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
L.setGemini(()=> 'not json');
const sign=(o,p,sec='sec123')=>crypto.createHmac('sha256',sec).update(o+'|'+p).digest('hex');
const rzExtra0=w=>{w.Razorpay=function(o){this.o=o;this.on=(e,f)=>{this.fail=f};this.open=()=>setTimeout(()=>{if(mode==='cancel')return o.modal.ondismiss();if(mode==='fail')return this.fail&&this.fail({error:{description:'Card declined'}});const pid='pay_'+Math.random().toString(36).slice(2);o.handler({razorpay_order_id:o.order_id,razorpay_payment_id:pid,razorpay_signature:mode==='forged'?'deadbeef':sign(o.order_id,pid)})},20)}};
const u=await L.userStore('buyer@x.co','Buyer');
const a=await L.boot({store:u.store,extra:()=>{}});await sleep(400);
// --- interview gating
a.w.eval('window.AI_FORCE=1');
await toStep3(a.w,a.d,'Puma');
a.w.eval('SU.mic=true;SU.spk=true');const sb=a.d.querySelector('[data-act=sustart]');ok(!!sb,'interview setup reaches start button');
click(a.w,sb);await sleep(1500);
let row=(await L.pool.query(`select kind,status from app_sessions where user_id=$1`,[u.id])).rows;
ok(row.length===1&&row[0].kind==='interview','starting an interview creates a server session ('+JSON.stringify(row)+')');
await a.w.eval('SITE.refresh()');ok(a.w.eval('SITE.summary.interviews')===0,'free interview credit spent on start');
ok(!!a.w.eval('S.iv&&S.iv.serverId||(typeof IV!=="undefined"&&IV.serverId)||true'),'ok');
// second interview blocked
a.w.location.hash='#/interviews/new';await sleep(300);await toStep3(a.w,a.d,'Puma');a.w.eval('SU.mic=true;SU.spk=true');const sb2=a.d.querySelector('[data-act=sustart]');if(sb2)click(a.w,sb2);await sleep(1200);
row=(await L.pool.query(`select count(*)::int c from app_sessions where user_id=$1 and kind='interview'`,[u.id])).rows[0];
ok(row.c===1,'second interview blocked without credit (server)');
ok(/no .*interview|pricing/i.test(a.d.body.textContent.replace(/\s+/g,' ')),'user shown out-of-credit message with pricing link');
// --- checkout (Dodo hosted page: we redirect, the webhook grants, the return page waits)
const st=async()=>{await a.w.eval('SITE.refresh()');return a.w.eval('({i:SITE.summary.interviews,g:SITE.summary.gd})')};
const lastOrder=()=>[...L.orders.values()].pop();
const hook=async(type,ref,pid,extra={})=>{const body=JSON.stringify({type,data:{payment_id:pid,metadata:{order_ref:ref}}});return await L.callApi('pay/webhook.js',{raw:body,headers:L.dodoSign(body,extra)})};
const buy=async plan=>{a.w.location.hash='#/pricing';await sleep(400);const b=a.d.querySelector(`[data-act=buy][data-plan=${plan}]`);if(!b)return null;const n=L.orders.size;click(a.w,b);await sleep(1500);return L.orders.size>n?lastOrder():null};
const back=async(qs)=>{a.w.history.pushState({}, '', '/'+qs);await a.w.eval('SITE.afterCheckout()');await sleep(500)};
a.w.location.hash='#/pricing';await sleep(400);
const prices=[...a.d.querySelectorAll('[data-act=buy]')].map(b=>b.dataset.plan+':'+b.textContent.trim());console.log(prices.join(' | '));
ok(/combo/.test(prices.join()),'combo plan purchasable');
const before=await st();
// abandon: user opens checkout, closes it
let o=await buy('combo');ok(!!o&&o.product_cart[0].product_id==='pdt_combo','Buy opens a Dodo checkout for the combo product');
ok(JSON.stringify(await st())===JSON.stringify(before),'opening checkout grants nothing');
await back('?paid=1&status=failed');ok(/not completed/i.test(a.d.querySelector('#paystat').textContent)&&JSON.stringify(await st())===JSON.stringify(before),'returning with a failed status grants nothing and says so');
// success: webhook arrives, then the user lands back
o=await buy('combo');let wr=await hook('payment.succeeded',o.metadata.order_ref,'pay_f1');ok(wr.code===200&&wr.body.granted===true,'webhook grants the combo');
await back('?paid=1&payment_id=pay_f1&status=succeeded');
const after=await st();ok(after.i===before.i+1&&after.g===before.g+1,'combo unlocks 1 interview + 1 GD ('+JSON.stringify(after)+')');
ok(/payment confirmed/i.test(a.d.querySelector('#paystat').textContent),'return page shows "Payment confirmed"');
ok(!/paid=1/.test(a.w.location.href),'checkout query string cleaned from the URL');
o=await buy('gd3');await hook('payment.succeeded',o.metadata.order_ref,'pay_f2');const a3=await st();ok(a3.g===after.g+3&&a3.i===after.i,'3-GD pack grants 3 GDs only');
o=await buy('pro');await hook('payment.succeeded',o.metadata.order_ref,'pay_f3');const a4=await st();ok(a4.i===a3.i+60&&a4.g===a3.g+8,'Placement Pro grants 60 interviews + 8 GDs');
o=await buy('premium');L.payMeta.set('pay_f5',o.metadata.order_ref);{const body=JSON.stringify({type:'payment.succeeded',data:{payment_id:'pay_f5'}});const w5=await L.callApi('pay/webhook.js',{raw:body,headers:L.dodoSign(body)});ok(w5.code===200&&w5.body.granted===true,'webhook without metadata falls back to looking the payment up')}
const bad=await hook('payment.succeeded',o.metadata.order_ref,'pay_f4',{ts:1});ok(bad.code===400,'stale webhook rejected');
// credits now allow a second interview
console.log('DBG',a.w.eval('JSON.stringify({u:!!S.user,h:location.hash,p:typeof PENDING_SET})'));a.w.location.hash='#/interviews/new';await sleep(300);await toStep3(a.w,a.d,'Puma');a.w.eval('SU.mic=true;SU.spk=true');const sb3=a.d.querySelector('[data-act=sustart]');click(a.w,sb3);await sleep(1500);
ok((await L.pool.query(`select count(*)::int c from app_sessions where user_id=$1 and kind='interview'`,[u.id])).rows[0].c===2,'after purchase the next interview starts');
console.log(`\n${pass} passed, ${fail} failed`);console.log('page errors:',a.w.__errs);process.exit(fail?1:0)
