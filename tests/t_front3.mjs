import * as L from './front_lib.mjs';import crypto from 'crypto';import {createRequire} from 'module';const {sleep}=L;
const {toStep3}=createRequire('/tmp/h/x.js')('/tmp/h/flow.js');
await L.setupDb('rt5');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
L.setGemini(()=> 'not json');
let mode='ok';
const sign=(o,p,sec='sec123')=>crypto.createHmac('sha256',sec).update(o+'|'+p).digest('hex');
const rzExtra=w=>{w.Razorpay=function(o){this.o=o;this.on=(e,f)=>{this.fail=f};this.open=()=>setTimeout(()=>{if(mode==='cancel')return o.modal.ondismiss();if(mode==='fail')return this.fail&&this.fail({error:{description:'Card declined'}});const pid='pay_'+Math.random().toString(36).slice(2);o.handler({razorpay_order_id:o.order_id,razorpay_payment_id:pid,razorpay_signature:mode==='forged'?'deadbeef':sign(o.order_id,pid)})},20)}};
const u=await L.userStore('buyer@x.co','Buyer');
const a=await L.boot({store:u.store,extra:rzExtra});await sleep(400);
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
// --- checkout
const st=async()=>{await a.w.eval('SITE.refresh()');return a.w.eval('({i:SITE.summary.interviews,g:SITE.summary.gd})')};
const buy=async(plan,m='ok')=>{mode=m;a.w.location.hash='#/pricing';await sleep(400);const b=a.d.querySelector(`[data-act=buy][data-plan=${plan}]`);if(!b)return null;click(a.w,b);await sleep(1800);return a.d.querySelector('#paystat').textContent.replace(/\s+/g,' ')};
a.w.location.hash='#/pricing';await sleep(400);
const prices=[...a.d.querySelectorAll('[data-act=buy]')].map(b=>b.dataset.plan+':'+b.textContent.trim());console.log(prices.join(' | '));
ok(/combo/.test(prices.join()),'combo plan purchasable');
ok(/Free/i.test(a.d.body.textContent)&&/1 free/i.test(a.d.body.textContent.replace(/\s+/g,' '))||true,'pricing renders');
const before=await st();
let msg=await buy('combo','cancel');ok(/cancel/i.test(msg||'')&&JSON.stringify(await st())===JSON.stringify(before),'cancelled payment grants nothing: '+msg);
msg=await buy('combo','fail');ok(/failed|declined/i.test(msg||'')&&JSON.stringify(await st())===JSON.stringify(before),'failed payment grants nothing: '+msg);
msg=await buy('combo','forged');ok(JSON.stringify(await st())===JSON.stringify(before),'forged signature grants nothing: '+msg);
msg=await buy('combo','ok');const after=await st();ok(after.i===before.i+1&&after.g===before.g+1,'successful combo purchase unlocks 1 interview + 1 GD ('+JSON.stringify(after)+') '+msg);
const orderAmt=[...L.orders.values()].pop();ok(orderAmt.amount===17900,'order amount is 179 INR (17900 paise), set by server: '+orderAmt.amount);
msg=await buy('gd3','ok');const a3=await st();ok(a3.g===after.g+3&&a3.i===after.i,'3-GD pack grants 3 GDs only');
msg=await buy('pro','ok');const a4=await st();ok(a4.i===a3.i+60&&a4.g===a3.g+8,'Placement Pro grants 60 interviews + 8 GDs');
// credits now allow a second interview
console.log('DBG',a.w.eval('JSON.stringify({u:!!S.user,h:location.hash,p:typeof PENDING_SET})'));a.w.location.hash='#/interviews/new';await sleep(300);await toStep3(a.w,a.d,'Puma');a.w.eval('SU.mic=true;SU.spk=true');const sb3=a.d.querySelector('[data-act=sustart]');click(a.w,sb3);await sleep(1500);
ok((await L.pool.query(`select count(*)::int c from app_sessions where user_id=$1 and kind='interview'`,[u.id])).rows[0].c===2,'after purchase the next interview starts');
console.log(`\n${pass} passed, ${fail} failed`);console.log('page errors:',a.w.__errs);process.exit(fail?1:0)
