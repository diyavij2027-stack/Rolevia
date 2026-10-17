import * as L from './front_lib.mjs';const {sleep}=L;
await L.setupDb('rt6');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const u=await L.userStore('s@x.co','S');const a=await L.boot({store:u.store});await sleep(300);const w=a.w;
const turns=[
 {kind:"main",type:"cv",q:"Tell me about the Instagram campaign at Acme Foods.",a:"It was good and we did well and everyone liked it."},
 {kind:"main",type:"behavioural",q:"Tell me about a conflict with a teammate and how you resolved it.",a:"At Acme Foods, when I disagreed with our designer on the launch date, I pulled the engagement numbers from the last two campaigns, showed that posts on weekdays got 30 percent more reach, and we moved the launch by two days. Reach rose 40 percent."},
 {kind:"followup",type:"cv",q:"What number moved because of that?",a:"It was good and we did well and everyone liked it."},
 {kind:"main",type:"technical",q:"How would you size the snack market?",a:"(skipped)"}];
w.__t=turns;
const fakeAi={overall:92,dims:{communication:95,clarity:95,reasoning:90,roleKnowledge:90,relevance:90,answerQuality:90,cvCredibility:null},perQuestion:[
 {score:85,quote:"It was good and we did well",worked:"x"},{score:90,quote:"showed that posts on weekdays got 30 percent more reach",worked:"y"},{score:80,quote:"completely fabricated quote that is not there",worked:"z"},{score:70,worked:"w"}]};
const st=w.eval(`strictInterview(${JSON.stringify(fakeAi)},__t)`);
console.log(JSON.stringify(st.pq.map(x=>x.score)),st.overall,JSON.stringify(st.dims));
ok(st.pq[0].score<=25||st.pq[0].score<=45,'vague short answer capped (got '+st.pq[0].score+')');
ok(st.pq[1].score===90,'strong specific answer keeps its score');
ok(st.pq[2].score<=25||st.pq[2].score<=45,'repeat/vague follow-up capped');
ok(st.pq[3].score===0,'skipped question scores 0');
ok(st.pq[1].quote!==''&&st.pq[2].quote==='','real quote kept, fabricated quote dropped');
ok(st.overall<=65,'overall cannot stay near the inflated AI 92 (got '+st.overall+')');
ok(st.dims.cvCredibility===null,'unassessable dimension stays null, not invented');
ok(Object.values(st.dims).filter(v=>v!==null).every(v=>v<=st.overall+15),'dimension scores bounded by evidence-based overall');
ok(st.notes.length>=3,'caps are recorded for transparency');
// long waffle without evidence must not score high
const waffle=[{kind:"main",type:"behavioural",q:"Tell me about a time you led a team.",a:"I am a very passionate leader who always works hard and believes in teamwork and communication and I have always been a natural leader in every situation I faced because leadership is about people and about being a good listener and I think that matters a lot in any organisation and that is what I bring."}];
w.__t2=waffle;const st2=w.eval(`strictInterview({overall:88,dims:{},perQuestion:[{score:88}]},__t2)`);
ok(st2.pq[0].score<=65,'long answer with no example/figure is capped (got '+st2.pq[0].score+')');
// Situational plan
const plan=w.eval(`JSON.stringify(planSit({company:"Puma",role:"Marketing",domain:"Retail"},{probeAreas:[{area:"Instagram campaign",why:"claim",angle:"x"}]},null,7))`);const pl=JSON.parse(plan);
ok(pl.length===7&&pl.every(x=>x.origin==='practice'||x.origin==='cv'),'situational plan has 7 slots, all labelled practice/cv (none "reported")');
ok(pl.some(x=>/Puma/.test(x.ask)),'cases are set in the selected company');
ok(['conflict','Leadership','Ethical','Business case'].every(k=>pl.some(x=>new RegExp(k,'i').test(x.focus+x.basis))),'covers conflict, leadership, ethics and business cases');
ok(!/reported/i.test(pl.map(x=>x.basis).filter((b,i)=>pl[i].origin==='practice').join(' '))||pl.filter(x=>x.origin==='practice').every(x=>/Not a reported/.test(x.basis)),'practice slots explicitly say they are not reported questions');
// UI: situational entry
a.w.location.hash='#/interviews';await sleep(400);
const btn=a.d.querySelector('[data-act=sitnew]');ok(!!btn,'interviews page has a separate situational option');
console.log('BTN',btn.outerHTML.slice(0,120),typeof w.eval('ACT.sitnew'));btn.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));await sleep(700);
console.log('DBG',a.w.location.hash,a.w.eval('JSON.stringify(SU.v)'));ok(a.w.eval('SU.v.round')==='Situational & Case-Based','situational option preselects the round');
ok(/not.*questions reported from real interviews/i.test(a.d.body.textContent.replace(/\s+/g,' ')),'setup shows the not-verified notice');
ok([...a.d.querySelectorAll('a')].some(x=>/bain\.com/.test(x.href)),'method reference links are shown');
console.log(`\n${pass} passed, ${fail} failed`);console.log(w.__errs);process.exit(fail?1:0)
