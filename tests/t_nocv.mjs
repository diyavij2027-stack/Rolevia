import * as L from './front_lib.mjs';import {createRequire} from 'module';const {sleep}=L;
await L.setupDb('rt11');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
const u=await L.userStore('n@x.co','N');const a=await L.boot({store:u.store});await sleep(300);const w=a.w,d=a.d;
L.setGemini(()=>'not json');
w.location.hash='#/interviews/new';await sleep(400);
const set=(id,v)=>{d.querySelector('#'+id).value=v};
set('ic','Puma');set('idm','Retail & Apparel');set('ir','Marketing');
click(w,d.querySelector('[data-act=sunext]'));await sleep(200);
ok(/No file chosen|Not uploaded/i.test(d.body.textContent)&&/Not uploaded/.test(d.body.textContent),'with no file the CV is shown as NOT uploaded');
click(w,d.querySelector('[data-act=sunext]'));await sleep(200);
ok(/Upload your CV, or choose/.test(d.querySelector('#ierr').textContent),'cannot proceed silently without a CV; user is offered the choice');
ok(!!d.querySelector('[data-act=sunocv]'),'"Continue without a CV" option offered');
click(w,d.querySelector('[data-act=sunocv]'));await sleep(150);
ok(/Continuing without a CV/.test(d.body.textContent)&&/Not uploaded/.test(d.body.textContent),'explains the consequence and still shows CV as not uploaded (never faked)');
click(w,d.querySelector('[data-act=sunext]'));await sleep(300);
for(let i=0;i<60;i++){await sleep(100);if(w.eval('SU.prep&&SU.prep.status')==='done')break}
ok(w.eval('SU.prep&&SU.prep.status')==='done','interview prepares without a CV');
const plan=w.eval('JSON.stringify(SU.prep.plan)');const pl=JSON.parse(plan);
ok(pl.length>=7,'full-length plan without CV ('+pl.length+' slots)');
ok(pl.every(x=>x.origin!=='cv'),'no CV-based question is invented');
ok(w.eval('SU.prep.an.none')===true,'analysis marked as none (no CV text analysed)');
ok(w.eval('S.cv')==null,'S.cv stays empty: nothing fabricated');
w.eval('SU.mic=true;SU.spk=true');click(w,d.querySelector('[data-act=sustart]'));await sleep(1500);
const sess=w.eval('JSON.stringify({u:S.sessions[0].useCv,none:S.sessions[0].cvA.none})');ok(sess==='{"u":false,"none":true}','session records that no CV was used');
console.log(`\n${pass} passed, ${fail} failed`);console.log(w.__errs);process.exit(fail?1:0)
