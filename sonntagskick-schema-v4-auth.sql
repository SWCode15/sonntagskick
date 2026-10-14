-- ============================================================
-- Sonntagskick – Datenbank-Schutz durch Anmeldung (Schema v4)
-- Stand: 14.10.2026
--
-- Reihenfolge der Ausführung (siehe Chat/Arbeitsstand):
--   1. App mit Anmeldeseite ist veröffentlicht und getestet.
--   2. Dieses Skript im Supabase SQL Editor ausführen.
--   3. Danach die Admin-E-Mail eintragen (Befehl steht unten im
--      Abschnitt "NACH dem Skript").
--
-- Was das Skript macht:
--   * Ohne Anmeldung (Rolle "anon") kommt niemand mehr an die Daten,
--     auch nicht mit URL und Publishable Key.
--   * Jeder Angemeldete (Runde und Admins) darf wie bisher lesen,
--     Spieler/Spieltage/Teams/Spiele anlegen, Zuordnungen löschen,
--     unbegonnene Spiele löschen und Tore zählen.
--   * Nur Admins (Tabelle "admins") dürfen zusätzlich alles ändern
--     und löschen, auch beendete Spiele und Entscheidungen bei
--     Gleichstand (match_day_awards).
--
-- Läuft als eine Transaktion: bei einem Fehler wird NICHTS geändert.
-- Die alten Regeln (v3) bleiben als Rückfall in
-- sonntagskick-schema-v3.sql nachlesbar.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Admin-Liste und Prüffunktion
--    RLS an, keine Policy: die Liste ist von außen nicht lesbar.
--    Die Funktion (security definer) darf sie trotzdem prüfen.
-- ------------------------------------------------------------
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------
-- 2. Alte, offene Regeln (Rolle "public") entfernen
-- ------------------------------------------------------------
drop policy if exists "Public read players" on public.players;
drop policy if exists "Public insert players" on public.players;
drop policy if exists "Public read seasons" on public.seasons;
drop policy if exists "Public read season_players" on public.season_players;
drop policy if exists "Public insert season_players" on public.season_players;
drop policy if exists "Public read match_days" on public.match_days;
drop policy if exists "Public insert match_days" on public.match_days;
drop policy if exists "Public read teams" on public.teams;
drop policy if exists "Public insert teams" on public.teams;
drop policy if exists "Public read match_day_players" on public.match_day_players;
drop policy if exists "Public insert match_day_players" on public.match_day_players;
drop policy if exists "Public delete match_day_players" on public.match_day_players;
drop policy if exists "Public read team_players" on public.team_players;
drop policy if exists "Public insert team_players" on public.team_players;
drop policy if exists "Public delete team_players" on public.team_players;
drop policy if exists "Public read games" on public.games;
drop policy if exists "Public insert games" on public.games;
drop policy if exists "Public delete unplayed games" on public.games;

-- ------------------------------------------------------------
-- 3. Neue Regeln für Angemeldete (Rolle "authenticated")
-- ------------------------------------------------------------

-- Lesen: alle Tabellen
create policy "Auth read players" on public.players
  for select to authenticated using (true);
create policy "Auth read seasons" on public.seasons
  for select to authenticated using (true);
create policy "Auth read season_players" on public.season_players
  for select to authenticated using (true);
create policy "Auth read match_days" on public.match_days
  for select to authenticated using (true);
create policy "Auth read teams" on public.teams
  for select to authenticated using (true);
create policy "Auth read match_day_players" on public.match_day_players
  for select to authenticated using (true);
create policy "Auth read team_players" on public.team_players
  for select to authenticated using (true);
create policy "Auth read games" on public.games
  for select to authenticated using (true);
create policy "Auth read match_day_awards" on public.match_day_awards
  for select to authenticated using (true);

-- Anlegen: wie bisher für alle Angemeldeten
create policy "Auth insert players" on public.players
  for insert to authenticated with check (true);
create policy "Auth insert season_players" on public.season_players
  for insert to authenticated with check (true);
create policy "Auth insert match_days" on public.match_days
  for insert to authenticated with check (true);
create policy "Auth insert teams" on public.teams
  for insert to authenticated with check (true);
create policy "Auth insert match_day_players" on public.match_day_players
  for insert to authenticated with check (true);
create policy "Auth insert team_players" on public.team_players
  for insert to authenticated with check (true);
create policy "Auth insert games" on public.games
  for insert to authenticated with check (true);

-- Löschen: Anwesenheit und Teamzuordnung (Korrekturen am Platz),
-- Spiele nur, solange sie unbegonnen sind (0:0, nicht beendet).
create policy "Auth delete match_day_players" on public.match_day_players
  for delete to authenticated using (true);
create policy "Auth delete team_players" on public.team_players
  for delete to authenticated using (true);
create policy "Auth delete unplayed games" on public.games
  for delete to authenticated
  using (finished = false and goals_team_a = 0 and goals_team_b = 0);

-- ------------------------------------------------------------
-- 4. Admins dürfen alles (Ändern, Löschen, Anlegen) in allen Tabellen
-- ------------------------------------------------------------
create policy "Admin all players" on public.players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all seasons" on public.seasons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all season_players" on public.season_players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all match_days" on public.match_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all teams" on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all match_day_players" on public.match_day_players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all team_players" on public.team_players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all games" on public.games
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin all match_day_awards" on public.match_day_awards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 5. Tore zählen und Spiel beenden: nur noch für Angemeldete
-- ------------------------------------------------------------
revoke execute on function public.change_goal(uuid, text, int) from anon;
revoke execute on function public.finish_game(uuid) from anon;
grant execute on function public.change_goal(uuid, text, int) to authenticated;
grant execute on function public.finish_game(uuid) to authenticated;

commit;

-- ============================================================
-- NACH dem Skript (einzeln ausführen, E-Mail durch die eigene
-- Admin-E-Mail ersetzen, genau wie in Supabase unter
-- Authentication > Users angelegt):
--
--   insert into public.admins (email) values ('admin@beispiel.at');
--
-- Weitere Admins später genauso eintragen. Entfernen:
--
--   delete from public.admins where email = 'admin@beispiel.at';
-- ============================================================
