# Kenzz API

Owner-only API management console + OpenAI-compatible multi-provider gateway.

## Stack
- Node.js 22
- Vercel Functions
- Supabase Auth + Postgres
- Vanilla HTML/CSS/JS

## Included in this starter
- Owner login through Supabase Auth
- Owner-only API key generation and revocation
- API keys stored as SHA-256 hashes (secret shown once)
- Chat completion gateway for OpenAI, Groq, DeepSeek, and Together
- Basic request usage logging
- Dark responsive dashboard

## 1. Create Supabase project
1. Create a project at https://supabase.com.
2. Open SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Open Authentication -> Users -> Add user.
5. Create the Owner account using an email and password.
6. Copy Project URL, anon/public key, and service_role key from Project Settings -> API.

## 2. Configure frontend
Edit `src/config.js`:
- `SUPABASE_URL`: your Project URL
- `SUPABASE_ANON_KEY`: your anon/public key

Never put the `service_role` key in `src/config.js`.

## 3. Configure Vercel environment variables
Import this project into Vercel, then add variables from `.env.example`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_EMAIL`
- provider API keys you intend to use
- matching provider base URLs

Set `OWNER_EMAIL` to the exact email used for the Owner account.
Redeploy after changing environment variables.

## 4. Deploy
1. Upload the project to a GitHub repository.
2. In Vercel, select Add New -> Project and import that repository.
3. Framework preset: Other.
4. Build command: leave empty; output directory: `.`.
5. Add environment variables and deploy.
6. Open the deployment URL and sign in with the Owner account.

## 5. Local development (Android / Termux)
Install Node.js in Termux, then:
```bash
pkg update && pkg upgrade
pkg install nodejs-lts git
npm install
cp .env.example .env
npx vercel login
npx vercel dev
```
Set the same environment variables in Vercel project settings or use a local `.env` file.
Open the local URL shown by Vercel in your Android browser.

## 6. Use the gateway
Create an API key in the Owner dashboard. Copy it immediately; it is displayed only once.

Request:
```bash
curl -X POST "https://YOUR-DOMAIN.vercel.app/api/gateway/chat" \
  -H "Authorization: Bearer kenzz_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role":"user","content":"Halo dari Kenzz API"}]
  }'
```

Supported provider values: `openai`, `groq`, `deepseek`, `together`.
Each provider requires its own valid provider API key in Vercel environment variables.

## Important security notes
- Do not share the Supabase service_role key or provider keys.
- Do not commit `.env` to GitHub.
- Revoke a key immediately if it is exposed.
- Use HTTPS only.
- This is a starter MVP, not a fully hardened public API marketplace. Before opening public registration, add per-key rate limiting, monthly quotas, billing, abuse detection, audit alerts, and stricter model allowlists.
- The current dashboard is Owner-only. End-user registration and self-service key management are intentionally not enabled in this first release.
