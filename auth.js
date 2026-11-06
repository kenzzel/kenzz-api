import { authClient } from "./supabase.js";
import { bearer, send } from "./http.js";

export async function requireOwner(req, res) {
  const token = bearer(req);
  if (!token) {
    send(res, 401, { error: "Missing session token" });
    return null;
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    send(res, 401, { error: "Invalid or expired session" });
    return null;
  }

  const ownerEmail = (process.env.OWNER_EMAIL || "").toLowerCase();
  const userEmail = (data.user.email || "").toLowerCase();

  if (!ownerEmail || userEmail !== ownerEmail) {
    send(res, 403, { error: "Owner access only" });
    return null;
  }

  return data.user;
}
