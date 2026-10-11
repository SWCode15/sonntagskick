-- ============================================================
-- Sonntagskick – Schema-Update v2
-- Im Supabase SQL Editor ausführen (alles markieren, Run).
-- Das Skript läuft als EINE Transaktion: Bei einem Fehler wird
-- nichts übernommen, die Datenbank bleibt wie sie war.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. players: Pflichtfelder lockern
--    nickname: Gäste haben evtl. keinen Spitznamen (UNIQUE bleibt,
--    mehrere leere Werte sind dabei erlaubt).
--    palyer_type (Tippfehler) gehört pro Saison in season_players.
--    Wird erst gelöscht, wenn klar ist, ob dort Daten drin stehen.
--    Bis dahin nur nicht mehr Pflicht, damit das Formular klappt.
-- ------------------------------------------------------------
alter table public.players alter column nickname drop not null;
alter table public.players alter column palyer_type drop not null;

-- ------------------------------------------------------------
-- 2. seasons: Spaltenname bereinigen, Datum prüfen
-- ------------------------------------------------------------
alter table public.seasons rename column "start_Date" to start_date;
alter table public.seasons
  add constraint seasons_dates_check check (end_date >= start_date);

-- ------------------------------------------------------------
-- 3. Alte deutsche Constraint-Namen vereinheitlichen
-- ------------------------------------------------------------
alter table public.players   rename constraint "Spieler_pkey"            to players_pkey;
alter table public.players   rename constraint "Spieler_nickname_key"    to players_nickname_key;
alter table public.seasons   rename constraint "Saison_pkey"             to seasons_pkey;
alter table public.seasons   rename constraint "Saison_season_name_key"  to seasons_season_name_key;
alter table public.match_days rename constraint "Spieltag_pkey"          to match_days_pkey;

-- ------------------------------------------------------------
-- 4. match_days: match_format ist im Konzept nicht vorgesehen
--    (Teamanzahl ergibt sich aus der Tabelle teams). Nicht mehr Pflicht.
-- ------------------------------------------------------------
alter table public.match_days alter column match_format drop not null;

-- ------------------------------------------------------------
-- 5. games: fehlende Spalten und Schutzregeln
-- ------------------------------------------------------------
alter table public.games add column finished boolean not null default false;
alter table public.games add column notes text;

alter table public.games alter column goals_team_a set default 0;
alter table public.games alter column goals_team_b set default 0;

alter table public.games
  add constraint games_goals_check
  check (goals_team_a >= 0 and goals_team_b >= 0);

alter table public.games
  add constraint games_teams_different
  check (team_a_id <> team_b_id);

alter table public.games
  add constraint games_round_check
  check (round_number >= 1);

-- ------------------------------------------------------------
-- 6. Fremdschlüssel (bisher gab es KEINE)
--    cascade  = Kinddaten werden mitgelöscht (Spieltag -> Teams, Spiele)
--    restrict = Löschen wird blockiert, solange Daten daran hängen
--               (Spieler, Saisons)
-- ------------------------------------------------------------
alter table public.match_days
  add constraint match_days_season_fk
  foreign key (season_id) references public.seasons(id) on delete restrict;

alter table public.match_day_players
  add constraint match_day_players_match_day_fk
  foreign key (match_day_id) references public.match_days(id) on delete cascade;
alter table public.match_day_players
  add constraint match_day_players_player_fk
  foreign key (player_id) references public.players(id) on delete restrict;

alter table public.teams
  add constraint teams_match_day_fk
  foreign key (match_day_id) references public.match_days(id) on delete cascade;

alter table public.team_players
  add constraint team_players_team_fk
  foreign key (team_id) references public.teams(id) on delete cascade;
alter table public.team_players
  add constraint team_players_player_fk
  foreign key (player_id) references public.players(id) on delete restrict;

alter table public.games
  add constraint games_match_day_fk
  foreign key (match_day_id) references public.match_days(id) on delete cascade;
alter table public.games
  add constraint games_team_a_fk
  foreign key (team_a_id) references public.teams(id) on delete cascade;
alter table public.games
  add constraint games_team_b_fk
  foreign key (team_b_id) references public.teams(id) on delete cascade;

-- ------------------------------------------------------------
-- 7. Eindeutigkeit (keine Doppeleinträge)
-- ------------------------------------------------------------
alter table public.match_day_players
  add constraint match_day_players_unique unique (match_day_id, player_id);

alter table public.teams
  add constraint teams_unique_number unique (match_day_id, team_number);
alter table public.teams
  add constraint teams_number_check check (team_number >= 1);

alter table public.team_players
  add constraint team_players_unique unique (team_id, player_id);

-- ------------------------------------------------------------
-- 8. Neue Tabelle: Spielertyp pro Saison
-- ------------------------------------------------------------
create table public.season_players (
  id          uuid primary key default gen_random_uuid(),
  season_id   uuid not null references public.seasons(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete restrict,
  player_type text not null check (player_type in ('stamm', 'springer', 'gast')),
  created_at  timestamptz not null default now(),
  constraint season_players_unique unique (season_id, player_id)
);

-- ------------------------------------------------------------
-- 9. Neue Tabelle: manuelle Überschreibung von Krone / Strichl
--    Enthält NUR manuell entschiedene Fälle. Gibt es für einen Spieltag
--    und Typ Einträge, ersetzen sie das berechnete Standardergebnis.
--    Mehrere Teams pro Typ sind möglich (z. B. Strichl für zwei Teams).
-- ------------------------------------------------------------
create table public.match_day_awards (
  id           uuid primary key default gen_random_uuid(),
  match_day_id uuid not null references public.match_days(id) on delete cascade,
  award_type   text not null check (award_type in ('crown', 'strichl')),
  team_id      uuid not null references public.teams(id) on delete cascade,
  notes        text,
  created_at   timestamptz not null default now(),
  constraint match_day_awards_unique unique (match_day_id, award_type, team_id)
);

-- ------------------------------------------------------------
-- 10. RLS auch für die neuen Tabellen einschalten.
--     Ohne Policy sind sie gesperrt. Policies kommen später gezielt.
-- ------------------------------------------------------------
alter table public.season_players    enable row level security;
alter table public.match_day_awards  enable row level security;

commit;
