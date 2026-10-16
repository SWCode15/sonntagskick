-- Sonntagskick v9: Spieler nicht doppelt anlegen (Name und Spitzname eindeutig,
-- Gross/Klein und Leerzeichen am Rand egal). Mehrfach ausführbar.
-- Voraussetzung: es gibt noch keine doppelten Namen/Spitznamen.

create unique index if not exists players_name_unique_ci
  on public.players (lower(btrim(name)));

create unique index if not exists players_nickname_unique_ci
  on public.players (lower(btrim(nickname)))
  where nickname is not null and btrim(nickname) <> '';

-- Kontrolle: beide Indizes müssen erscheinen
select indexname
from pg_indexes
where schemaname = 'public' and tablename = 'players'
order by indexname;
