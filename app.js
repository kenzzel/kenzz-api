import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
let session = null, isOwner = false, signupMode = false, keysCache = [];

function msg(text, error=false) { $("globalMessage").textContent=text; $("globalMessage").className=error?"message error":"message"; }
function authMsg(text,error=false) { $("authMessage").textContent=text; $("authMessage").className=error?"message error":"message"; }
async function api(path, options={}) {
  if (!session?.access_token) throw new Error("Session login tidak ditemukan. Silakan login ulang.");
  const response = await fetch(path,{...options,headers:{
    "Content-Type":"application/json",
    Authorization:`Bearer ${session.access_token}`,
    ...(options.headers||{})
  }});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||`Request gagal (${response.status})`);
  return data;
}
function showAuth(){ $("authView").hidden=false; $("appView").hidden=true; }
async function showApp(user){
  $("authView").hidden=true; $("appView").hidden=false;
  $("userEmail").textContent=user.email||"Account";
  // Ask the server; never trust a browser-side role flag.
  try { await api("/api/admin/users"); isOwner=true; }
  catch { isOwner=false; }
  $("ownerNav").hidden=!isOwner;
  $("statRole").textContent=isOwner?"OWNER":"USER";
  $("statStatus").textContent="Authenticated";
  navigate("overview"); refreshAll();
}
function navigate(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active-page",p.id===`page-${page}`));
  document.querySelectorAll(".nav[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  if(page==="users"&&isOwner) loadUsers();
  if(page==="limits"&&isOwner) loadLimits();
  if(page==="providers") loadHealth();
  if(page==="monitor") loadMonitor();
}
async function refreshAll(){ await Promise.allSettled([loadKeys(),loadUsage(),loadHealth()]); }
async function loadKeys(){
  try{
    const d=await api("/api/keys"); keysCache=d.keys||[];
    $("statKeys").textContent=keysCache.length;
    $("keyList").innerHTML="";
    $("testerKey").innerHTML='<option value="">Pilih API Key aktif</option>';
    if(!keysCache.length) $("keyList").textContent="Belum ada API Key.";
    for(const k of keysCache){
      const row=document.createElement("div");row.className="data-row";
      const info=document.createElement("div");info.innerHTML="";
      const name=document.createElement("b");name.textContent=k.label;
      const small=document.createElement("small");small.textContent=`${k.key_prefix}… • ${k.requests_count||0} requests`;
      info.append(name,small);
      const status=document.createElement("span");status.className=`tag ${k.status}`;status.textContent=k.status;
      const revoke=document.createElement("button");revoke.className="btn tiny danger";revoke.textContent="Revoke";revoke.disabled=k.status!=="active";
      revoke.onclick=()=>revokeKey(k.id);
      row.append(info,status,revoke);$("keyList").append(row);
      if(k.status==="active"){const op=document.createElement("option");op.value=k.id;op.textContent=`${k.label} (${k.key_prefix}…)`;$("testerKey").append(op);}
    }
    $("statKeys").textContent=keysCache.length;
  }catch(e){msg(e.message,true);}
}
async function revokeKey(id){
  if(!confirm("Cabut API Key ini? Aplikasi yang menggunakannya akan langsung kehilangan akses."))return;
  try{await api("/api/keys",{method:"DELETE",body:JSON.stringify({id})});msg("API Key berhasil dicabut.");loadKeys();}
  catch(e){msg(e.message,true);}
}
async function loadUsage(){
  try{
    const d=await api("/api/usage");const rows=d.usage||[];
    $("statRequests").textContent=d.total_requests??rows.length;
    $("statTokens").textContent=d.total_tokens??0;
    $("usageList").innerHTML="";
    if(!rows.length){$("usageList").textContent="Belum ada request tercatat.";return;}
    for(const u of rows){
      const row=document.createElement("div");row.className="data-row";
      const info=document.createElement("div");const b=document.createElement("b");b.textContent=`${u.provider} / ${u.model}`;
      const s=document.createElement("small");s.textContent=new Date(u.created_at).toLocaleString();
      info.append(b,s);const status=document.createElement("span");status.className=`tag ${u.status_code<400?"active":"revoked"}`;status.textContent=String(u.status_code);
      const latency=document.createElement("small");latency.textContent=`${u.latency_ms??"-"} ms`;
      row.append(info,status,latency);$("usageList").append(row);
    }
  }catch(e){msg(e.message,true);}
}
async function loadUsers(){
  try{
    const d=await api("/api/admin/users");$("userList").innerHTML="";
    for(const u of d.users||[]){
      const row=document.createElement("div");row.className="data-row";
      const info=document.createElement("div");const b=document.createElement("b");b.textContent=u.display_name||u.id.slice(0,8);
      const s=document.createElement("small");s.textContent=`${u.role} • ${u.status} • ${new Date(u.created_at).toLocaleDateString()}`;info.append(b,s);
      const toggle=document.createElement("button");toggle.className="btn tiny ghost";toggle.textContent=u.status==="blocked"?"Unblock":"Block";
      toggle.onclick=async()=>{try{await api("/api/admin/users",{method:"PATCH",body:JSON.stringify({id:u.id,status:u.status==="blocked"?"active":"blocked"})});loadUsers();}catch(e){msg(e.message,true);}};
      row.append(info,toggle);$("userList").append(row);
    }
  }catch(e){msg(e.message,true);}
}
async function loadLimits(){
  try{
    const [u,l]=await Promise.all([api("/api/admin/users"),api("/api/admin/limits")]);
    const map=new Map((l.limits||[]).map(x=>[x.user_id,x]));
    $("limitList").innerHTML="";
    for(const user of u.users||[]){
      const current=map.get(user.id)||{requests_per_minute:30,monthly_request_limit:""};
      const row=document.createElement("div");row.className="limit-row";
      const label=document.createElement("b");label.textContent=user.display_name||user.id.slice(0,8);
      const rpm=document.createElement("input");rpm.type="number";rpm.min="1";rpm.max="600";rpm.value=current.requests_per_minute;
      rpm.setAttribute("aria-label","Requests per minute");
      const monthly=document.createElement("input");monthly.type="number";monthly.min="1";monthly.placeholder="Monthly limit";monthly.value=current.monthly_request_limit??"";
      const save=document.createElement("button");save.className="btn tiny primary";save.textContent="Save";
      save.onclick=async()=>{try{await api("/api/admin/limits",{method:"POST",body:JSON.stringify({user_id:user.id,requests_per_minute:Number(rpm.value),monthly_request_limit:monthly.value||null})});msg("Limit tersimpan.");}catch(e){msg(e.message,true);}};
      row.append(label,rpm,monthly,save);$("limitList").append(row);
    }
  }catch(e){msg(e.message,true);}
}
async function loadMonitor(){
  try {
    const [ping, metric] = await Promise.all([api("/api/monitor/ping"), api("/api/monitor/metrics")]);
    $("pingList").innerHTML="";
    if(!ping.targets?.length) $("pingList").textContent="Belum ada MONITOR_TARGETS di Vercel.";
    for(const t of ping.targets||[]){const row=document.createElement("div");row.className="data-row";const info=document.createElement("div");const b=document.createElement("b");b.textContent=t.url;const small=document.createElement("small");small.textContent=t.online?`${t.status} • ${t.latency_ms} ms`:t.error;info.append(b,small);const tag=document.createElement("span");tag.className=`tag ${t.online?"active":"revoked"}`;tag.textContent=t.online?"Online":"Offline";row.append(info,tag);$("pingList").append(row);}
    const m=metric.metrics;$("metricsList").innerHTML="";
    if(!m){$("metricsList").textContent="Belum ada data. Pasang scripts/vps-agent.sh di VPS dan isi VPS_AGENT_TOKEN.";return;}
    const vals=[["Hostname",m.hostname],["CPU",`${Number(m.cpu_percent).toFixed(1)}%`],["RAM",`${m.ram_used_mb} / ${m.ram_total_mb} MB`],["Disk",`${Number(m.disk_used_percent).toFixed(1)}%`],["Uptime",`${Math.floor(m.uptime_seconds/3600)} jam`],["Last update",new Date(m.created_at).toLocaleString()]];
    for(const [k,v] of vals){const row=document.createElement("div");row.className="data-row";const a=document.createElement("b");a.textContent=k;const z=document.createElement("span");z.textContent=v;row.append(a,z);$("metricsList").append(row);}
  } catch(e){$("pingList").textContent=e.message;}
}
async function loadHealth(){
  try{const d=await fetch("/api/health").then(r=>r.json());$("providerList").innerHTML="";
    for(const [name,enabled] of Object.entries(d.providers||{})){const row=document.createElement("div");row.className="data-row";const b=document.createElement("b");b.textContent=name.toUpperCase();const tag=document.createElement("span");tag.className=`tag ${enabled?"active":"revoked"}`;tag.textContent=enabled?"Configured":"Not configured";row.append(b,tag);$("providerList").append(row);}
  }catch(e){$("providerList").textContent="Health endpoint tidak dapat dihubungi.";}
}
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();authMsg(signupMode?"Membuat akun...":"Memeriksa akun...");
  const email=$("email").value.trim(),password=$("password").value;
  if(signupMode){
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:$("displayName").value.trim()}}});
    if(error)return authMsg(error.message,true);
    if(data.session){session=data.session;await await showApp(data.user);}
    else authMsg("Pendaftaran berhasil. Periksa email untuk verifikasi, lalu login.");
  }else{
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error)return authMsg(error.message,true);
    session=data.session;
    const check=await fetch("/api/keys",{headers:{Authorization:`Bearer ${session.access_token}`}});
    if(check.status===403){await supabase.auth.signOut();session=null;return authMsg("Akun diblokir atau profil belum siap.",true);}
    if(!check.ok){const d=await check.json().catch(()=>({}));return authMsg(d.error||"Tidak dapat memuat akun.",true);}
    await await showApp(data.user);
  }
});
$("toggleAuth").onclick=()=>{
  signupMode=!signupMode;$("nameWrap").hidden=!signupMode;
  $("authTitle").textContent=signupMode?"Create your account.":"Welcome back.";
  $("authSubtitle").textContent=signupMode?"Daftar untuk mendapatkan akses Kenzz API.":"Masuk ke akun Kenzz API kamu.";
  $("authSubmit").innerHTML=signupMode?"Create account <span>→</span>":"Sign in <span>→</span>";
  $("toggleAuth").textContent=signupMode?"Sudah punya akun? Login":"Belum punya akun? Daftar";
  authMsg("");
};
$("createKey").onclick=async()=>{
  const label=prompt("Nama API Key:","My Application");if(label===null)return;
  try{const d=await api("/api/keys",{method:"POST",body:JSON.stringify({label})});$("secretValue").textContent=d.secret;$("secretBox").hidden=false;msg("Key dibuat. Salin secret sekarang; secret tidak dapat ditampilkan ulang.");loadKeys();navigate("keys");}
  catch(e){msg(e.message,true);}
};
$("copySecret").onclick=async()=>{await navigator.clipboard.writeText($("secretValue").textContent);msg("API Key disalin.");};
$("logout").onclick=async()=>{await supabase.auth.signOut();session=null;showAuth();};
document.querySelectorAll(".nav[data-page]").forEach(b=>b.onclick=()=>navigate(b.dataset.page));
document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>navigate(b.dataset.goto));
$("refreshMonitor").onclick=loadMonitor;
$("refreshUsage").onclick=loadUsage;$("refreshUsers").onclick=loadUsers;$("refreshHealth").onclick=loadHealth;
$("runTest").onclick=async()=>{
  const id=$("testerKey").value,key=keysCache.find(k=>k.id===id);
  if(!key)return $("testerResult").textContent="Pilih API Key terlebih dahulu.";
  const secret=prompt("Masukkan secret API Key (ditampilkan hanya saat dibuat):");
  if(!secret)return;
  $("testerResult").textContent="Mengirim request...";
  try{
    const response=await fetch("/api/gateway/chat",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${secret}`},body:JSON.stringify({provider:$("testerProvider").value,model:$("testerModel").value||undefined,messages:[{role:"user",content:$("testerPrompt").value}]})});
    $("testerResult").textContent=JSON.stringify(await response.json(),null,2);loadUsage();
  }catch(e){$("testerResult").textContent=e.message;}
};
$("mobileMenu").onclick=()=>document.querySelector(".sidebar").classList.toggle("mobile-open");
const {data:sd}=await supabase.auth.getSession();
if(sd.session){session=sd.session;const {data}=await supabase.auth.getUser();if(data.user){const chk=await fetch("/api/keys",{headers:{Authorization:`Bearer ${session.access_token}`}});if(chk.ok)await await showApp(data.user);else showAuth();}else showAuth();}else showAuth();
