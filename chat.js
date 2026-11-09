import { createHash } from "node:crypto";
import { adminDb } from "../_lib/supabase.js";
import { bearer, send, methodOnly, bodyObject } from "../_lib/http.js";

const hashKey = key => createHash("sha256").update(key).digest("hex");
const PROVIDERS = {
  openai: { env: "OPENAI_API_KEY", base: "OPENAI_BASE_URL", model: "gpt-4o-mini" },
  groq: { env: "GROQ_API_KEY", base: "GROQ_BASE_URL", model: "llama-3.3-70b-versatile" },
  deepseek: { env: "DEEPSEEK_API_KEY", base: "DEEPSEEK_BASE_URL", model: "deepseek-chat" },
  together: { env: "TOGETHER_API_KEY", base: "TOGETHER_BASE_URL", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  mistral: { env: "MISTRAL_API_KEY", base: "MISTRAL_BASE_URL", model: "mistral-small-latest" }
};

export default async function handler(req, res) {
  if (!methodOnly(req, res, "POST")) return;
  const raw = bearer(req);
  if (!raw.startsWith("kenzz_live_")) return send(res, 401, { error: "Valid Kenzz API key required" });

  const { data: key, error: keyErr } = await adminDb.from("api_keys")
    .select("id,user_id,status,requests_count").eq("key_hash", hashKey(raw)).maybeSingle();
  if (keyErr || !key || key.status !== "active") return send(res, 401, { error: "Invalid or revoked API key" });

  const { data: profile } = await adminDb.from("profiles").select("status").eq("id", key.user_id).maybeSingle();
  if (profile?.status === "blocked") return send(res, 403, { error: "Account blocked" });

  // Atomic rate-limit/quota check implemented by PostgreSQL RPC.
  const { data: gate, error: gateError } = await adminDb.rpc("kenzz_consume_request", { p_user_id: key.user_id });
  if (gateError) return send(res, 503, { error: "Rate limit service unavailable. Run the latest schema.sql." });
  if (!gate?.allowed) {
    res.setHeader("Retry-After", String(gate.retry_after || 60));
    return send(res, 429, { error: gate?.reason || "Request limit exceeded", retry_after: gate?.retry_after || 60 });
  }

  const body = bodyObject(req);
  const providerName = String(body.provider || "openai").toLowerCase();
  const provider = PROVIDERS[providerName];
  if (!provider) return send(res, 400, { error: "Unsupported provider", supported: Object.keys(PROVIDERS) });
  const apiKey = process.env[provider.env];
  const base = process.env[provider.base];
  if (!apiKey || !base) return send(res, 503, { error: `Provider ${providerName} is not configured` });

  const messages = body.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 40) {
    return send(res, 400, { error: "messages must contain 1 to 40 messages" });
  }
  for (const m of messages) {
    if (!m || !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string") {
      return send(res, 400, { error: "Each message requires a valid role and string content" });
    }
  }

  const model = String(body.model || provider.model).slice(0, 120);
  const started = Date.now();
  let statusCode = 502, usage = {}, errorMessage = null;
  try {
    const upstream = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, messages,
        temperature: Number.isFinite(body.temperature) ? Math.max(0, Math.min(2, body.temperature)) : 0.7,
        max_tokens: Number.isInteger(body.max_tokens) ? Math.max(1, Math.min(4096, body.max_tokens)) : 1024
      })
    });
    statusCode = upstream.status;
    const text = await upstream.text();
    let result;
    try { result = JSON.parse(text); } catch { result = { error: { message: "Provider returned invalid JSON" } }; }
    usage = result?.usage || {};
    await adminDb.from("api_usage").insert({
      api_key_id: key.id, user_id: key.user_id, provider: providerName, model,
      status_code: statusCode, prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0, latency_ms: Date.now() - started
    });
    await adminDb.from("api_keys").update({
      requests_count: (key.requests_count || 0) + 1, last_used_at: new Date().toISOString()
    }).eq("id", key.id);
    return send(res, statusCode, result);
  } catch (e) {
    errorMessage = String(e?.message || "Provider request failed").slice(0, 400);
    await adminDb.from("api_usage").insert({
      api_key_id: key.id, user_id: key.user_id, provider: providerName, model,
      status_code: 502, latency_ms: Date.now() - started, error_message: errorMessage
    });
    return send(res, 502, { error: "Provider request failed" });
  }
}
