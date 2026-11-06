export function send(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(payload));
}

export function methodOnly(req, res, method) {
  if (req.method !== method) {
    send(res, 405, { error: "Method not allowed" });
    return false;
  }
  return true;
}

export function bearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
