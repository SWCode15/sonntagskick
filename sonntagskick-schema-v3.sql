-- ============================================================
-- Sonntagskick – Datenbank-Änderungen NACH dem Schema-Update v2
-- Stand: 11.10.2026
--
-- WICHTIG: Alles in diesem Skript wurde bereits einzeln im
-- Supabase SQL Editor ausgeführt. Die Datei dient als
-- Nachschlagewerk und Backup, damit die Datenbank bei Bedarf
-- wieder aufgebaut werden kann (zuerst sonntagskick-schema-v2.sql,
-- dann dieses Skript).
-- Nicht erneut auf der bestehenden Datenbank ausführen:
-- "create policy" und "add constraint" brechen mit einem Fehler ab,
-- wenn es die Regel schon gibt.
-- ============================================================

-- ------------------------------------------------------------
-- 1. players: Tippfehler-Spalte entfernt
--    (Spielertyp steht pro Saison in season_players)
-- ------------------------------------------------------------
alter table public.players drop column palyer_type;

-- ------------------------------------------------------------
-- 2. games: Reihenfolge der Spiele innerhalb eines Spieltags
-- ------------------------------------------------------------
alter table public.games add column game_number smallint;
alter table public.games
  add constraint games_game_number_unique unique (match_day_id, game_number);
alter table public.games
  add constraint games_game_number_check check (game_number >= 1);

-- ------------------------------------------------------------
-- 3. Row Level Security: Policies (alle für "public" = jeder)
--    Vorhanden war bereits: "Public read players" (SELECT)
-- ------------------------------------------------------------

-- Spieler
create policy "Public insert players"
on public.players for insert to public with check (true);

-- Saisons
create policy "Public read seasons"
on public.seasons for select to public using (true);

-- Spielertyp pro Saison
create policy "Public read season_players"
on public.season_players for select to public using (true);
create policy "Public insert season_players"
on public.season_players for insert to public with check (true);

-- Spieltage und Teams
create policy "Public read match_days"
on public.match_days for select to public using (true);
create policy "Public insert match_days"
on public.match_days for insert to public with check (true);

create policy "Public read teams"
on public.teams for select to public using (true);
create policy "Public insert teams"
on public.teams for insert to public with check (true);

-- Anwesenheit und Teamzuordnung (Löschen bewusst für alle erlaubt,
-- damit am Platz korrigiert werden kann; Abweichung von der Doku)
create policy "Public read match_day_players"
on public.match_day_players for select to public using (true);
create policy "Public insert match_day_players"
on public.match_day_players for insert to public with check (true);
create policy "Public delete match_day_players"
on public.match_day_players for delete to public using (true);

create policy "Public read team_players"
on public.team_players for select to public using (true);
create policy "Public insert team_players"
on public.team_players for insert to public with check (true);
create policy "Public delete team_players"
on public.team_players for delete to public using (true);

-- Spiele: lesen, anlegen, nur UNBEGONNENE Spiele löschen.
-- Es gibt absichtlich KEINE UPDATE-Policy: Tore werden nur über
-- die Funktionen unten geändert.
create policy "Public read games"
on public.games for select to public using (true);
create policy "Public insert games"
on public.games for insert to public with check (true);
create policy "Public delete unplayed games"
on public.games for delete to public
using (finished = false and goals_team_a = 0 and goals_team_b = 0);

-- ------------------------------------------------------------
-- 4. Funktionen für das Live-Zählen
--    "+1 / -1 auf den bestehenden Stand": mehrere Handys
--    überschreiben sich nicht. Nie unter 0, nur bei nicht
--    beendeten Spielen. security definer = darf trotz fehlender
--    UPDATE-Policy ändern, aber nur genau das.
-- ------------------------------------------------------------
create or replace function public.change_goal(
  p_game_id uuid, p_side text, p_delta int
)
returns table (new_a smallint, new_b smallint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_side not in ('a', 'b') then
    raise exception 'Ungueltige Seite';
  end if;
  if p_delta not in (1, -1) then
    raise exception 'Ungueltige Aenderung';
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

create or replace function public.finish_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update games set finished = true where id = p_game_id;
  if not found then
    raise exception 'Spiel nicht gefunden';
  end if;
end;
$$;

revoke all on function public.change_goal(uuid, text, int) from public;
revoke all on function public.finish_game(uuid) from public;
grant execute on function public.change_goal(uuid, text, int) to anon, authenticated;
grant execute on function public.finish_game(uuid) to anon, authenticated;
