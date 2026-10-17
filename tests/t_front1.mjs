import * as L from './front_lib.mjs';const {sleep}=L;
await L.setupDb('rt3');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const set=(d,id,v)=>{const e=d.querySelector('#'+id);if(!e)throw new Error('missing #'+id);e.value=v};
const fill=(d,w,id,v)=>{set(d,id,v)};
// --- logged out
let {w,d,store}=await L.boot();
ok(w.eval('SITE.on')===true,'site mode on when backend configured');
w.location.hash='#/dashboard';await sleep(300);ok(w.location.hash==='#/login','dashboard redirects to login when signed out');
// --- signup
w.location.hash='#/signup';await sleep(250);
ok(!!d.querySelector('#pw'),'signup has a password field');
d.querySelector('[data-form=signup]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep(100);ok(/full name/i.test(d.querySelector('#serr').textContent),'empty signup shows validation');
set(d,'n','Asha Rao');set(d,'e','asha@x.co');set(d,'pw','short');d.querySelector('[name=t]').checked=true;
d.querySelector('[data-form=signup]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep(100);ok(/8 characters/.test(d.querySelector('#serr').textContent),'short password rejected');
set(d,'pw','password123');d.querySelector('[data-form=signup]').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await sleep(700);
ok(w.location.hash==='#/onboarding','signup creates account and goes to onboarding (got '+w.location.hash+')');
ok(w.eval('S.user&&S.user.name')==='Asha Rao','session name from account');
ok(w.eval('SITE.summary&&SITE.summary.interviews')===1&&w.eval('SITE.summary.gd')===1,'new account has 1 free interview + 1 free GD (server)');
// duplicate signup
({w:globalThis.w2,d:globalThis.d2}=await L.boot());
globalThis.w2.location.hash='#/signup';await sleep(250);const d2=globalThis.d2,w2=globalThis.w2;
set(d2,'n','Asha Again');set(d2,'e','asha@x.co');set(d2,'pw','password123');d2.querySelector('[name=t]').checked=true;d2.querySelector('[data-form=signup]').dispatchEvent(new w2.Event('submit',{bubbles:true,cancelable:true}));await sleep(500);
ok(/already has an account/.test(d2.querySelector('#serr').textContent),'duplicate email shows a clear message');
// login bad / good
w2.location.hash='#/login';await sleep(250);set(d2,'e','asha@x.co');set(d2,'pw','wrongpass1');d2.querySelector('[data-form=login]').dispatchEvent(new w2.Event('submit',{bubbles:true,cancelable:true}));await sleep(400);
ok(/wrong/.test(d2.querySelector('#lerr').textContent),'wrong password message');
set(d2,'pw','password123');d2.querySelector('[data-form=login]').dispatchEvent(new w2.Event('submit',{bubbles:true,cancelable:true}));await sleep(700);
ok(w2.location.hash==='#/onboarding','login works (first visit goes to onboarding)');
// refresh persistence: boot again with same store
const re=await L.boot({store});await sleep(300);re.w.location.hash='#/dashboard';await sleep(500);
ok(re.w.location.hash==='#/dashboard'&&/Your sessions/.test(L.page(re.d))&&/AI interview/.test(L.page(re.d)),'after reload the session persists and dashboard shows remaining sessions');
ok(/1\s*AI interview left/.test(L.page(re.d))&&/1\s*group GD left/.test(L.page(re.d)),'dashboard shows 1 interview and 1 GD left');
// logout
re.d.querySelector('[data-act=logout]').click();await sleep(400);ok(re.w.location.hash==='#/'&&!re.w.eval('S.user'),'logout clears session');
re.w.location.hash='#/dashboard';await sleep(300);ok(re.w.location.hash==='#/login','private pages blocked after logout');
// switching accounts on same browser clears local data
const st2=new Map();const a=await L.boot({store:st2});a.w.location.hash='#/signup';await sleep(200);set(a.d,'n','Bo');set(a.d,'e','bo@x.co');set(a.d,'pw','password123');a.d.querySelector('[name=t]').checked=true;a.d.querySelector('[data-form=signup]').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await sleep(600);
a.w.eval('S.reports.push({id:"r1",company:"X",role:"Y",overall:50});save()');a.d.querySelector('[data-act=logout]')?.click();await sleep(300);
a.w.location.hash='#/login';await sleep(250);set(a.d,'e','asha@x.co');set(a.d,'pw','password123');a.d.querySelector('[data-form=login]').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await sleep(700);
ok(a.w.eval('S.reports.length')===0,"a different account on the same browser does not see the previous user's local reports");
console.log(`\n${pass} passed, ${fail} failed`);console.log('page errors:',w.__errs,a.w.__errs);process.exit(fail?1:0);
