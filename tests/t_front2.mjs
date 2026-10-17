import * as L from './front_lib.mjs';const {sleep}=L;
await L.setupDb('rt4');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
const us=[];const apps=[];
for(let i=0;i<8;i++){const u=await L.userStore(`u${i}@x.co`,'User'+i);us.push(u);const a=await L.boot({store:u.store});apps.push(a);}
await sleep(400);
// pick a slot ~3h ahead aligned
const slot=await apps[0].w.eval(`(()=>{const t=Date.now()+3*3600e3;return Math.ceil(t/1800e3)*1800e3})()`);
async function book(a,slotT){a.w.location.hash='#/gd/group';await sleep(slotT===slot?3800:300);a.w.eval(`GSEL.slot=${slotT};drawGdBook()`);await sleep(150);const b=a.d.querySelector('[data-act=gdbook]');if(!b)return /session is full/i.test(a.d.body.textContent)?'FULL_UI':'nobtn';click(a.w,b);await sleep(900);return a.w.eval('GSEL.msg||""')}
const res=[];
for(let i=0;i<7;i++){res.push(await book(apps[i],slot))}
const seatRows=(await L.pool.query('select count(*)::int c from gd_bookings where slot_start=to_timestamp($1/1000.0)',[slot]).catch(async e=>await L.pool.query('select count(*)::int c from gd_bookings'))).rows[0].c;
ok(seatRows===6,'exactly 6 seats booked for the slot after 7 users tried (got '+seatRows+')');
console.log('messages:',res);
ok(/filled up|full/i.test(res[6])||res[6]==='FULL_UI','7th user is told the session is full');
const cr=await L.pool.query(`select u.email, (select coalesce(sum(n),0) from credit_uses cu where cu.user_id=u.id and cu.kind='gd') used from auth.users u order by 1`).catch(()=>null);
// duplicate booking by same user
const dup=await book(apps[0],slot);console.log('DUP',dup,apps[0].d.body.textContent.replace(/\s+/g,' ').match(/.{60}(booked|full).{60}/i)?.[0]);ok(!/filled up/.test(dup)&&/You are booked/i.test(apps[0].d.body.textContent),'booked user sees "booked" state, no second booking button');
const c2=(await L.pool.query('select count(*)::int c from gd_bookings')).rows[0].c;ok(c2===6,'duplicate did not add a seat');
// user 0 now has 0 gd credits; try booking a second slot (no credit)
const slot2=slot+3600e3*3;const nc=await book(apps[0],slot2);ok(/credit|session/i.test(nc),'no GD credit -> clear message: '+nc);
// conflict (±30min)
// cancel refunds
apps[0].w.location.hash='#/gd/group';await sleep(3800);apps[0].w.eval(`GSEL.slot=${slot};drawGdBook()`);await sleep(200);
console.log('DBGERR',await apps[0].w.eval('(async()=>{try{const r=await VIEW.db.collection("gdbookings").get();return "ok "+r.docs.length}catch(e){return "ERR "+(e.message||JSON.stringify(e))}})()'));console.log('DBG',apps[0].w.eval('JSON.stringify({gdb:GDB.length,mine:!!mySeat(GSEL.slot),slot:GSEL.slot,uid:myId()})'),apps[0].d.querySelector('main').textContent.replace(/\s+/g,' ').slice(0,400));const cb=apps[0].d.querySelector('[data-act=gdcancel]');ok(!!cb,'cancel button shown for booked user');
click(apps[0].w,cb);await sleep(900);
ok((await L.pool.query('select count(*)::int c from gd_bookings')).rows[0].c===5,'cancel frees the seat');
await apps[0].w.eval('SITE.refresh()');await sleep(300);
ok(apps[0].w.eval('SITE.summary.gd')===1,'GD credit refunded on early cancel');
// 7th user can now take it
apps[6].w.location.hash='#/dashboard';await sleep(300);const r7=await book(apps[6],slot);ok((await L.pool.query('select count(*)::int c from gd_bookings')).rows[0].c===6,'freed seat is bookable by the waiting user '+r7);
// dashboard upcoming
apps[1].w.location.hash='#/dashboard';await sleep(500);ok(/upcoming/i.test(L.page(apps[1].d))&&true,'dashboard renders for booked user');
console.log(`\n${pass} passed, ${fail} failed`);console.log('page errors:',apps.map(a=>a.w.__errs).flat());process.exit(fail?1:0)
