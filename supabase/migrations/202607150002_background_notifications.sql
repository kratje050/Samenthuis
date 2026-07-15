-- Samen Thuis 3.0.1 – Web Push voor gesloten Android-, iPhone- en PWA-installaties.
-- Niet-destructief en veilig opnieuw uit te voeren na 202607150001_assistant_modules.sql.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.push_configuration (
  id smallint primary key check (id = 1),
  public_key text,
  private_key text,
  cron_secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  updated_at timestamptz not null default now()
);

insert into public.push_configuration (id) values (1) on conflict (id) do nothing;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  timezone text not null default 'Europe/Amsterdam',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_family_idx
  on public.push_subscriptions (family_id) where active;
create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id) where active;

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  record_id uuid not null,
  occurrence_date date not null,
  reminder_minutes integer not null,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  attempts integer not null default 1,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, record_id, occurrence_date, reminder_minutes)
);

alter table public.push_configuration enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_log enable row level security;

revoke all on public.push_configuration, public.push_subscriptions, public.push_delivery_log from anon, authenticated;
grant all on public.push_configuration, public.push_subscriptions, public.push_delivery_log to service_role;

-- De Edge Function controleert zelf gebruikerssessies. De croncode blijft uitsluitend
-- in deze afgeschermde tabel en wordt nooit naar de browser gestuurd.
do $schedule$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'samen-thuis-reminders' limit 1;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  perform cron.schedule(
    'samen-thuis-reminders',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://idzfbonwkkqaqnzubmxg.supabase.co/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'sb_publishable_JT8fyOu93Dke7D_NlbzbCw_GsGbUPtO',
          'x-cron-secret', (select cron_secret from public.push_configuration where id = 1)
        ),
        body := jsonb_build_object('action', 'send_due'),
        timeout_milliseconds := 25000
      );
    $job$
  );
end
$schedule$;
