import { send, methodOnly } from "./_lib/http.js";
export default function handler(req, res) {
  if (!methodOnly(req, res, "GET")) return;
  return send(res, 200, {
    name: "Kenzz API", status: "online", version: "2.0.0",
    providers: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
      together: Boolean(process.env.TOGETHER_API_KEY),
      mistral: Boolean(process.env.MISTRAL_API_KEY)
    },
    timestamp: new Date().toISOString()
  });
}
