import { send, methodOnly } from "../_lib/http.js";
export default function handler(req, res) {
  if (!methodOnly(req, res, "GET")) return;
  const names = ["openai", "groq", "deepseek", "together", "mistral"];
  const envs = { openai: "OPENAI_API_KEY", groq: "GROQ_API_KEY", deepseek: "DEEPSEEK_API_KEY", together: "TOGETHER_API_KEY", mistral: "MISTRAL_API_KEY" };
  return send(res, 200, { name: "Kenzz API", status: "online", version: "3.0.0", providers: Object.fromEntries(names.map(n => [n, Boolean(process.env[envs[n]])])), supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY), timestamp: new Date().toISOString() });
}
