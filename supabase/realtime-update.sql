-- Samen Thuis: schakel directe gezinsupdates in voor een bestaand project.
-- Dit script is veilig opnieuw uit te voeren.
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
