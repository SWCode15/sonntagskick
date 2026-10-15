-- ============================================================
-- Sonntagskick – Entscheidung bei Gleichstand (Schema v7)
-- Stand: 15.10.2026
--
-- Voraussetzung: v4, v5 und v6 sind ausgeführt.
--
-- Was das Skript macht:
--   * Alle Angemeldeten (Runde und Admins) dürfen in
--     match_day_awards eintragen, wer Krone oder Strichl bekommt,
--     aber NUR bei einem beendeten Spieltag (finished_at gesetzt).
--   * Ändern und Löschen dieser Einträge dürfen nur Admins
--     (Regel "Admin all match_day_awards" aus v4 gilt weiter).
--   * Pro Spieltag, Art (crown/strichl) und Team nur ein Eintrag.
--
-- Eine Transaktion: bei einem Fehler wird NICHTS geändert.
-- Mehrfach ausführbar.
-- Im SQL Editor: Editor leeren, einfügen, Run, bei Warnung "Run query".
-- ============================================================

begin;

drop policy if exists "Auth insert match_day_awards" on public.match_day_awards;

create policy "Auth insert match_day_awards" on public.match_day_awards
  for insert to authenticated
  with check (exists (
    select 1 from public.match_days m
    where m.id = match_day_awards.match_day_id
      and m.finished_at is not null
  ));

create unique index if not exists match_day_awards_unique_entry
  on public.match_day_awards (match_day_id, award_type, team_id);

commit;

-- Kontrolle: Regeln der Tabelle anzeigen
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'match_day_awards'
order by policyname;
