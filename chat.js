import { createHash } from "node:crypto";
import { adminDb } from "../_lib/supabase.js";
import { bearer, send, methodOnly } from "../_lib/http.js";

const hashKey = (key) => createHash("sha256").update(key).digest("hex");

const PROVIDERS = {
  openai: { key: "OPENAI_API_KEY", base: "OPENAI_BASE_URL", defaultModel: "gpt-4o-mini" },
  groq: { key: "GROQ_API_KEY", base: "GROQ_BASE_URL", defaultModel: "llama-3.3-70b-versatile" },
  deepseek: { key: "DEEPSEEK_API_KEY", base: "DEEPSEEK_BASE_URL", defaultModel: "deepseek-chat" },
  together: { key: "TOGETHER_API_KEY", base: "TOGETHER_BASE_URL", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" }
};

export default async function handler(req, res) {
  if (!methodOnly(req, res, "POST")) return;

  const clientKey = bearer(req);
  if (!clientKey.startsWith("kenzz_live_")) {
    return send(res, 401, { error: "A valid Kenzz API key is required in Authorization: Bearer ..." });
  }

  const { data: keyRow, error: keyError } = await adminDb
    .from("api_keys")
    .select("id, user_id, status, requests_count")
    .eq("key_hash", hashKey(clientKey))
    .maybeSingle();

  if (keyError || !keyRow || keyRow.status !== "active") {
    return send(res, 401, { error: "Invalid or revoked API key" });
  }

  const providerName = String(req.body?.provider || "openai").toLowerCase();
  const provider = PROVIDERS[providerName];
  if (!provider) return send(res, 400, { error: "Unsupported provider", supported: Object.keys(PROVIDERS) });

  const providerKey = process.env[provider.key];
  const baseUrl = process.env[provider.base];
  if (!providerKey || !baseUrl) {
    return send(res, 503, { error: `Provider ${providerName} is not configured by the owner` });
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 40) {
    return send(res, 400, { error: "messages must be an array containing 1 to 40 items" });
  }

  const model = String(req.body?.model || provider.defaultModel).slice(0, 120);
  const started = Date.now();

  try {
    const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${providerKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Number.isFinite(req.body?.temperature) ? Math.max(0, Math.min(2, req.body.temperature)) : 0.7,
        max_tokens: Number.isInteger(req.body?.max_tokens) ? Math.max(1, Math.min(4096, req.body.max_tokens)) : 1024
      })
    });

    const responseText = await upstream.text();
    let payload;
    try { payload = JSON.parse(responseText); }
    catch { payload = { error: { message: "Provider returned a non-JSON response" } }; }

    const usage = payload?.usage || {};
    await adminDb.from("api_usage").insert({
      api_key_id: keyRow.id,
      user_id: keyRow.user_id,
      provider: providerName,
      model,
      status_code: upstream.status,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      latency_ms: Date.now() - started
    });

    await adminDb.from("api_keys")
      .update({ requests_count: (keyRow.requests_count || 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);

    return send(res, upstream.status, payload);
  } catch (error) {
    await adminDb.from("api_usage").insert({
      api_key_id: keyRow.id,
      user_id: keyRow.user_id,
      provider: providerName,
      model,
      status_code: 502,
      latency_ms: Date.now() - started,
      error_message: String(error?.message || "Upstream request failed").slice(0, 500)
    });
    return send(res, 502, { error: "Provider request failed" });
  }
}
