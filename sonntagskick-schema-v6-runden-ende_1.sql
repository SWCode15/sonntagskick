-- ============================================================
-- Sonntagskick – 4 Runden automatisch und Spieltag beenden (Schema v6)
-- Stand: 15.10.2026
--
-- Voraussetzung: v4 (Anmeldung) und v5 (Spieltag starten) sind ausgeführt.
--
-- Was das Skript macht:
--   * match_days bekommt "finished_at" (leer = nicht beendet).
--   * Funktionen create_first_game() und create_remaining_games():
--     bei 3 Teams erst das erste Spiel anlegen, nach diesem Spiel
--     entscheidet sich, welches Team bleibt, dann entstehen alle
--     restlichen Spiele (Standard 4 Runden = 12 Spiele) nach der
--     Rundenregel. Das dürfen alle Angemeldeten, nur bei gestartetem
--     Spieltag und nur in dieser Reihenfolge.
--   * Funktion end_match_day(): beendet den Spieltag. Nicht gespielte
--     Spiele (0:0, nicht beendet) werden entfernt, das Ergebnis zählt
--     bis dahin. Läuft noch ein Spiel mit Toren, wird abgelehnt.
--   * Spiele direkt anlegen oder löschen dürfen nur noch Admins
--     (Regel "Admin all games" aus v4). Die Regeln für alle
--     Angemeldeten dazu werden entfernt.
--
-- Eine Transaktion: bei einem Fehler wird NICHTS geändert.
-- Mehrfach ausführbar (Ersatz für eine frühere Fassung dieses Skripts).
-- Im SQL Editor: Editor leeren, einfügen, Run, bei Warnung "Run query".
-- ============================================================

begin;

-- 1. Neues Feld
alter table public.match_days
  add column if not exists finished_at timestamptz;

-- 2. Direktes Anlegen/Löschen von Spielen nur noch für Admins
drop policy if exists "Auth insert games" on public.games;
drop policy if exists "Auth delete unplayed games" on public.games;

-- 3. Standard-Runden anlegen (3 Teams), in zwei Schritten
--    Schritt 1: erstes Spiel (A:B).
--    Schritt 2: nach dem ERSTEN SPIEL entscheidet sich, welches Team bleibt.
--    Dann entstehen Spiel 2 und 3 der ersten Runde und die restlichen
--    Runden (Standard 4). Reihenfolge je Runde: A:B, Bleiber:Drittes,
--    Anderes:Drittes. Ab Runde 2 wiederholt sich diese Reihenfolge.
--    Das dürfen alle Angemeldeten, aber nur bei gestartetem, nicht
--    beendetem Spieltag und nur in dieser Reihenfolge.
drop function if exists public.create_standard_games(uuid, uuid, uuid, uuid, int);

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

  -- Rest von Runde 1: Spiel 2 und 3
  insert into public.games
    (match_day_id, game_number, round_number, team_a_id, team_b_id)
  values
    (p_match_day_id, 2, 1, p_stayer, v_third),
    (p_match_day_id, 3, 1, v_other,  v_third);
  v_created := 2;

  -- Runden 2 bis p_rounds: dieselbe Reihenfolge
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

revoke all on function public.create_first_game(uuid, uuid, uuid) from public;
revoke execute on function public.create_first_game(uuid, uuid, uuid) from anon;
grant execute on function public.create_first_game(uuid, uuid, uuid) to authenticated;

revoke all on function public.create_remaining_games(uuid, uuid, int) from public;
revoke execute on function public.create_remaining_games(uuid, uuid, int) from anon;
grant execute on function public.create_remaining_games(uuid, uuid, int) to authenticated;

-- 4. Spieltag beenden
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

revoke all on function public.end_match_day(uuid) from public;
revoke execute on function public.end_match_day(uuid) from anon;
grant execute on function public.end_match_day(uuid) to authenticated;

commit;
