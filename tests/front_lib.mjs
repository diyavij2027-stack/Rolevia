import pg from 'pg';import fs from 'fs';import crypto from 'crypto';import {createRequire} from 'module';
const reqH=createRequire('/tmp/h/x.js');const {JSDOM}=reqH('jsdom');let pdfjs={getDocument(){throw new Error('pdf n/a')}},mammoth={extractRawText(){throw new Error('docx n/a')}};try{pdfjs=reqH('pdfjs-dist/legacy/build/pdf.js');mammoth=reqH('mammoth')}catch(e){}
const reqS=createRequire(import.meta.url);const API='/home/claude/rolevia-repo/api/';
const R='/home/claude/rolevia-repo/';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cfg={host:'/tmp/pgdata',port:54329,user:'pgtest',database:'postgres'};
export const ENV={SUPABASE_URL:'https://sb.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'svc',GEMINI_API_KEY:'AIza'+'x'.repeat(35),DODO_PAYMENTS_API_KEY:'dodo_key',DODO_PAYMENTS_WEBHOOK_KEY:'whsec_'+Buffer.from('webhook-secret-bytes').toString('base64'),DODO_MODE:'test',SITE_URL:'https://site.test',DODO_PRODUCT_COMBO:'pdt_combo',DODO_PRODUCT_GD3:'pdt_gd3',DODO_PRODUCT_PRO:'pdt_pro',DODO_PRODUCT_PREMIUM:'pdt_premium'};
export let pool;
export async function setupDb(name='rt3'){const a=new pg.Client(cfg);await a.connect();await a.query(`drop database if exists ${name}`);await a.query(`create database ${name}`);await a.end();
 pool=new pg.Pool({...cfg,database:name,max:10});
 await pool.query(`do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if; end $$;
 create schema if not exists auth; create table if not exists auth.users(id uuid primary key default gen_random_uuid(), email text unique, password text, name text);
 create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant usage on schema public to authenticated, service_role;`);
 await pool.query(fs.readFileSync(R+'supabase/schema.sql','utf8'));await pool.query(fs.readFileSync(R+'supabase/plans_seed.sql','utf8'));
 Object.assign(process.env,ENV);return pool}
const tokens=new Map();
export const jres=(status,body)=>({ok:status<400,status,headers:{get:()=>null},json:async()=>body,text:async()=>JSON.stringify(body)});
export const geminiLog=[];export let geminiReply=(p)=>({ok:1});
export function setGemini(f){geminiReply=f}
async function asUser(uid,sql,params){const c=await pool.connect();try{await c.query(`select set_config('request.jwt.claim.sub',$1,false)`,[uid||'']);await c.query('set role authenticated');return await c.query(sql,params)}finally{await c.query('reset role').catch(()=>{});c.release()}}
let orderN=0;export const orders=new Map();
global.fetch=async(url,o={})=>{url=String(url);
 if(url.startsWith('https://sb.test/auth/v1/user')){const t=/Bearer (.+)/.exec(o.headers.Authorization)?.[1];const u=tokens.get(t);return u?jres(200,u):jres(401,{message:'bad jwt'})}
 if(url.startsWith('https://sb.test/rest/v1/rpc/')){const fn=url.split('/rpc/')[1];const args=JSON.parse(o.body||'{}');const keys=Object.keys(args);const c=await pool.connect();try{await c.query('set role service_role');const r=await c.query(`select * from ${fn}(${keys.map((k,i)=>`${k} => $${i+1}`).join(',')})`,keys.map(k=>args[k]));const scalar=r.fields.length===1&&r.fields[0].name===fn;return jres(200,scalar?(r.rows[0]?r.rows[0][fn]:null):r.rows)}catch(e){return jres(400,{message:e.message})}finally{await c.query('reset role').catch(()=>{});c.release()}}
 if(url.startsWith('https://sb.test/rest/v1/plans')){const id=/id=eq\.([^&]+)/.exec(url)[1];const r=await pool.query('select id,name,amount_paise,buyable from plans where id=$1',[decodeURIComponent(id)]);return jres(200,r.rows)}
 if(url.startsWith('https://test.dodopayments.com/checkouts')){const b=JSON.parse(o.body);const id='cks_T'+(++orderN);b.auth=o.headers.Authorization;orders.set(id,b);return jres(200,{session_id:id,checkout_url:'https://checkout.dodo.test/'+id})}
 if(url.includes('generativelanguage.googleapis.com')){const b=JSON.parse(o.body);const prompt=b.contents[0].parts[0].text;geminiLog.push({prompt,tools:b.tools});const rep=geminiReply(prompt,b);
  const cand={content:{parts:[{text:typeof rep==='string'?rep:JSON.stringify(rep.text!==undefined?rep.text:rep)}]},finishReason:'STOP'};if(rep&&rep.__grounding)cand.groundingMetadata=rep.__grounding;
  return jres(200,{candidates:[cand]})}
 if(url.startsWith('https://redir.test/'))return{ok:false,status:302,headers:{get:h=>h==='location'?'https://www.example.com/page':null}};
 throw new Error('unmocked '+url)};
const handlers={};const load=m=>handlers[m]||(handlers[m]=reqS(API+m));
import cryptoW from 'crypto';
export function dodoSign(body,{id='msg_1',ts=Math.floor(Date.now()/1000)}={}){const key=Buffer.from('webhook-secret-bytes');const sig=cryptoW.createHmac('sha256',key).update(id+'.'+ts+'.'+body).digest('base64');return{'webhook-id':id,'webhook-timestamp':String(ts),'webhook-signature':'v1,'+sig}}
export async function callApi(mod,{method='POST',body,headers,raw}){const h=load(mod);const res={code:200,body:null,setHeader(){},status(c){res.code=c;return res},json(b){res.body=b;return res}};
 const {Readable}=await import('stream');let req;if(raw!==undefined){req=Readable.from([Buffer.from(raw)]);req.headers=headers||{};req.method=method;req.socket={}}else req={method,headers:headers||{},body,socket:{}};
 await h(req,res);return res}
export async function makeUser(email,password='password123',name='Test User'){const id=(await pool.query('insert into auth.users(email,password,name) values ($1,$2,$3) returning id',[email,password,name])).rows[0].id;return id}
// ---- fake supabase-js bound to the real database ----
const presence=new Map();
export function fakeSupabase(store){
 return{createClient(url,key,opts){
  let session=null,listeners=[];
  const k='sb-test-auth-token';
  const load=()=>{try{const v=store.getItem(k);session=v?JSON.parse(v):null}catch(e){}};
  const persist=()=>{if(session)store.setItem(k,JSON.stringify(session));else store.removeItem(k)};
  load();
  const mkSession=async(row)=>{const t='tok_'+row.id+'_'+Math.random().toString(36).slice(2);const user={id:row.id,email:row.email,user_metadata:{name:row.name}};tokens.set(t,user);session={access_token:t,user};persist();return session};
  const emit=(ev)=>listeners.forEach(f=>f(ev,session));
  const uid=()=>session&&session.user.id;
  const err=e=>({message:e.message});
  const client={
   auth:{
    async signUp({email,password,options}){const ex=(await pool.query('select id from auth.users where email=$1',[email])).rows[0];if(ex)return{data:{user:null,session:null},error:{message:'User already registered'}};
      const row=(await pool.query('insert into auth.users(email,password,name) values ($1,$2,$3) returning *',[email,password,options?.data?.name||''])).rows[0];
      if(global.__CONFIRM){return{data:{user:{id:row.id},session:null},error:null}}
      const s=await mkSession(row);emit('SIGNED_IN');return{data:{user:s.user,session:s},error:null}},
    async signInWithPassword({email,password}){const row=(await pool.query('select * from auth.users where email=$1',[email])).rows[0];if(!row||row.password!==password)return{data:{},error:{message:'Invalid login credentials'}};const s=await mkSession(row);emit('SIGNED_IN');return{data:{user:s.user,session:s},error:null}},
    async signOut(){session=null;persist();emit('SIGNED_OUT');return{error:null}},
    async getSession(){load();return{data:{session}}},
    onAuthStateChange(f){listeners.push(f);return{data:{subscription:{unsubscribe(){}}}}},
    async resetPasswordForEmail(){return{error:null}},async updateUser(){return{error:null}}},
   async rpc(fn,args){if(!uid())return{data:null,error:{message:'not_signed_in'}};const keys=Object.keys(args||{});try{const r=await asUser(uid(),`select * from ${fn}(${keys.map((kk,i)=>`${kk} => $${i+1}`).join(',')})`,keys.map(kk=>args[kk]));const scalar=r.fields.length===1&&r.fields[0].name===fn;return{data:scalar?(r.rows[0]?r.rows[0][fn]:null):r.rows,error:null}}catch(e){return{data:null,error:err(e)}}},
   from(t){return{select:async()=>{try{const r=await asUser(uid(),`select * from ${t}`);return{data:r.rows,error:null}}catch(e){return{data:null,error:err(e)}}}}},
   channel(name,o){const key=o?.config?.presence?.key;const room=presence.get(name)||presence.set(name,new Map()).get(name);let cb=null;const self={on(t,f,g){cb=g;return self},subscribe(f){room.set(key,{state:null,cb:()=>cb&&cb()});setTimeout(()=>f('SUBSCRIBED'),1);return self},async track(st){room.get(key).state=st;room.forEach(m=>m.cb())},untrack(){room.delete(key);room.forEach(m=>m.cb())},presenceState(){const o={};room.forEach((m,kk)=>{if(m.state)o[kk]=[m.state]});return o}};return self},
   removeChannel(){}};
  return client}}}
// ---- DOM bootstrap ----
export async function boot({user=null,store=new Map(),confirm=false,extra}={}){
 const html=fs.readFileSync(R+'index.html','utf8').replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>','').replace('<script src="/claude-shim.js"></script>','<script>'+fs.readFileSync(R+'claude-shim.js','utf8')+'</script>');
 const ls={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size}};
 const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://site.test/',pretendToBeVisual:true,
  beforeParse(w){w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};w.__errs=[];w.addEventListener('error',e=>w.__errs.push(e.message));
   Object.defineProperty(w,'localStorage',{value:ls,configurable:true});
   w.ROLEVIA_CFG={backend:true,supabaseUrl:'https://sb.test',supabaseAnonKey:'anon',payments:true,ai:true};
   w.supabase=fakeSupabase(ls);
   w.__spoken=[];w.__recs=[];
   w.SpeechRecognition=function(){const r=this;r.start=()=>{w.__recs.push(r);r.live=true;setTimeout(()=>r.onstart&&r.onstart(),2)};r.abort=()=>{r.live=false;r.onend&&r.onend()};r.say=t=>r.onresult&&r.onresult({results:[[{transcript:t}]]})};
   w.SpeechSynthesisUtterance=function(t){this.text=t};w.speechSynthesis={getVoices:()=>[],cancel(){},speak(u){w.__spoken.push(u.text);setTimeout(()=>{u.onstart&&u.onstart();u.onend&&u.onend()},5)}};
   w.fetch=async(u,o={})=>{u=String(u);if(u.startsWith('/api/')){const mod=u.replace('/api/','')+'.js';const m=mod==='ai.js'?'ai.js':mod;const method=o.method||'GET';const body=o.body?JSON.parse(o.body):undefined;const h={};for(const kk in (o.headers||{}))h[kk.toLowerCase()]=o.headers[kk];h['x-forwarded-for']=h['x-forwarded-for']||'7.7.7.'+Math.floor(Math.random()*250);const r=await callApi(m,{method,body,headers:h});return{ok:r.code<400,status:r.code,json:async()=>r.body}}
    if(/fonts|cdnjs|jsdelivr/.test(u))return{ok:true,text:async()=>''};throw new Error('unmocked page fetch '+u)};
   w.pdfjsLib={GlobalWorkerOptions:{},getDocument:o=>pdfjs.getDocument({data:new Uint8Array(Buffer.from(o.data))})};w.mammoth={extractRawText:o=>mammoth.extractRawText({buffer:Buffer.from(o.arrayBuffer)})};
   if(extra)extra(w)}});
 const w=dom.window;await sleep(500);
 w.Blob.prototype.arrayBuffer=function(){return new Promise(r=>{const fr=new w.FileReader();fr.onload=()=>r(fr.result);fr.readAsArrayBuffer(this)})};
 return{w,d:w.document,store}}
export const page=(d)=>d.querySelector('main')?.textContent.replace(/\s+/g,' ')||d.body.textContent.replace(/\s+/g,' ');
export async function userStore(email,name='U'){const id=await makeUser(email,'password123',name);const t='tok_'+id+'_pre';tokens.set(t,{id,email,user_metadata:{name}});const st=new Map();st.set('sb-test-auth-token',JSON.stringify({access_token:t,user:{id,email,user_metadata:{name}}}));return{id,store:st}}
