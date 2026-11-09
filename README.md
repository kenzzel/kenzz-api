# Kenzz API v3 — Auto AI Gateway

## Deploy
1. Upload the contents of this folder to the root of the GitHub repository connected to Vercel.
2. In Supabase SQL Editor, run `schema.sql` (review existing custom schema first; take a backup).
3. In Vercel Environment Variables, configure:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Secret; server only)
   - `OWNER_EMAIL` (email used by the Owner account)
   - Any provider keys: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `MISTRAL_API_KEY`, optional `TOGETHER_API_KEY`
4. Redeploy after changing environment variables.

Provider base URLs have secure defaults; optional `*_BASE_URL` variables are not required.

## Endpoints
- `GET /api/health` — public service and provider-configuration status (does not reveal keys)
- `POST /api/gateway/chat` — OpenAI-compatible chat endpoint
- `GET|POST|DELETE /api/keys` — create/list/revoke keys (Supabase session required)
- `GET /api/usage` — usage history
- `GET|PATCH /api/admin/users` — Owner-only user management
- `GET|POST /api/admin/limits` — Owner-only quota management

## Gateway request
```json
{
  "provider": "auto",
  "model": "kenzz-auto",
  "messages": [{"role":"user","content":"Halo"}]
}
```
Use `provider: "auto"` or `model: "kenzz-auto"` for failover. Auto order: Groq, Gemini, DeepSeek, OpenAI, Mistral, Together AI; only configured providers are attempted. Explicit provider selection does not silently switch providers.

Header: `Authorization: Bearer kenzz_live_...`

## Security
- Provider secrets and Supabase service-role key must be Vercel Environment Variables only.
- Kenzz API secrets are stored as SHA-256 hashes and shown once.
- No VPS is required for the AI gateway. VPS CPU/RAM/disk monitoring is unavailable until a VPS and monitoring agent exist.
- This is an MVP gateway. Add spending caps, abuse controls, model allowlists, and production monitoring before public commercial launch.
