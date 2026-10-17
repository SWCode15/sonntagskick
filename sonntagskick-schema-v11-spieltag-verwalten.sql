-- Sonntagskick v11: Spieltag "nicht stattgefunden" / "nicht gewertet" + Spieltag löschen.
-- Mehrfach ausführbar.

begin;

-- 1. Neue Spalten in match_days
--    excluded_type: 'not_played' = Spieltag hat nicht stattgefunden
--                   'not_rated'  = wurde gespielt, zählt aber nicht für die Wertung
alter table public.match_days
  add column if not exists excluded_type   text,
  add column if not exists excluded_reason text,
  add column if not exists excluded_at     timestamptz;

alter table public.match_days
  drop constraint if exists match_days_excluded_type_check;
alter table public.match_days
  add constraint match_days_excluded_type_check
  check (excluded_type is null or excluded_type in ('not_played', 'not_rated'));

-- Entweder alles leer, oder Art + Begründung (nicht leer) + Zeitpunkt gesetzt
alter table public.match_days
  drop constraint if exists match_days_excluded_check;
alter table public.match_days
  add constraint match_days_excluded_check
  check (
    (excluded_type is null and excluded_reason is null and excluded_at is null)
    or
    (excluded_type is not null
     and excluded_reason is not null
     and btrim(excluded_reason) <> ''
     and excluded_at is not null)
  );

-- 2. Das Konto "Eintragen" darf bei ausgeschlossenen Spieltagen nichts mehr ändern
create or replace function public.can_edit_match_day(p_match_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_writer()
      and exists (
        select 1 from public.match_days m
        where m.id = p_match_day_id
          and m.entry_locked = false
          and m.excluded_type is null
          and m.play_date = (now() at time zone 'Europe/Vienna')::date
      )
    );
$$;

-- 3. Spieltag löschen (nur Admin, nur wenn noch nicht gestartet und ohne Spiele)
create or replace function public.delete_match_day(p_match_day_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started timestamptz;
  v_games int;
  v_present int;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen Spieltage löschen.';
  end if;

  select started_at into v_started from public.match_days where id = p_match_day_id;
  if not found then
    raise exception 'Spieltag nicht gefunden.';
  end if;
  if v_started is not null then
    raise exception 'Dieser Spieltag wurde schon gestartet. Bitte „nicht gewertet“ oder „nicht stattgefunden“ verwenden.';
  end if;

  select count(*) into v_games from public.games where match_day_id = p_match_day_id;
  if v_games > 0 then
    raise exception 'Zu diesem Spieltag gibt es schon Spiele. Bitte „nicht gewertet“ verwenden.';
  end if;

  select count(*) into v_present from public.match_day_players where match_day_id = p_match_day_id;

  -- Teams, Anwesenheit und Zuordnungen hängen per "cascade" am Spieltag
  delete from public.match_days where id = p_match_day_id;

  return jsonb_build_object('deleted', true, 'present_removed', v_present);
end;
$$;

revoke all on function public.delete_match_day(uuid) from public, anon;
grant execute on function public.delete_match_day(uuid) to authenticated;

commit;

-- Kontrolle: 3 Spalten und die Funktion müssen erscheinen
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'match_days'
      and column_name in ('excluded_type', 'excluded_reason', 'excluded_at')) as spalten,
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'delete_match_day') as funktion;
