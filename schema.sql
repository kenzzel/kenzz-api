-- Kenzz API database schema
-- Jalankan sekali di Supabase -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('owner','user')),
  status text not null default 'active' check (status in ('active','blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Untitled key',
  key_hash text not null unique,
  key_prefix text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  requests_count bigint not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.api_services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.api_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requests_per_minute integer not null default 30 check (requests_per_minute > 0),
  monthly_request_limit bigint,
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  api_key_id uuid references public.api_keys(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  model text not null,
  status_code integer not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  latency_ms integer,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.api_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_usage_user_created_idx on public.api_usage(user_id, created_at desc);
create index if not exists api_usage_key_created_idx on public.api_usage(api_key_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_services enable row level security;
alter table public.api_limits enable row level security;
alter table public.api_usage enable row level security;
alter table public.api_logs enable row level security;

-- Frontend tidak diberi policy untuk membaca key. Semua operasi key melalui
-- Vercel API menggunakan service role setelah verifikasi Owner.
-- service_role melewati RLS; jangan pernah masukkan key ini ke frontend.

insert into public.api_services (slug, name, description)
values
 ('chat-completions', 'Chat Completions', 'OpenAI-compatible chat completion gateway'),
 ('health', 'Health Check', 'Kenzz API status endpoint')
on conflict (slug) do nothing;
