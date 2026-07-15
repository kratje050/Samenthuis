-- Samen Thuis 3.0.0 – uitbreidende, niet-destructieve gezinsassistentmigratie.
-- Veilig opnieuw uit te voeren. Bestaande tabellen en records blijven behouden.

alter table public.family_records
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.family_records drop constraint if exists family_records_entity_type_check;
alter table public.family_records add constraint family_records_entity_type_check check (entity_type in (
  'appointment', 'shopping', 'task', 'meal', 'inventory', 'expense', 'pet', 'outing',
  'settings', 'activity', 'template', 'notice', 'inbox', 'packing', 'child', 'routine',
  'family_mode', 'maintenance', 'appliance', 'storage_location', 'loan', 'gift', 'waste',
  'babysitting', 'emergency', 'subscription', 'savings_goal', 'price_history', 'visit_plan',
  'decision_wheel', 'reward', 'family_memory', 'bucket_list', 'home_project', 'history', 'file'
));

create index if not exists family_records_family_cursor_idx
  on public.family_records (family_id, server_updated_at, entity_type, record_id);

create or replace function public.can_read_family_record(
  p_family_id uuid,
  p_entity_type text,
  p_payload jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_family_member(p_family_id)
    and (
      p_entity_type <> 'gift'
      or not (coalesce(p_payload->'hiddenForUserIds', '[]'::jsonb) ? auth.uid()::text)
    );
$$;

drop policy if exists "family members can read records" on public.family_records;
drop policy if exists "family members can read permitted records" on public.family_records;
create policy "family members can read permitted records" on public.family_records
  for select to authenticated
  using (public.can_read_family_record(family_id, entity_type, payload));

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
  v_created_at timestamptz;
begin
  select family_id into v_family_id from public.family_members where user_id = auth.uid();
  if v_family_id is null then raise exception 'Koppel eerst een gezin.'; end if;
  if p_entity_type not in (
    'appointment', 'shopping', 'task', 'meal', 'inventory', 'expense', 'pet', 'outing',
    'settings', 'activity', 'template', 'notice', 'inbox', 'packing', 'child', 'routine',
    'family_mode', 'maintenance', 'appliance', 'storage_location', 'loan', 'gift', 'waste',
    'babysitting', 'emergency', 'subscription', 'savings_goal', 'price_history', 'visit_plan',
    'decision_wheel', 'reward', 'family_memory', 'bucket_list', 'home_project', 'history', 'file'
  ) then raise exception 'Onbekend gegevenstype.'; end if;
  if p_version < 1 or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Ongeldig synchronisatierecord.';
  end if;
  if p_entity_type = 'gift' and (coalesce(p_payload->'hiddenForUserIds', '[]'::jsonb) ? auth.uid()::text) then
    raise exception 'Een cadeau kan niet voor de maker zelf worden verborgen.';
  end if;

  begin
    v_created_at := coalesce((p_payload->>'createdAt')::timestamptz, p_updated_at, now());
  exception when others then
    v_created_at := coalesce(p_updated_at, now());
  end;

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

  if v_existing.record_id is not null and p_entity_type = 'gift'
     and (coalesce(v_existing.payload->'hiddenForUserIds', '[]'::jsonb) ? auth.uid()::text) then
    raise exception 'Je hebt geen toegang tot dit cadeau.';
  end if;

  if p_payload ? 'purgedAt' then
    delete from public.family_records
      where family_id = v_family_id and entity_type = p_entity_type and record_id = p_record_id;
    return jsonb_build_object(
      'applied', true, 'conflict', false, 'entity_type', p_entity_type,
      'record_id', p_record_id, 'payload', p_payload, 'version', p_version,
      'updated_at', p_updated_at, 'deleted_at', p_deleted_at,
      'device_id', p_device_id, 'server_updated_at', now()
    );
  end if;

  if v_existing.record_id is null then
    insert into public.family_records (
      family_id, entity_type, record_id, payload, version, created_at, updated_at,
      deleted_at, device_id, created_by, updated_by
    ) values (
      v_family_id, p_entity_type, p_record_id, v_payload, p_version, v_created_at,
      p_updated_at, p_deleted_at, p_device_id, auth.uid(), auth.uid()
    ) returning * into v_result;
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
        payload = v_payload,
        version = p_version,
        updated_at = p_updated_at,
        deleted_at = p_deleted_at,
        device_id = p_device_id,
        updated_by = auth.uid(),
        server_updated_at = now()
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
    'created_at', v_result.created_at,
    'updated_at', v_result.updated_at,
    'deleted_at', v_result.deleted_at,
    'device_id', v_result.device_id,
    'server_updated_at', v_result.server_updated_at
  );
end;
$$;

revoke execute on function public.can_read_family_record(uuid, text, jsonb) from public, anon;
grant execute on function public.can_read_family_record(uuid, text, jsonb) to authenticated;
revoke execute on function public.sync_family_record(text, uuid, jsonb, bigint, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.sync_family_record(text, uuid, jsonb, bigint, timestamptz, timestamptz, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'samen-thuis-private',
  'samen-thuis-private',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','application/pdf','text/plain']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_family_file(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parts text[];
  v_family_id uuid;
  v_record_id uuid;
  v_record public.family_records%rowtype;
begin
  v_parts := string_to_array(p_name, '/');
  if array_length(v_parts, 1) < 4 or v_parts[1] !~* '^[0-9a-f-]{36}$' then return false; end if;
  v_family_id := v_parts[1]::uuid;
  if not public.is_family_member(v_family_id) then return false; end if;
  if v_parts[2] <> 'gift' then return true; end if;
  if v_parts[3] !~* '^[0-9a-f-]{36}$' then return false; end if;
  v_record_id := v_parts[3]::uuid;
  select * into v_record from public.family_records
    where family_id = v_family_id and entity_type = 'gift' and record_id = v_record_id;
  return v_record.record_id is not null
    and not (coalesce(v_record.payload->'hiddenForUserIds', '[]'::jsonb) ? auth.uid()::text);
exception when others then
  return false;
end;
$$;

revoke execute on function public.can_access_family_file(text) from public, anon;
grant execute on function public.can_access_family_file(text) to authenticated;

drop policy if exists "family members read private files" on storage.objects;
drop policy if exists "family members upload private files" on storage.objects;
drop policy if exists "family members update private files" on storage.objects;
drop policy if exists "family members delete private files" on storage.objects;

create policy "family members read private files" on storage.objects
  for select to authenticated
  using (bucket_id = 'samen-thuis-private' and public.can_access_family_file(name));

create policy "family members upload private files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'samen-thuis-private' and public.can_access_family_file(name));

create policy "family members update private files" on storage.objects
  for update to authenticated
  using (bucket_id = 'samen-thuis-private' and public.can_access_family_file(name))
  with check (bucket_id = 'samen-thuis-private' and public.can_access_family_file(name));

create policy "family members delete private files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'samen-thuis-private' and public.can_access_family_file(name));

do $realtime$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'create publication supabase_realtime';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'family_records'
  ) then
    execute 'alter publication supabase_realtime add table public.family_records';
  end if;
end
$realtime$;
