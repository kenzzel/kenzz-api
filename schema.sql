-- KENZZ API v2 schema. Run this in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('owner','user')),
  status text not null default 'active' check (status in ('active','blocked')),
  created_at timestamptz not null default now()
);

create or replace function public.kenzz_new_profile()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,display_name,role,status)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name',''), 'user','active')
  on conflict(id) do nothing;
  insert into public.api_limits(user_id,requests_per_minute,monthly_request_limit)
  values(new.id,30,10000) on conflict(user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists kenzz_auth_user_created on auth.users;
create trigger kenzz_auth_user_created after insert on auth.users
for each row execute procedure public.kenzz_new_profile();

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'My API Key',
  key_hash text not null unique,
  key_prefix text not null,
  status text not null default 'active' check(status in ('active','revoked')),
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
  user_id uuid primary key references auth.users(id) on delete cascade,
  requests_per_minute integer not null default 30 check(requests_per_minute between 1 and 600),
  monthly_request_limit bigint default 10000,
  created_at timestamptz not null default now()
);

-- Backfill profiles and default quotas for accounts created before this schema was installed.
insert into public.profiles(id,display_name,role,status)
select id, coalesce(raw_user_meta_data->>'display_name',''), 'user', 'active'
from auth.users
on conflict(id) do nothing;

insert into public.api_limits(user_id,requests_per_minute,monthly_request_limit)
select id,30,10000 from auth.users
on conflict(user_id) do nothing;

create table if not exists public.api_rate_windows (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
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

create index if not exists api_keys_user_idx on public.api_keys(user_id);
create index if not exists api_usage_user_time_idx on public.api_usage(user_id,created_at desc);
create index if not exists api_usage_key_time_idx on public.api_usage(api_key_id,created_at desc);

create or replace function public.kenzz_consume_request(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare lim public.api_limits%rowtype;
declare win public.api_rate_windows%rowtype;
declare used_month bigint;
declare now_ts timestamptz := now();
begin
  select * into lim from public.api_limits where user_id=p_user_id;
  if not found then
    insert into public.api_limits(user_id) values(p_user_id)
    on conflict(user_id) do nothing;
    select * into lim from public.api_limits where user_id=p_user_id;
  end if;

  select count(*) into used_month from public.api_usage
  where user_id=p_user_id and created_at >= date_trunc('month',now_ts);

  if lim.monthly_request_limit is not null and used_month >= lim.monthly_request_limit then
    return jsonb_build_object('allowed',false,'reason','Monthly request quota exceeded','retry_after',3600);
  end if;

  insert into public.api_rate_windows(user_id,window_started_at,request_count)
  values(p_user_id,now_ts,1)
  on conflict(user_id) do update set
    window_started_at=case when public.api_rate_windows.window_started_at < now_ts - interval '1 minute' then now_ts else public.api_rate_windows.window_started_at end,
    request_count=case when public.api_rate_windows.window_started_at < now_ts - interval '1 minute' then 1 else public.api_rate_windows.request_count+1 end
  returning * into win;

  if win.request_count > lim.requests_per_minute then
    return jsonb_build_object('allowed',false,'reason','Rate limit exceeded','retry_after',greatest(1,60-extract(epoch from (now_ts-win.window_started_at))::int));
  end if;
  return jsonb_build_object('allowed',true,'remaining',greatest(0,lim.requests_per_minute-win.request_count));
end;
$$;

alter table public.profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_services enable row level security;
alter table public.api_limits enable row level security;
alter table public.api_rate_windows enable row level security;
alter table public.api_usage enable row level security;
alter table public.api_logs enable row level security;

-- All sensitive reads/writes go through server functions with service_role.
-- Do not create broad anon policies. Never expose service_role to the browser.

insert into public.api_services(slug,name,description) values
('chat-completions','Chat Completions','OpenAI-compatible chat completion gateway'),
('health','Health Check','Kenzz API health endpoint')
on conflict(slug) do nothing;


-- VPS agent metrics (service-role only; no public policies).
create table if not exists public.vps_metrics (
 id bigint generated always as identity primary key, hostname text not null, cpu_percent numeric not null,
 ram_used_mb numeric not null, ram_total_mb numeric not null, disk_used_percent numeric not null,
 uptime_seconds numeric not null, created_at timestamptz not null default now()
);
create index if not exists vps_metrics_created_idx on public.vps_metrics(created_at desc);
alter table public.vps_metrics enable row level security;
