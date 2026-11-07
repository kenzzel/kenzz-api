import { adminDb } from "./_lib/supabase.js";
import { requireUser } from "./_lib/auth.js";
import { send, methodOnly } from "./_lib/http.js";
export default async function handler(req, res) {
  if (!methodOnly(req, res, "GET")) return;
  const user = await requireUser(req, res);
  if (!user) return;
  const { data, error } = await adminDb.from("api_usage")
    .select("id,provider,model,status_code,prompt_tokens,completion_tokens,latency_ms,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return send(res, 500, { error: "Could not load usage history" });
  const rows = data || [];
  return send(res, 200, {
    usage: rows,
    total_requests: rows.length,
    successful_requests: rows.filter(x => x.status_code >= 200 && x.status_code < 400).length,
    total_tokens: rows.reduce((n, x) => n + (x.prompt_tokens || 0) + (x.completion_tokens || 0), 0)
  });
}
