import { randomBytes, createHash } from "node:crypto";
import { adminDb } from "./_lib/supabase.js";
import { requireOwner } from "./_lib/auth.js";
import { send } from "./_lib/http.js";

const hashKey = (key) => createHash("sha256").update(key).digest("hex");

export default async function handler(req, res) {
  const owner = await requireOwner(req, res);
  if (!owner) return;

  if (req.method === "GET") {
    const { data, error } = await adminDb
      .from("api_keys")
      .select("id, label, key_prefix, status, requests_count, created_at, last_used_at")
      .eq("user_id", owner.id)
      .order("created_at", { ascending: false });

    if (error) return send(res, 500, { error: "Could not load API keys" });
    return send(res, 200, { keys: data || [] });
  }

  if (req.method === "POST") {
    const label = String(req.body?.label || "Untitled key").trim().slice(0, 60);
    const rawKey = `kenzz_live_${randomBytes(32).toString("hex")}`;
    const { data, error } = await adminDb
      .from("api_keys")
      .insert({
        user_id: owner.id,
        label,
        key_hash: hashKey(rawKey),
        key_prefix: rawKey.slice(0, 19),
        status: "active"
      })
      .select("id, label, key_prefix, status, created_at")
      .single();

    if (error) return send(res, 500, { error: "Could not create API key" });
    // Raw key is returned once only. It is never stored in plaintext.
    return send(res, 201, { key: data, secret: rawKey, warning: "Copy this key now. It cannot be displayed again." });
  }

  if (req.method === "DELETE") {
    const id = String(req.body?.id || "");
    if (!id) return send(res, 400, { error: "Key id is required" });
    const { error } = await adminDb
      .from("api_keys")
      .update({ status: "revoked" })
      .eq("id", id)
      .eq("user_id", owner.id);
    if (error) return send(res, 500, { error: "Could not revoke API key" });
    return send(res, 200, { success: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return send(res, 405, { error: "Method not allowed" });
}
