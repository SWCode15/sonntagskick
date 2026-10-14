-- ============================================================
-- Sonntagskick – Spieltage vorab anlegen (eigene Terminliste)
-- Stand: 14.10.2026
--
-- Legt für jedes Datum in der Liste unten einen Spieltag mit
-- 3 Teams an (match_format = '3_teams', Teams 1 bis 3).
--
-- SO ANPASSEN:
--   * Termine, die ausfallen, die ganze Zeile löschen.
--   * Neue Termine als neue Zeile ergänzen, Format: ('JJJJ-MM-TT'),
--   * Jede Zeile endet mit einem Komma, AUSSER die letzte Zeile.
--   * Saison unten bei season_name anpassen, falls nötig.
--
-- Sicher mehrfach ausführbar: Gibt es für ein Datum schon einen
-- Spieltag (z. B. der Test-Spieltag vom 11.10.), wird es übersprungen.
-- Es wird nichts überschrieben oder gelöscht.
--
-- Ausführen: Supabase > SQL Editor > einfügen > Run.
-- ============================================================

with s as (
  select id from public.seasons where season_name = '2026/2027'
),
dates (play_date) as (
  values
    (date '2026-10-18'),
    (date '2026-10-25'),
    (date '2026-11-01'),
    (date '2026-11-08'),
    (date '2026-11-15'),
    (date '2026-11-22'),
    (date '2026-11-29'),
    (date '2026-12-06'),
    (date '2026-12-13'),
    (date '2026-12-20'),
    (date '2026-12-27'),
    (date '2027-01-03'),
    (date '2027-01-10'),
    (date '2027-01-17'),
    (date '2027-01-24'),
    (date '2027-01-31'),
    (date '2027-02-07'),
    (date '2027-02-14'),
    (date '2027-02-21'),
    (date '2027-02-28')
),
new_days as (
  insert into public.match_days (season_id, play_date, match_format)
  select s.id, d.play_date, '3_teams'
  from s, dates d
  where not exists (
    select 1 from public.match_days m where m.play_date = d.play_date
  )
  returning id
)
insert into public.teams (match_day_id, team_number)
select nd.id, t.n
from new_days nd, generate_series(1, 3) as t(n);

-- Kontrolle: alle Spieltage mit Anzahl Teams (jeder sollte 3 haben)
select m.play_date, count(t.id) as teams
from public.match_days m
left join public.teams t on t.match_day_id = m.id
group by m.play_date
order by m.play_date;
