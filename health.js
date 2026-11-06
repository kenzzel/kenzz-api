import { send, methodOnly } from "./_lib/http.js";

export default function handler(req, res) {
  if (!methodOnly(req, res, "GET")) return;
  return send(res, 200, {
    name: "Kenzz API",
    status: "online",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
}
