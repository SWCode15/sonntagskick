-- ============================================================
-- Sonntagskick – Spieltag starten und Zuordnung sperren (Schema v5)
-- Stand: 14.10.2026
--
-- Voraussetzung: sonntagskick-schema-v4-auth.sql wurde ausgeführt.
--
-- Was das Skript macht:
--   * match_days bekommt "started_at" (leer = nicht gestartet).
--   * Funktion start_match_day(): startet einen Spieltag
--     (für alle Angemeldeten, setzt nur den Zeitstempel).
--   * Nach dem Start dürfen Anwesenheit und Teamzuordnung nur noch
--     Admins ändern (Regeln "Admin all ..." aus v4 bleiben gültig).
--   * Spiele lassen sich nur für gestartete Spieltage anlegen.
--   * Bereits vorhandene Spieltage mit Spielen (Testdaten) gelten
--     als gestartet, damit sie weiter angezeigt werden können.
--
-- Eine Transaktion: bei einem Fehler wird NICHTS geändert.
-- Im SQL Editor: einfügen, Run, bei der Warnung "Run query".
-- ============================================================

begin;

-- 1. Neues Feld
alter table public.match_days
  add column if not exists started_at timestamptz;

-- Bestehende Spieltage, die schon Spiele haben, gelten als gestartet
update public.match_days m
   set started_at = now()
 where m.started_at is null
   and exists (select 1 from public.games g where g.match_day_id = m.id);

-- 2. Spieltag starten (nur dieser eine Schritt, kein freies UPDATE)
create or replace function public.start_match_day(p_match_day_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.match_days
     set started_at = now()
   where id = p_match_day_id
     and started_at is null;
  if not found then
    raise exception 'Spieltag nicht gefunden oder bereits gestartet';
  end if;
end;
$$;

revoke all on function public.start_match_day(uuid) from public;
revoke execute on function public.start_match_day(uuid) from anon;
grant execute on function public.start_match_day(uuid) to authenticated;

-- 3. Alte Regeln für Anwesenheit, Teamzuordnung, Spiele-Anlegen ersetzen
drop policy if exists "Auth insert match_day_players" on public.match_day_players;
drop policy if exists "Auth delete match_day_players" on public.match_day_players;
drop policy if exists "Auth insert team_players" on public.team_players;
drop policy if exists "Auth delete team_players" on public.team_players;
drop policy if exists "Auth insert games" on public.games;

-- Anwesenheit: nur solange der Spieltag nicht gestartet ist
create policy "Auth insert match_day_players" on public.match_day_players
  for insert to authenticated
  with check (exists (
    select 1 from public.match_days m
    where m.id = match_day_players.match_day_id and m.started_at is null
  ));
create policy "Auth delete match_day_players" on public.match_day_players
  for delete to authenticated
  using (exists (
    select 1 from public.match_days m
    where m.id = match_day_players.match_day_id and m.started_at is null
  ));

-- Teamzuordnung: nur solange der Spieltag nicht gestartet ist
create policy "Auth insert team_players" on public.team_players
  for insert to authenticated
  with check (exists (
    select 1
    from public.teams t
    join public.match_days m on m.id = t.match_day_id
    where t.id = team_players.team_id and m.started_at is null
  ));
create policy "Auth delete team_players" on public.team_players
  for delete to authenticated
  using (exists (
    select 1
    from public.teams t
    join public.match_days m on m.id = t.match_day_id
    where t.id = team_players.team_id and m.started_at is null
  ));

-- Spiele anlegen: nur wenn der Spieltag gestartet ist
create policy "Auth insert games" on public.games
  for insert to authenticated
  with check (exists (
    select 1 from public.match_days m
    where m.id = games.match_day_id and m.started_at is not null
  ));

commit;
