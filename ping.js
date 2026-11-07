import { send, methodOnly } from "../../_lib/http.js";
import { requireOwner } from "../../_lib/auth.js";
export default async function handler(req,res){
 if(!methodOnly(req,res,"GET")) return;
 const owner=await requireOwner(req,res); if(!owner) return;
 const targets=(process.env.MONITOR_TARGETS||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,10);
 const results=await Promise.all(targets.map(async url=>{
  try { const u=new URL(url); if(!["https:","http:"].includes(u.protocol)) throw new Error("Invalid protocol");
   const start=Date.now(); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
   const r=await fetch(u,{method:"GET",redirect:"manual",signal:controller.signal}); clearTimeout(timer);
   return {url,status:r.status,online:r.status>0,latency_ms:Date.now()-start};
  } catch(e){return {url,online:false,error:e.name==="AbortError"?"Timeout":"Connection failed"};}
 }));
 return send(res,200,{targets:results,checked_at:new Date().toISOString(),note:"HTTP(S) reachability check; not ICMP ping."});
}
