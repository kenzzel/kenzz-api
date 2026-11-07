import { send, methodOnly, bodyObject, bearer } from "../../_lib/http.js";
import { adminDb } from "../../_lib/supabase.js";
import { requireOwner } from "../../_lib/auth.js";
export default async function handler(req,res){
 if(req.method==="POST"){ if(!methodOnly(req,res,"POST")) return; const token=process.env.VPS_AGENT_TOKEN; if(!token || bearer(req)!==token) return send(res,401,{error:"Invalid agent token"}); const b=bodyObject(req);
  const n={hostname:String(b.hostname||"VPS").slice(0,100),cpu_percent:Number(b.cpu_percent),ram_used_mb:Number(b.ram_used_mb),ram_total_mb:Number(b.ram_total_mb),disk_used_percent:Number(b.disk_used_percent),uptime_seconds:Number(b.uptime_seconds)};
  if(Object.values(n).some((v,i)=>i>0 && (!Number.isFinite(v)||v<0))) return send(res,400,{error:"Invalid metrics payload"});
  const {error}=await adminDb.from("vps_metrics").insert(n); if(error) return send(res,500,{error:"Could not save metrics. Run supabase/schema.sql"}); return send(res,201,{success:true});
 }
 if(!methodOnly(req,res,"GET")) return; const owner=await requireOwner(req,res); if(!owner)return; const {data,error}=await adminDb.from("vps_metrics").select("*").order("created_at",{ascending:false}).limit(1); if(error)return send(res,500,{error:"Could not load VPS metrics"}); return send(res,200,{metrics:data?.[0]||null});
}
