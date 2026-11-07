# Kenzz API v2 — Complete Starter

## Struktur
- `src/`: frontend, CSS, Supabase browser config
- `api/`: Vercel serverless functions
- `supabase/schema.sql`: database, profiles, quotas, atomic rate-limit RPC

## Deploy / upgrade
1. Backup repository and Supabase database first.
2. Replace repository contents with the contents of this ZIP (keep folders).
3. In Supabase SQL Editor, run `supabase/schema.sql`.
   - This is safe for existing tables with compatible columns, but review first if you customized the schema.
4. In `src/config.js`, verify the Supabase URL and publishable/anon key.
5. Vercel Project Settings -> Environment Variables:
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - OWNER_EMAIL
   - provider keys and base URLs you use
6. Set Vercel Node.js runtime to 22.x if available and redeploy.

## Owner
Create the Owner user through Supabase Authentication -> Users.
Set `OWNER_EMAIL` to exactly that account email in Vercel.
The Owner console gate uses this email. The frontend Owner navigation is also gated by matching email, but backend authorization is authoritative.

## User registration
Users register from the login screen. Supabase email confirmation may need to be completed depending on Auth settings.
A database trigger creates their profile and default quota row.

## Gateway
POST `/api/gateway/chat`
Headers:
`Authorization: Bearer kenzz_live_...`
`Content-Type: application/json`

JSON:
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "messages": [{"role":"user","content":"Halo"}]
}
```
Supported provider ids: `openai`, `groq`, `deepseek`, `together`, `mistral`.

## Important notes
- API keys are stored as SHA-256 hashes and shown only once at creation.
- Rate limiting and monthly quotas use a PostgreSQL RPC. Monthly usage counts successful/failed gateway requests after they are inserted into `api_usage`; quota check happens before provider call.
- Owner can block accounts and set per-user RPM/monthly request limits.
- Provider keys and Supabase service-role key belong only in Vercel Environment Variables.
- This is a functional MVP starter, not a billing-ready commercial platform. It does not yet include payments, balance/wallet, automated invoices, email notifications, or a full audit UI.
- Before public production, add CAPTCHA/email abuse controls, provider model allowlists, stricter spend caps, monitoring/alerts, and test schema migration in a staging project.
