# Kenzz API v3 — Vercel + Supabase

Dashboard private untuk Owner, API key gateway, multi-provider chat, usage logs, provider health, HTTP ping, dan VPS metrics.

## Struktur
- `index.html`, `style.css`, `app.js`, `config.js`: frontend statis.
- `api/`: Vercel Serverless Functions.
- `_lib/`: helper autentikasi, Supabase server, dan HTTP.
- `supabase/schema.sql`: tabel, RPC rate limit, dan RLS.
- `scripts/vps-agent.sh`: pengirim metrik CPU/RAM/disk/uptime Linux.

## Deploy
1. Backup repository dan database.
2. Upload seluruh isi folder ini ke root repository GitHub (jangan upload folder pembungkusnya).
3. Di Supabase SQL Editor, review lalu jalankan `supabase/schema.sql`.
4. Vercel → Settings → Environment Variables, isi:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (publishable/anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, jangan pernah taruh di frontend)
   - `OWNER_EMAIL` (email akun Owner)
   - Provider keys: `OPENAI_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `TOGETHER_API_KEY`, `MISTRAL_API_KEY` sesuai provider yang dipakai.
   - `VPS_AGENT_TOKEN` (random secret panjang)
   - `MONITOR_TARGETS` (opsional, URL HTTP(S) dipisahkan koma).
5. Redeploy Vercel.
6. Buat akun melalui Supabase Auth atau halaman login/register. Akun Owner harus memakai email sama dengan `OWNER_EMAIL`. Setelah register, pastikan user tersebut ada di `auth.users`; set role profile ke owner jika perlu: `update public.profiles set role='owner' where id=(select id from auth.users where email='owner@example.com');` (otorisasi Owner server tetap memverifikasi `OWNER_EMAIL`).

## Provider API
Base URL OpenAI-compatible sudah memiliki default. Environment `*_BASE_URL` hanya perlu diisi bila memakai endpoint custom. Provider key disimpan hanya di Vercel. Model default: OpenAI `gpt-4o-mini`, Groq `llama-3.3-70b-versatile`, DeepSeek `deepseek-chat`, Together `meta-llama/Llama-3.3-70B-Instruct-Turbo`, Mistral `mistral-small-latest`.

## API Gateway
`POST /api/gateway/chat`

Headers: `Authorization: Bearer kenzz_live_...`, `Content-Type: application/json`

Body:
```json
{"provider":"openai","model":"gpt-4o-mini","messages":[{"role":"user","content":"Halo"}]}
```

API key dibuat dari dashboard dan secret hanya muncul sekali. Simpan secret itu di aplikasi pemanggil.

## Monitoring
- `MONITOR_TARGETS`: URL health/status HTTP(S), dipisah koma. Dashboard mengukur HTTP latency; bukan ICMP.
- Untuk CPU/RAM/disk/uptime, set `VPS_AGENT_TOKEN` sama di Vercel dan environment VPS. Jalankan `scripts/vps-agent.sh` berkala (mis. cron setiap menit):
```bash
export KENZZ_API_URL="https://DOMAIN-VERCEL-ATAU-DOMAIN-KAMU"
export VPS_AGENT_TOKEN="TOKEN_YANG_SAMA_DENGAN_VERCEL"
/path/ke/scripts/vps-agent.sh
```
Contoh cron: `* * * * * KENZZ_API_URL=https://domain VPS_AGENT_TOKEN=token /path/vps-agent.sh >/dev/null 2>&1`. Lindungi token dan jangan memasukkannya ke repository publik.

## Security / batasan
- Service role dan provider keys hanya server-side.
- RLS diaktifkan tanpa policy anon luas; backend memakai service role setelah memverifikasi session atau agent token.
- HTTP ping hanya untuk URL yang kamu kendalikan/percaya. Jangan masukkan URL internal/private network; server-side URL checks harus diperketat sesuai kebutuhan produksi.
- Ini starter fungsional, belum termasuk billing, payment, alerting, multi-region, atau hardening audit produksi. Uji di staging sebelum mengganti deployment aktif.
