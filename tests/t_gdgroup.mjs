import * as L from './front_lib.mjs';const {sleep}=L;
await L.setupDb('rt9');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const us=[],apps=[];for(let i=0;i<4;i++){const u=await L.userStore(`p${i}@x.co`,'P'+i);us.push(u);apps.push(await L.boot({store:u.store}))}
await sleep(300);
const slot=Math.floor((Date.now()-2*3600e3)/1800e3)*1800e3;
for(let i=0;i<4;i++)await L.pool.query(`insert into gd_bookings(user_id,slot,name,pref) values ($1,to_timestamp($2/1000.0),$3,'random')`,[us[i].id,slot,'P'+i]);
const talk=["Social media helps small businesses reach customers. For example a Kirana store in Pune sells through WhatsApp and grew 30 percent last year, according to a local trade survey. However misinformation spreads faster than corrections, so regulation should target amplification rather than speech, because blunt bans hurt entrepreneurs and harm free expression. Building on the earlier point about trust, platforms need transparency reports and users need media literacy in schools.",
 "Social media is good and bad. It has many advantages and disadvantages. Everyone knows it is important. We should use it wisely. It is good and bad and it is important for society and we should use it wisely in life and also everyone should use it wisely because it is important.",
 "I agree with the first speaker and want to challenge one point: transparency reports alone do not stop harm, because the evidence from Germany's NetzDG shows over-removal of lawful posts. A better approach is independent audits plus an appeals process, and this keeps speech protected while cutting amplification of falsehoods. To summarise the group, we agree on literacy and transparency but differ on enforcement.",
 "Yes."];
for(let i=0;i<4;i++){apps[i].w.location.hash='#/gd/group/'+slot;}
await sleep(3500);
for(let i=0;i<4;i++){await apps[i].w.eval(`VIEW.db.doc("gdreports/tr_${slot}_"+myId()).set({kind:"tr",slot:${slot},uid:myId(),name:"P${i}",src:"live",words:${talk[i].split(/\s+/).length},text:${JSON.stringify(talk[i])},at:Date.now()})`)}
L.setGemini(p=>({participants:[{label:"P1",scores:{"Argument quality":92,"Critical thinking":90,"Listening":88,"Teamwork":85,"Leadership":80,"Relevance":95,"Contribution quality":90},strengths:["clear"],improvements:[],evidence:"Kirana store in Pune sells through WhatsApp",feedback:"great"},
 {label:"P2",scores:{"Argument quality":85,"Critical thinking":80,"Listening":80,"Teamwork":80,"Leadership":75,"Relevance":85,"Contribution quality":85},evidence:"invented words nobody said",feedback:"ok"},
 {label:"P3",scores:{"Argument quality":80,"Critical thinking":85,"Listening":null,"Teamwork":null,"Leadership":null,"Relevance":85,"Contribution quality":80},evidence:"independent audits plus an appeals process"}]}));
await sleep(3500);
apps[0].w.eval('GS.maxPresent=4');
await apps[0].w.eval('gdEvaluate()');await sleep(1500);
const ev=(await L.pool.query(`select data from kv where id like 'ev_%'`)).rows[0]?.data;
ok(!!ev,'group evaluation written for the session');
if(ev){const byName=Object.fromEntries(ev.participants.map(p=>[p.name,p]));console.log(ev.participants.map(p=>p.name+':'+p.total+(p.caps?' caps='+p.caps.length:'')).join(' | '),'short=',ev.shortlist.length);
 ok(byName.P0&&byName.P0.total>=55&&byName.P0.total<=90,'strong, evidenced contributor scores well but capped at 90 (got '+(byName.P0&&byName.P0.total)+')');
 ok(byName.P1&&byName.P1.total<=byName.P0.total-10,'repetitive, example-free contributor ranked well below (got '+(byName.P1&&byName.P1.total)+')');
 ok(byName.P1.criteria.find(c=>c.name==='Argument quality').score<=55,'repetition/unsupported cap applied to P1 argument quality');
 ok(byName.P1.evidence==='','invented evidence quote removed');
 const p2=byName.P2;ok(p2.criteria.filter(c=>c.score===null).length===3,'unassessable Listening/Teamwork/Leadership stay null for P2 (not invented)');
 ok(p2.total!=null,'P2 still rankable on assessed criteria');
 const p3=byName.P3;ok(p3&&p3.rankable===false&&p3.total==null,'one-word contribution is not scored or ranked');
 ok(ev.shortlist.length>=1,'shortlist made from ranked participants');}
console.log(`\n${pass} passed, ${fail} failed`);console.log(apps.map(a=>a.w.__errs));process.exit(fail?1:0)
