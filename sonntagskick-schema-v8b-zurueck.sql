-- ============================================================
-- Sonntagskick – NOTFALL: Rollenprüfung ausschalten (v8b zurück)
-- Stand: 16.10.2026
--
-- Macht die beiden Prüffunktionen "immer erlaubt". Damit dürfen
-- wieder ALLE Angemeldeten eintragen (so wie vor den Rollen), soweit
-- die Regeln es zulassen. Die Rollen-Regeln selbst bleiben bestehen,
-- werden aber nicht mehr blockiert.
--
-- Nur im Notfall verwenden, wenn am Spieltag nichts mehr geht.
-- Danach v8a erneut ausführen (stellt die Prüfung wieder her).
-- Hinweis: Neue Spieltage und Teams legen weiter nur Admins an.
-- ============================================================

begin;

create or replace function public.can_edit_match_day(p_match_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select true; $$;

create or replace function public.can_write_today()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select true; $$;

commit;
