import { adminDb } from "../_lib/supabase.js";
import { requireOwner } from "../_lib/auth.js";
import { send, bodyObject } from "../_lib/http.js";
export default async function handler(req, res) {
  const owner = await requireOwner(req, res);
  if (!owner) return;
  if (req.method === "GET") {
    const { data, error } = await adminDb.from("profiles")
      .select("id,display_name,role,status,created_at").order("created_at", { ascending: false }).limit(200);
    if (error) return send(res, 500, { error: "Could not load users" });
    return send(res, 200, { users: data || [] });
  }
  if (req.method === "PATCH") {
    const { id, status, role } = bodyObject(req);
    if (!id || id === owner.id) return send(res, 400, { error: "Invalid target user" });
    const patch = {};
    if (["active", "blocked"].includes(status)) patch.status = status;
    if (["user", "owner"].includes(role)) patch.role = role;
    if (!Object.keys(patch).length) return send(res, 400, { error: "No valid changes" });
    const { error } = await adminDb.from("profiles").update(patch).eq("id", id);
    if (error) return send(res, 500, { error: "Could not update user" });
    return send(res, 200, { success: true });
  }
  res.setHeader("Allow", "GET, PATCH");
  return send(res, 405, { error: "Method not allowed" });
}
