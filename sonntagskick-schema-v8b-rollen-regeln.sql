-- ============================================================
-- Sonntagskick – Rollen scharf schalten (Schema v8b)
-- Stand: 16.10.2026
--
-- Voraussetzung: v4 bis v7 und v8a sind ausgeführt, die App mit
-- den Rollen ist veröffentlicht, das Konto "eintragen" ist
-- angelegt und in der Tabelle "writers" eingetragen.
--
-- Ab jetzt gilt (Rolle "authenticated"):
--   * Leser (alle Angemeldeten ohne Eintrag in admins/writers):
--     dürfen nur LESEN, nichts anlegen, ändern oder löschen.
--   * Eintragen ("writers"): am Tag des Spieltags (Datum in Wien) und
--     nur wenn der Spieltag nicht gesperrt ist: Spieler anlegen,
--     Anwesenheit/Teamzuordnung (bis zum Start), Spieltag starten und
--     beenden, erstes Spiel, restliche Spiele, Tore zählen, Spiele
--     beenden, Gleichstand entscheiden.
--   * Admins: wie bisher alles ("Admin all ..." Regeln bleiben).
--   * Neue Spieltage und Teams legen nur noch Admins an.
--
-- Eine Transaktion: bei einem Fehler wird NICHTS geändert.
-- Mehrfach ausführbar.
-- Im SQL Editor: Editor leeren, einfügen, Run, bei Warnung "Run query".
-- Notfall: sonntagskick-schema-v8b-zurueck.sql
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Spieler anlegen: nur Admin (immer) oder Eintragen am Spieltag
-- ------------------------------------------------------------
drop policy if exists "Auth insert players" on public.players;
drop policy if exists "Writer insert players" on public.players;
create policy "Writer insert players" on public.players
  for insert to authenticated
  with check (public.can_write_today());

drop policy if exists "Auth insert season_players" on public.season_players;
drop policy if exists "Writer insert season_players" on public.season_players;
create policy "Writer insert season_players" on public.season_players
  for insert to authenticated
  with check (public.can_write_today());

-- ------------------------------------------------------------
-- 2. Spieltage und Teams anlegen: nur Admins ("Admin all ..." gilt)
-- ------------------------------------------------------------
drop policy if exists "Auth insert match_days" on public.match_days;
drop policy if exists "Auth insert teams" on public.teams;

-- ------------------------------------------------------------
-- 3. Anwesenheit: bis zum Start, nur wer bei diesem Spieltag eintragen darf
-- ------------------------------------------------------------
drop policy if exists "Auth insert match_day_players" on public.match_day_players;
drop policy if exists "Auth delete match_day_players" on public.match_day_players;

create policy "Auth insert match_day_players" on public.match_day_players
  for insert to authenticated
  with check (
    public.can_edit_match_day(match_day_players.match_day_id)
    and exists (
      select 1 from public.match_days m
      where m.id = match_day_players.match_day_id and m.started_at is null
    )
  );
create policy "Auth delete match_day_players" on public.match_day_players
  for delete to authenticated
  using (
    public.can_edit_match_day(match_day_players.match_day_id)
    and exists (
      select 1 from public.match_days m
      where m.id = match_day_players.match_day_id and m.started_at is null
    )
  );

-- ------------------------------------------------------------
-- 4. Teamzuordnung: bis zum Start, nur wer bei diesem Spieltag eintragen darf
-- ------------------------------------------------------------
drop policy if exists "Auth insert team_players" on public.team_players;
drop policy if exists "Auth delete team_players" on public.team_players;

create policy "Auth insert team_players" on public.team_players
  for insert to authenticated
  with check (exists (
    select 1
    from public.teams t
    join public.match_days m on m.id = t.match_day_id
    where t.id = team_players.team_id
      and m.started_at is null
      and public.can_edit_match_day(t.match_day_id)
  ));
create policy "Auth delete team_players" on public.team_players
  for delete to authenticated
  using (exists (
    select 1
    from public.teams t
    join public.match_days m on m.id = t.match_day_id
    where t.id = team_players.team_id
      and m.started_at is null
      and public.can_edit_match_day(t.match_day_id)
  ));

-- ------------------------------------------------------------
-- 5. Gleichstand-Entscheidung: nur bei beendetem Spieltag und nur
--    wer bei diesem Spieltag eintragen darf
-- ------------------------------------------------------------
drop policy if exists "Auth insert match_day_awards" on public.match_day_awards;
create policy "Auth insert match_day_awards" on public.match_day_awards
  for insert to authenticated
  with check (
    public.can_edit_match_day(match_day_awards.match_day_id)
    and exists (
      select 1 from public.match_days m
      where m.id = match_day_awards.match_day_id
        and m.finished_at is not null
    )
  );

-- ------------------------------------------------------------
-- 6. Funktionen: Berechtigung prüfen
-- ------------------------------------------------------------

-- Tore zählen
create or replace function public.change_goal(
  p_game_id uuid, p_side text, p_delta int
)
returns table (new_a smallint, new_b smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_md uuid;
begin
  if p_side not in ('a', 'b') then
    raise exception 'Ungueltige Seite';
  end if;
  if p_delta not in (1, -1) then
    raise exception 'Ungueltige Aenderung';
  end if;

  select g.match_day_id into v_md from games g where g.id = p_game_id;
  if v_md is null then
    raise exception 'Spiel nicht gefunden';
  end if;
  if not public.can_edit_match_day(v_md) then
    raise exception 'Keine Berechtigung zum Eintragen';
  end if;

  if p_side = 'a' then
    update games g
       set goals_team_a = greatest(g.goals_team_a + p_delta, 0)
     where g.id = p_game_id and g.finished = false;
  else
    update games g
       set goals_team_b = greatest(g.goals_team_b + p_delta, 0)
     where g.id = p_game_id and g.finished = false;
  end if;

  if not found then
    raise exception 'Spiel nicht gefunden oder bereits beendet';
  end if;

  return query
    select g.goals_team_a, g.goals_team_b from games g where g.id = p_game_id;
end;
$$;

-- Spiel beenden
create or replace function public.finish_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_md uuid;
begin
  select g.match_day_id into v_md from games g where g.id = p_game_id;
  if v_md is null then
    raise exception 'Spiel nicht gefunden';
  end if;
  if not public.can_edit_match_day(v_md) then
    raise exception 'Keine Berechtigung zum Eintragen';
  end if;

  update games set finished = true where id = p_game_id;
  if not found then
    raise exception 'Spiel nicht gefunden';
  end if;
end;
$$;

-- Spieltag starten
create or replace function public.start_match_day(p_match_day_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_match_day(p_match_day_id) then
    raise exception 'Keine Berechtigung zum Eintragen';
  end if;

  update public.match_days
     set started_at = now()
   where id = p_match_day_id
     and started_at is null;
  if not found then
    raise exception 'Spieltag nicht gefunden oder bereits gestartet';
  end if;
end;
$$;

-- Erstes Spiel anlegen
create or replace function public.create_first_game(
  p_match_day_id uuid,
  p_team_a uuid,
  p_team_b uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started   timestamptz;
  v_finished  timestamptz;
  v_team_ids  uuid[];
begin
  if not public.can_edit_match_day(p_match_day_id) then
    raise exception 'Keine Berechtigung zum Eintragen';
  end if;

  select started_at, finished_at
    into v_started, v_finished
    from public.match_days
   where id = p_match_day_id;
  if not found then
    raise exception 'Spieltag nicht gefunden';
  end if;
  if v_started is null then
    raise exception 'Der Spieltag ist noch nicht gestartet';
  end if;
  if v_finished is not null then
    raise exception 'Der Spieltag ist bereits beendet';
  end if;
  if exists (select 1 from public.games where match_day_id = p_match_day_id) then
    raise exception 'Für diesen Spieltag gibt es schon Spiele';
  end if;

  select array_agg(id) into v_team_ids
    from public.teams
   where match_day_id = p_match_day_id;
  if coalesce(array_length(v_team_ids, 1), 0) <> 3 then
    raise exception 'Nur für Spieltage mit 3 Teams';
  end if;
  if p_team_a = p_team_b
     or not (p_team_a = any (v_team_ids))
     or not (p_team_b = any (v_team_ids)) then
    raise exception 'Ungültige Teams';
  end if;

  insert into public.games
    (match_day_id, game_number, round_number, team_a_id, team_b_id)
  values
    (p_match_day_id, 1, 1, p_team_a, p_team_b);
end;
$$;

-- Restliche Spiele anlegen (nach dem ersten Spiel)
create or replace function public.create_remaining_games(
  p_match_day_id uuid,
  p_stayer uuid,
  p_rounds int default 4
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started   timestamptz;
  v_finished  timestamptz;
  v_first     public.games%rowtype;
  v_count     int;
  v_third     uuid;
  v_other     uuid;
  v_round     int;
  v_base      int;
  v_created   int := 0;
begin
  if not public.can_edit_match_day(p_match_day_id) then
    raise exception 'Keine Berechtigung zum Eintragen';
  end if;

  select started_at, finished_at
    into v_started, v_finished
    from public.match_days
   where id = p_match_day_id;
  if not found then
    raise exception 'Spieltag nicht gefunden';
  end if;
  if v_started is null then
    raise exception 'Der Spieltag ist noch nicht gestartet';
  end if;
  if v_finished is not null then
    raise exception 'Der Spieltag ist bereits beendet';
  end if;

  select count(*) into v_count
    from public.games where match_day_id = p_match_day_id;
  if v_count <> 1 then
    raise exception 'Das geht nur, wenn genau ein Spiel (das erste) angelegt ist';
  end if;

  select * into v_first
    from public.games where match_day_id = p_match_day_id;
  if v_first.finished = false then
    raise exception 'Das erste Spiel ist noch nicht beendet';
  end if;
  if p_stayer not in (v_first.team_a_id, v_first.team_b_id) then
    raise exception 'Das Team, das bleibt, muss im ersten Spiel gespielt haben';
  end if;
  if p_rounds < 1 or p_rounds > 10 then
    raise exception 'Ungültige Rundenzahl';
  end if;

  select id into v_third
    from public.teams
   where match_day_id = p_match_day_id
     and id not in (v_first.team_a_id, v_first.team_b_id);
  if v_third is null then
    raise exception 'Nur für Spieltage mit 3 Teams';
  end if;
  v_other := case when p_stayer = v_first.team_a_id
                  then v_first.team_b_id else v_first.team_a_id end;

  insert into public.games
    (match_day_id, game_number, round_number, team_a_id, team_b_id)
  values
    (p_match_day_id, 2, 1, p_stayer, v_third),
    (p_match_day_id, 3, 1, v_other,  v_third);
  v_created := 2;

  for v_round in 2 .. p_rounds loop
    v_base := (v_round - 1) * 3;
    insert into public.games
      (match_day_id, game_number, round_number, team_a_id, team_b_id)
    values
      (p_match_day_id, v_base + 1, v_round, v_first.team_a_id, v_first.team_b_id),
      (p_match_day_id, v_base + 2, v_round, p_stayer,          v_third),
      (p_match_day_id, v_base + 3, v_round, v_other,           v_third);
    v_created := v_created + 3;
  end loop;

  return v_created;
end;
$$;

-- Spieltag beenden
create or replace function public.end_match_day(p_match_day_id uuid)
returns table (removed int, finished_games int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started   timestamptz;
  v_finished  timestamptz;
  v_removed   int;
  v_done      int;
begin
  if not public.can_edit_match_day(p_match_day_id) then
    raise exception 'Keine Berechtigung zum Eintragen';
  end if;

  select started_at, finished_at
    into v_started, v_finished
    from public.match_days
   where id = p_match_day_id;
  if not found then
    raise exception 'Spieltag nicht gefunden';
  end if;
  if v_started is null then
    raise exception 'Der Spieltag ist noch nicht gestartet';
  end if;
  if v_finished is not null then
    raise exception 'Der Spieltag ist bereits beendet';
  end if;

  if exists (
    select 1 from public.games g
     where g.match_day_id = p_match_day_id
       and g.finished = false
       and (g.goals_team_a > 0 or g.goals_team_b > 0)
  ) then
    raise exception 'Es läuft noch ein Spiel mit Toren. Bitte zuerst das Spiel beenden.';
  end if;

  delete from public.games g
   where g.match_day_id = p_match_day_id
     and g.finished = false;
  get diagnostics v_removed = row_count;

  update public.match_days
     set finished_at = now()
   where id = p_match_day_id;

  select count(*)::int into v_done
    from public.games g
   where g.match_day_id = p_match_day_id and g.finished = true;

  return query select v_removed, v_done;
end;
$$;

-- Rechte der Funktionen: nur Angemeldete (nicht "anon")
revoke execute on function public.change_goal(uuid, text, int) from anon;
revoke execute on function public.finish_game(uuid) from anon;
revoke execute on function public.start_match_day(uuid) from anon;
revoke execute on function public.create_first_game(uuid, uuid, uuid) from anon;
revoke execute on function public.create_remaining_games(uuid, uuid, int) from anon;
revoke execute on function public.end_match_day(uuid) from anon;

grant execute on function public.change_goal(uuid, text, int) to authenticated;
grant execute on function public.finish_game(uuid) to authenticated;
grant execute on function public.start_match_day(uuid) to authenticated;
grant execute on function public.create_first_game(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_remaining_games(uuid, uuid, int) to authenticated;
grant execute on function public.end_match_day(uuid) to authenticated;

commit;

-- Kontrolle: Regeln, die Schreiben erlauben (Leser darf keine davon nutzen)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and cmd in ('INSERT', 'DELETE', 'UPDATE', 'ALL')
order by tablename, policyname;
