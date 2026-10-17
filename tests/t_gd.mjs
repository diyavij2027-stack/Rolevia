import * as L from './front_lib.mjs';const {sleep}=L;
await L.setupDb('rt7');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const u=await L.userStore('g@x.co','G');const a=await L.boot({store:u.store});await sleep(300);const w=a.w;
// solo scoring through real ai() -> /api/ai -> mocked Gemini
const vague="I think social media is good and bad both. It has many advantages and disadvantages and we should use it wisely because it is important for everyone in society today and everyone knows that it is very important and people should be careful about it and use it wisely in life and in society also";
L.setGemini(()=>({overall:90,criteria:["Argument quality","Critical thinking","Relevance","Contribution quality","Structure and clarity","Examples and evidence"].map(n=>({name:n,score:88,explanation:"great",evidence:n==="Relevance"?"it is important for everyone in society today":"a phrase never said by the candidate"})),strengths:["confident"],weaknesses:[],suggestions:[]}));
w.eval(`SOLO.topic="Social media: boon or bane?";SOLO.tcat="social";SOLO.text=${JSON.stringify(vague)};SOLO.secs=120;SOLO.left=60;SOLO.stage="speak"`);
await w.eval('ACT.solofinish()');await sleep(1200);
const rep=w.eval('S.gdReports[0]');console.log('REP',JSON.stringify({l:rep.limited,n:rep.note,e:rep.scoreErr}));
console.log(rep.overall,JSON.stringify(rep.criteria.map(c=>c.score)),rep.caps.length);
ok(rep.overall<=60,'vague, example-free solo GD cannot score 90 (got '+rep.overall+')');
ok(rep.criteria.find(c=>c.name==='Examples and evidence').score<=50,'no-evidence criterion capped at 50');
ok(rep.criteria.find(c=>c.name==='Relevance').evidence.length>0&&rep.criteria.find(c=>c.name==='Argument quality').evidence==='','real quote kept, invented quote dropped');
ok(rep.caps.length>=2,'caps recorded for the report');
// null criteria stay null
L.setGemini(()=>({overall:80,criteria:[{name:"Argument quality",score:null,explanation:"cannot judge"},{name:"Critical thinking",score:70,explanation:"x",evidence:""},{name:"Relevance",score:70},{name:"Contribution quality",score:70},{name:"Structure and clarity",score:70},{name:"Examples and evidence",score:70}]}));
const good="Social media has changed how three hundred million Indians get news. For example, during the 2019 election the Election Commission reported thousands of takedowns. First, the benefit: small businesses reach customers cheaply; a Kirana store in Pune sells through WhatsApp. Second, the harm: misinformation spreads faster than corrections, and studies by the Reuters Institute show low trust. On balance regulation should target amplification, not speech, because blunt bans hurt entrepreneurs. In conclusion, platforms need transparency and users need media literacy.";
w.eval(`SOLO.text=${JSON.stringify(good+" "+good.split('.').slice(0,3).join('.')+".")};SOLO.secs=150;SOLO.left=30;SOLO.stage="speak"`);
await w.eval('ACT.solofinish()');await sleep(1200);
const r2=w.eval('S.gdReports[0]');
ok(r2.criteria.find(c=>c.name==='Argument quality').score===null,'AI-unassessable criterion stays null (not invented)');
ok(r2.overall>=55&&r2.overall<=80,'solid specific answer keeps a fair score (got '+r2.overall+')');
// group criteria
ok(w.eval('GD_CRIT.join("|")')==='Argument quality|Critical thinking|Listening|Teamwork|Leadership|Relevance|Contribution quality','group criteria match the brief');
// dominance + group caps via gdCap/gdMetrics
const m=w.eval(`JSON.stringify(gdMetrics(${JSON.stringify(vague)},0.55))`);const mm=JSON.parse(m);
ok(w.eval(`gdCap("Argument quality",85,${m},"live").score`)<=65,'unsupported argument capped in group scoring');
ok(w.eval(`gdCap("Teamwork",80,{words:30,rep:0,hasNum:false,concrete:false},"live").score`)<=45,'thin evidence caps every criterion');
ok(w.eval(`gdCap("Leadership",null,${m},"live").score`)===null,'null stays null');
console.log(`\n${pass} passed, ${fail} failed`);console.log(w.__errs);process.exit(fail?1:0)
