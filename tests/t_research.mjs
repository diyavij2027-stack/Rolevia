import * as L from './front_lib.mjs';import {createRequire} from 'module';const {sleep}=L;
const {toStep3}=createRequire('/tmp/h/x.js')('/tmp/h/flow.js');
await L.setupDb('rt10');
let pass=0,fail=0;const ok=(c,m,x='')=>{c?pass++:fail++;console.log((c?'PASS ':'FAIL ')+m+(c?'':'  '+x))};
const click=(w,el)=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));
const u=await L.userStore('r@x.co','R');const a=await L.boot({store:u.store});await sleep(300);const w=a.w,d=a.d;
const research={found:true,officialName:"Zeta Dairy Pvt Ltd",summary:"Zeta Dairy sells packaged milk and curd in North India.",businessModel:"Sells packaged dairy through distributors and its own app.",products:["Packaged milk","Curd"],culture:["Customer obsession (company website)"],recentDevelopments:[{date:"2026-03",item:"Opened a new plant in Haryana"}],roleRequirements:["Distributor management","Demand forecasting"],hiringProcess:null,interviewSignals:[],likelyCaseAreas:["Cold-chain cost reduction"],limits:"No interview reports found."};
let mode='found';
L.setGemini((p,b)=>{if(b.tools&&b.tools[0]&&b.tools[0].google_search){if(mode==='none')return{text:{found:false},__grounding:{groundingChunks:[]}};return{text:research,__grounding:{groundingChunks:[{web:{uri:"https://redir.test/a",title:"zetadairy.example"}},{web:{uri:"https://redir.test/b",title:"Business Standard"}}],webSearchQueries:["zeta dairy"]}}}
 if(/group-discussion topic/.test(p))return{topic:"Should Zeta Dairy prioritise cold-chain automation over new plants?"};
 return'not json'});
// unknown company -> lookup
w.eval(CV());function CV(){return'1'}
w.location.hash='#/interviews/new';await sleep(400);
w.eval('SU.v.company="Zeta Dairy";SU.v.domain="FMCG";drawSetup()');await sleep(100);
ok(!!d.querySelector('[data-act=colookup]'),'company research button shown for a company outside the list');
click(w,d.querySelector('[data-act=colookup]'));await sleep(2500);
const txt=d.body.textContent.replace(/\s+/g,' ');
ok(/Zeta Dairy Pvt Ltd/.test(txt)&&/Opened a new plant in Haryana/.test(txt)&&/Distributor management/.test(txt),'researched business, news and role needs are shown');
const links=[...d.querySelectorAll('#su a')].map(x=>x.href);console.log(links);
ok(links.some(x=>/example\.com/.test(x)),'source links shown (real page URL resolved from the grounding redirect)');
ok(/retrieved \d{4}-\d{2}-\d{2}/.test(txt),'retrieval date shown');
ok(/Check the links/.test(txt),'AI-summary caveat shown');
ok(L.geminiLog.some(g=>g.tools&&g.tools[0].google_search),'grounded search tool was used (not plain model memory)');
// plan uses it
await toStep3(w,d,'Zeta Dairy',{domain:'FMCG',role:'Sales'});
const br=w.eval('JSON.stringify(SU.prep&&SU.prep.brief||null)');
ok(/Opened a new plant/.test(br)&&/"grounded":true/.test(br),'interview brief is built from the grounded research');
// not found
mode='none';
w.eval('SU.step=1;SU.v.company="Qwxzv Holdings";drawSetup()');click(w,d.querySelector('[data-act=colookup]'));await sleep(2500);
ok(/could not verify a company/i.test(d.body.textContent)&&/industry-based practice questions/i.test(d.body.textContent),'unknown company is labelled industry-based, no facts invented');
// solo GD from company
mode='found';
w.location.hash='#/gd/practice';await sleep(400);w.eval('SOLO.cat="company";drawSolo()');await sleep(100);
d.querySelector('#soloco').value='Zeta Dairy';click(w,d.querySelector('[data-act=solotopic]'));await sleep(2500);
ok(/Zeta Dairy should|Should Zeta Dairy/.test(w.eval('SOLO.topic'))&&w.eval('SOLO.tcat')==='company','company-based GD topic generated from the research');
ok(/retrieved/.test(d.body.textContent)&&[...d.querySelectorAll('a')].some(x=>/example\.com/.test(x.href)),'GD topic shows its sources');
console.log(`\n${pass} passed, ${fail} failed`);console.log(w.__errs);process.exit(fail?1:0)
