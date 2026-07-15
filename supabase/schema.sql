-- Samen Thuis 1.3.0 - centrale gezinsopslag en Web Push voor Supabase
-- Voer dit volledige bestand één keer uit in de Supabase SQL Editor.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  invite_code_hash text,
  invite_expires_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

create table if not exists public.family_records (
  family_id uuid not null references public.families(id) on delete cascade,
  entity_type text not null check (entity_type in ('appointment', 'shopping', 'task', 'meal', 'inventory', 'expense', 'pet', 'outing', 'settings', 'activity', 'template')),
  record_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  version bigint not null check (version > 0),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text not null,
  updated_by uuid references auth.users(id) on delete set null,
  server_updated_at timestamptz not null default now(),
  primary key (family_id, entity_type, record_id)
);

alter table public.family_records drop constraint if exists family_records_entity_type_check;
alter table public.family_records add constraint family_records_entity_type_check
  check (entity_type in ('appointment', 'shopping', 'task', 'meal', 'inventory', 'expense', 'pet', 'outing', 'settings', 'activity', 'template'));

create index if not exists family_records_family_updated_idx on public.family_records (family_id, server_updated_at);
create index if not exists family_records_family_entity_idx on public.family_records (family_id, entity_type);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_records enable row level security;

create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = auth.uid()
  );
$$;

drop policy if exists "family members can read family" on public.families;
create policy "family members can read family" on public.families
  for select to authenticated using (public.is_family_member(id));

drop policy if exists "family members can read memberships" on public.family_members;
create policy "family members can read memberships" on public.family_members
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "family members can read records" on public.family_records;
create policy "family members can read records" on public.family_records
  for select to authenticated using (public.is_family_member(family_id));

create or replace function public.get_my_family_context()
returns table (family_id uuid, family_name text, role text, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.name, fm.role, fm.display_name, f.created_at
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where fm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.create_family(p_name text, p_display_name text)
returns table (family_id uuid, family_name text, invite_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_family_id uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Log eerst in.'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'Dit account is al aan een gezin gekoppeld.';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Vul een geldige gezinsnaam in.'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) < 1 then raise exception 'Vul je naam in.'; end if;

  v_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10));
  insert into public.families (name, invite_code_hash, invite_expires_at, created_by)
  values (trim(p_name), encode(digest(v_code, 'sha256'), 'hex'), now() + interval '7 days', auth.uid())
  returning id into v_family_id;

  insert into public.family_members (family_id, user_id, display_name, role)
  values (v_family_id, auth.uid(), trim(p_display_name), 'owner');

  return query select v_family_id, trim(p_name), v_code;
end;
$$;

create or replace function public.join_family(p_invite_code text, p_display_name text)
returns table (family_id uuid, family_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_family public.families%rowtype;
  v_hash text;
begin
  if auth.uid() is null then raise exception 'Log eerst in.'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'Dit account is al aan een gezin gekoppeld.';
  end if;
  if char_length(trim(coalesce(p_display_name, ''))) < 1 then raise exception 'Vul je naam in.'; end if;
  v_hash := encode(digest(upper(trim(coalesce(p_invite_code, ''))), 'sha256'), 'hex');

  select * into v_family from public.families
  where invite_code_hash = v_hash and invite_expires_at > now()
  for update;
  if v_family.id is null then raise exception 'De uitnodigingscode is ongeldig of verlopen.'; end if;

  insert into public.family_members (family_id, user_id, display_name, role)
  values (v_family.id, auth.uid(), trim(p_display_name), 'member');
  update public.families set invite_code_hash = null, invite_expires_at = null, updated_at = now() where id = v_family.id;

  return query select v_family.id, v_family.name;
end;
$$;

create or replace function public.regenerate_family_invite()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_family_id uuid;
  v_code text;
begin
  select family_id into v_family_id from public.family_members where user_id = auth.uid() and role = 'owner';
  if v_family_id is null then raise exception 'Alleen de beheerder kan een uitnodigingscode maken.'; end if;
  v_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 10));
  update public.families
  set invite_code_hash = encode(digest(v_code, 'sha256'), 'hex'), invite_expires_at = now() + interval '7 days', updated_at = now()
  where id = v_family_id;
  return v_code;
end;
$$;

create or replace function public.sync_family_record(
  p_entity_type text,
  p_record_id uuid,
  p_payload jsonb,
  p_version bigint,
  p_updated_at timestamptz,
  p_deleted_at timestamptz,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_existing public.family_records%rowtype;
  v_result public.family_records%rowtype;
  v_payload jsonb;
  v_conflict boolean := false;
  v_apply boolean := false;
begin
  select family_id into v_family_id from public.family_members where user_id = auth.uid();
  if v_family_id is null then raise exception 'Koppel eerst een gezin.'; end if;
  if p_entity_type not in ('appointment', 'shopping', 'task', 'meal', 'inventory', 'expense', 'pet', 'outing', 'settings', 'activity', 'template') then
    raise exception 'Onbekend gegevenstype.';
  end if;
  if p_version < 1 or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Ongeldig synchronisatierecord.';
  end if;

  v_payload := p_payload || jsonb_build_object(
    'id', p_record_id,
    'version', p_version,
    'updatedAt', p_updated_at,
    'deletedAt', p_deleted_at,
    'deviceId', p_device_id,
    'updatedBy', auth.uid()::text,
    'syncStatus', 'synced'
  );

  select * into v_existing from public.family_records
  where family_id = v_family_id and entity_type = p_entity_type and record_id = p_record_id
  for update;

  if v_existing.record_id is null then
    insert into public.family_records (family_id, entity_type, record_id, payload, version, updated_at, deleted_at, device_id, updated_by)
    values (v_family_id, p_entity_type, p_record_id, v_payload, p_version, p_updated_at, p_deleted_at, p_device_id, auth.uid())
    returning * into v_result;
    v_apply := true;
  else
    if p_version > v_existing.version then
      v_apply := true;
    elsif p_version = v_existing.version and v_payload = v_existing.payload then
      v_apply := false;
    elsif p_version = v_existing.version then
      v_conflict := true;
      v_apply := p_updated_at > v_existing.updated_at;
    else
      v_conflict := true;
      v_apply := false;
    end if;

    if v_apply then
      update public.family_records set
        payload = v_payload, version = p_version, updated_at = p_updated_at,
        deleted_at = p_deleted_at, device_id = p_device_id, updated_by = auth.uid(), server_updated_at = now()
      where family_id = v_family_id and entity_type = p_entity_type and record_id = p_record_id
      returning * into v_result;
    else
      v_result := v_existing;
    end if;
  end if;

  return jsonb_build_object(
    'applied', v_apply,
    'conflict', v_conflict,
    'entity_type', v_result.entity_type,
    'record_id', v_result.record_id,
    'payload', v_result.payload,
    'version', v_result.version,
    'updated_at', v_result.updated_at,
    'deleted_at', v_result.deleted_at,
    'device_id', v_result.device_id
  );
end;
$$;

revoke all on public.families, public.family_members, public.family_records from anon;
revoke insert, update, delete on public.families, public.family_members, public.family_records from authenticated;
grant select on public.families, public.family_members, public.family_records to authenticated;

revoke execute on function public.is_family_member(uuid) from public, anon;
revoke execute on function public.get_my_family_context() from public, anon;
revoke execute on function public.create_family(text, text) from public, anon;
revoke execute on function public.join_family(text, text) from public, anon;
revoke execute on function public.regenerate_family_invite() from public, anon;
revoke execute on function public.sync_family_record(text, uuid, jsonb, bigint, timestamptz, timestamptz, text) from public, anon;

grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.get_my_family_context() to authenticated;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
grant execute on function public.regenerate_family_invite() to authenticated;
grant execute on function public.sync_family_record(text, uuid, jsonb, bigint, timestamptz, timestamptz, text) to authenticated;

-- Web Push. Sleutels worden bij het eerste gebruik binnen de Edge Function gegenereerd.
-- De privésleutel en croncode zijn nooit leesbaar voor browsergebruikers.
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

create index if not exists push_subscriptions_family_idx on public.push_subscriptions (family_id) where active;

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

-- Supabase Cron roept de herinneringsfunctie iedere minuut aan. De geheime code
-- komt rechtstreeks uit de afgeschermde tabel en verschijnt niet in de app.
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
