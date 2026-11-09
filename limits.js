import { adminDb } from "../_lib/supabase.js";
import { requireOwner } from "../_lib/auth.js";
import { send, bodyObject } from "../_lib/http.js";
export default async function handler(req, res) {
  const owner = await requireOwner(req, res);
  if (!owner) return;
  if (req.method === "GET") {
    const { data, error } = await adminDb.from("api_limits")
      .select("user_id,requests_per_minute,monthly_request_limit");
    if (error) return send(res, 500, { error: "Could not load limits" });
    return send(res, 200, { limits: data || [] });
  }
  if (req.method === "POST") {
    const b = bodyObject(req);
    const rpm = Math.max(1, Math.min(600, Number(b.requests_per_minute) || 30));
    const monthly = b.monthly_request_limit == null || b.monthly_request_limit === ""
      ? null : Math.max(1, Number(b.monthly_request_limit));
    if (!b.user_id) return send(res, 400, { error: "user_id is required" });
    const { error } = await adminDb.from("api_limits").upsert({
      user_id: b.user_id, requests_per_minute: rpm, monthly_request_limit: monthly
    }, { onConflict: "user_id" });
    if (error) return send(res, 500, { error: "Could not save limits" });
    return send(res, 200, { success: true });
  }
  res.setHeader("Allow", "GET, POST");
  return send(res, 405, { error: "Method not allowed" });
}
