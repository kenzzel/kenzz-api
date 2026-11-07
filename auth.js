import { authClient, adminDb } from "./supabase.js";
import { bearer, send } from "./http.js";

export async function requireUser(req, res) {
  const token = bearer(req);
  if (!token) { send(res, 401, { error: "Missing session token" }); return null; }
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) { send(res, 401, { error: "Invalid or expired session" }); return null; }

  const { data: profile, error: profileError } = await adminDb
    .from("profiles").select("role,status").eq("id", data.user.id).maybeSingle();

  if (profileError || profile?.status === "blocked") {
    send(res, 403, { error: "Account is blocked or profile is unavailable" });
    return null;
  }
  return { ...data.user, profile };
}
export async function requireOwner(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const ownerEmail = (process.env.OWNER_EMAIL || "").toLowerCase();
  const email = (user.email || "").toLowerCase();
  if (!ownerEmail || email !== ownerEmail) {
    send(res, 403, { error: "Owner access only" });
    return null;
  }
  return user;
}
