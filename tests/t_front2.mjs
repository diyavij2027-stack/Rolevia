import * as L from './front_lib.mjs';const {sleep}=L;
await L.setupDb('rt4');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
const u=await L.userStore('s@x.co','Solo');const a=await L.boot({store:u.store});await sleep(400);const w=a.w,d=a.d;
const txt=()=>(d.querySelector('main')||d.body).textContent.replace(/\s+/g,' ');
w.location.hash='#/gd';await sleep(400);
ok(!/Option B|group session|Book a|slot/i.test(txt()),'GD page has no group booking option');
ok(!!d.querySelector('a[href="#/gd/practice"]'),'GD page offers solo practice');
w.location.hash='#/gd/group';await sleep(400);
ok(/no longer available/i.test(txt())&&!d.querySelector('[data-act=gdbook]')&&!d.querySelector('[data-act=gdslot]'),'old booking URL shows a notice, no booking controls');
w.location.hash='#/gd/group/1792265400000';await sleep(300);ok(/no longer available/i.test(txt()),'old slot URL also handled');
w.location.hash='#/dashboard';await sleep(500);ok(!/Upcoming GD/i.test(txt())&&/GD practice/.test(txt()),'dashboard has no GD bookings card and shows GD practice credits');
w.location.hash='#/pricing';await sleep(400);ok(!/live|slot|book a/i.test(txt().replace(/Booking/g,'')),'pricing has no live-session / booking promises ('+(txt().match(/.{20}(live|slot).{20}/i)||[''])[0]+')');
ok(!/Individual GD/.test(txt())&&/\$2/.test(txt())&&!/₹/.test(txt()),'pricing: no Individual GD, dollars only');
// solo GD spends the GD credit
w.location.hash='#/gd/practice';await sleep(400);
await w.eval('SOLO.topic="Test topic";SOLO.tcat="faq";SOLO.stage="topic";drawSolo()');
await w.eval('ACT.soloprep()');await sleep(1200);
await w.eval('SITE.refresh()');ok(w.eval('SITE.summary.gd')===0,'starting a solo GD spends the free GD credit');
// speak too little -> refunded
w.eval('SOLO.text="hello";SOLO.secs=5;SOLO.stage="speak"');await w.eval('ACT.solofinish()');await sleep(1200);
await w.eval('SITE.refresh()');ok(w.eval('SITE.summary.gd')===1,'a GD with too little speech (no AI used) is refunded');
// second attempt with credit gone
await w.eval('SOLO.topic="T2";SOLO.stage="topic";drawSolo();ACT.soloprep()');await sleep(1000);
await w.eval('SITE.refresh()');ok(w.eval('SITE.summary.gd')===0,'credit spent again');
w.eval('SOLO.stage="topic";SOLO.sid=null');await w.eval('ACT.soloprep()');await sleep(1000);
ok(/no sessions left|Pricing/i.test(txt()),'with no GD credit left the user is sent to pricing');
console.log(`\n${pass} passed, ${fail} failed`);console.log(w.__errs);process.exit(fail?1:0)
