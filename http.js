export function send(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}
export function bearer(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}
export function methodOnly(req, res, method) {
  if (req.method !== method) {
    res.setHeader("Allow", method);
    send(res, 405, { error: "Method not allowed" });
    return false;
  }
  return true;
}
export function bodyObject(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
