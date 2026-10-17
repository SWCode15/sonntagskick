-- Sonntagskick v12: Änderungsprotokoll (Historie). Mehrfach ausführbar.
-- Schreibt automatisch mit: wann, welches Konto, welcher Bereich, Aktion
-- (neu / geändert / gelöscht), Klartext und den Inhalt vor und nach der Änderung.
-- NICHT protokolliert: einzelne Tore (+1/-1) bei laufenden Spielen.
-- Lesen darf nur ein Admin. Niemand kann Protokolleinträge ändern oder löschen.

begin;

-- 1. Tabelle
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  actor_email  text,
  actor_role   text,          -- admin / writer / reader / system
  table_name   text not null,
  action       text not null check (action in ('insert', 'update', 'delete')),
  row_id       text,
  match_day_id uuid,          -- nur zum Filtern, bewusst ohne Fremdschlüssel
  summary      text not null,
  old_data     jsonb,
  new_data     jsonb
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_table_idx   on public.audit_log (table_name, created_at desc);
create index if not exists audit_log_action_idx  on public.audit_log (action, created_at desc);

-- 2. Rechte: nur Admins dürfen lesen, niemand schreibt direkt
alter table public.audit_log enable row level security;

drop policy if exists "Admin read audit_log" on public.audit_log;
create policy "Admin read audit_log"
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

revoke all on public.audit_log from anon, authenticated, public;
grant select on public.audit_log to authenticated;

-- 3. Hilfsfunktionen für Klartext

-- Wert eines Feldes lesbar machen
create or replace function public.audit_fmt(p_key text, p_val jsonb)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if p_val is null or jsonb_typeof(p_val) = 'null' then
    return '–';
  end if;
  if p_key in ('started_at', 'finished_at', 'excluded_at') then
    return to_char((p_val #>> '{}')::timestamptz at time zone 'Europe/Vienna', 'DD.MM.YYYY HH24:MI');
  end if;
  if p_key in ('play_date', 'start_date', 'end_date') then
    return to_char((p_val #>> '{}')::date, 'DD.MM.YYYY');
  end if;
  if p_key = 'excluded_type' then
    return case p_val #>> '{}'
      when 'not_played' then 'nicht stattgefunden'
      when 'not_rated' then 'nicht gewertet'
      else p_val #>> '{}' end;
  end if;
  if p_key = 'player_type' then
    return case p_val #>> '{}'
      when 'stamm' then 'Stammspieler'
      when 'springer' then 'Springer'
      when 'gast' then 'Gast'
      else p_val #>> '{}' end;
  end if;
  if jsonb_typeof(p_val) = 'boolean' then
    return case when (p_val #>> '{}')::boolean then 'ja' else 'nein' end;
  end if;
  return p_val #>> '{}';
end;
$$;

-- Liste der geänderten Felder ("Name: A → B; Datum: …")
create or replace function public.audit_changes(p_old jsonb, p_new jsonb)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_key text;
  v_out text := '';
  v_label text;
begin
  for v_key in select jsonb_object_keys(p_new) loop
    if v_key in ('id', 'created_at', 'excluded_at') then
      continue;
    end if;
    if (p_old -> v_key) is distinct from (p_new -> v_key) then
      v_label := case v_key
        when 'name' then 'Name'
        when 'nickname' then 'Spitzname'
        when 'active' then 'aktiv'
        when 'season_name' then 'Name'
        when 'start_date' then 'Start'
        when 'end_date' then 'Ende'
        when 'play_date' then 'Datum'
        when 'notes' then 'Kommentar'
        when 'match_format' then 'Modus'
        when 'season_id' then 'Saison'
        when 'started_at' then 'gestartet'
        when 'finished_at' then 'beendet'
        when 'entry_locked' then 'Eintragen gesperrt'
        when 'excluded_type' then 'Wertung'
        when 'excluded_reason' then 'Begründung'
        when 'player_type' then 'Typ'
        when 'goals_team_a' then 'Tore Team A'
        when 'goals_team_b' then 'Tore Team B'
        when 'finished' then 'beendet'
        else v_key
      end;
      if v_out <> '' then
        v_out := v_out || '; ';
      end if;
      v_out := v_out || v_label || ': '
               || public.audit_fmt(v_key, p_old -> v_key) || ' → '
               || public.audit_fmt(v_key, p_new -> v_key);
    end if;
  end loop;
  return v_out;
end;
$$;

-- 4. Die Auslöser-Funktion
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) end;
  v_new jsonb := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_email text;
  v_role text;
  v_action text := lower(TG_OP);
  v_summary text;
  v_md uuid;
  v_pname text;
  v_sname text;
  v_date text;
  v_tnum text;
  v_tnum2 text;
begin
  -- Nur echte Änderungen
  if TG_OP = 'UPDATE' and v_old = v_new then
    return null;
  end if;

  -- Wer?
  begin
    v_email := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then
    v_email := null;
  end;
  v_role := case
    when v_email is null then 'system'
    when public.is_admin() then 'admin'
    when public.is_writer() then 'writer'
    else 'reader'
  end;

  -- Welcher Spieltag gehört dazu?
  if TG_TABLE_NAME = 'match_days' then
    v_md := (v_row ->> 'id')::uuid;
  elsif TG_TABLE_NAME in ('teams', 'games', 'match_day_players', 'match_day_awards') then
    v_md := (v_row ->> 'match_day_id')::uuid;
  elsif TG_TABLE_NAME = 'team_players' then
    select t.match_day_id into v_md from public.teams t where t.id = (v_row ->> 'team_id')::uuid;
  end if;

  -- Zuordnung gelöscht, weil das Team (oder der Spieltag) gelöscht wurde: nicht einzeln protokollieren
  if TG_TABLE_NAME = 'team_players' and TG_OP = 'DELETE' and v_md is null then
    return null;
  end if;

  if v_md is not null then
    select to_char(m.play_date, 'DD.MM.YYYY') into v_date from public.match_days m where m.id = v_md;
    -- Wird ein ganzer Spieltag gelöscht, steht das schon als eine Zeile im Protokoll
    if TG_OP = 'DELETE' and TG_TABLE_NAME <> 'match_days' and v_date is null then
      return null;
    end if;
  end if;
  v_date := coalesce(v_date, '?');

  if v_row ? 'player_id' then
    select coalesce(p.nickname, p.name) into v_pname from public.players p
      where p.id = (v_row ->> 'player_id')::uuid;
  end if;
  v_pname := coalesce(v_pname, '?');

  -- Klartext
  if TG_TABLE_NAME = 'players' then
    v_summary := case TG_OP
      when 'INSERT' then 'Spieler angelegt: ' || coalesce(v_new ->> 'nickname', v_new ->> 'name') || ' (' || (v_new ->> 'name') || ')'
      when 'DELETE' then 'Spieler gelöscht: ' || coalesce(v_old ->> 'nickname', v_old ->> 'name') || ' (' || (v_old ->> 'name') || ')'
      else 'Spieler ' || coalesce(v_old ->> 'nickname', v_old ->> 'name') || ' geändert – ' || public.audit_changes(v_old, v_new)
    end;

  elsif TG_TABLE_NAME = 'seasons' then
    v_summary := case TG_OP
      when 'INSERT' then 'Saison angelegt: ' || (v_new ->> 'season_name')
      when 'DELETE' then 'Saison gelöscht: ' || (v_old ->> 'season_name')
      else 'Saison ' || (v_old ->> 'season_name') || ' geändert – ' || public.audit_changes(v_old, v_new)
    end;

  elsif TG_TABLE_NAME = 'season_players' then
    select s.season_name into v_sname from public.seasons s where s.id = (v_row ->> 'season_id')::uuid;
    v_sname := coalesce(v_sname, '?');
    v_summary := case TG_OP
      when 'INSERT' then v_pname || ': in Saison ' || v_sname || ' aufgenommen (Typ ' || public.audit_fmt('player_type', v_new -> 'player_type') || ')'
      when 'DELETE' then v_pname || ': aus Saison ' || v_sname || ' entfernt (Typ ' || public.audit_fmt('player_type', v_old -> 'player_type') || ')'
      else v_pname || ': Typ in Saison ' || v_sname || ' geändert – ' || public.audit_changes(v_old, v_new)
    end;

  elsif TG_TABLE_NAME = 'match_days' then
    v_summary := case TG_OP
      when 'INSERT' then 'Spieltag ' || v_date || ' angelegt'
      when 'DELETE' then 'Spieltag ' || to_char((v_old ->> 'play_date')::date, 'DD.MM.YYYY') || ' gelöscht'
      else 'Spieltag ' || to_char((v_old ->> 'play_date')::date, 'DD.MM.YYYY') || ' geändert – ' || public.audit_changes(v_old, v_new)
    end;

  elsif TG_TABLE_NAME = 'teams' then
    v_summary := case TG_OP
      when 'INSERT' then 'Team ' || (v_new ->> 'team_number') || ' bei Spieltag ' || v_date || ' angelegt'
      when 'DELETE' then 'Team ' || (v_old ->> 'team_number') || ' bei Spieltag ' || v_date || ' entfernt'
      else 'Team ' || (v_old ->> 'team_number') || ' bei Spieltag ' || v_date || ' geändert – ' || public.audit_changes(v_old, v_new)
    end;

  elsif TG_TABLE_NAME = 'match_day_players' then
    v_summary := case TG_OP
      when 'INSERT' then v_pname || ' bei Spieltag ' || v_date || ' als anwesend eingetragen'
      when 'DELETE' then v_pname || ' bei Spieltag ' || v_date || ': Anwesenheit entfernt'
      else v_pname || ' bei Spieltag ' || v_date || ' geändert – ' || public.audit_changes(v_old, v_new)
    end;

  elsif TG_TABLE_NAME = 'team_players' then
    select t.team_number::text into v_tnum from public.teams t where t.id = (v_row ->> 'team_id')::uuid;
    v_tnum := coalesce(v_tnum, '?');
    v_summary := case TG_OP
      when 'INSERT' then v_pname || ' bei Spieltag ' || v_date || ' Team ' || v_tnum || ' zugeordnet'
      when 'DELETE' then v_pname || ' bei Spieltag ' || v_date || ': Zuordnung zu Team ' || v_tnum || ' entfernt'
      else v_pname || ' bei Spieltag ' || v_date || ' geändert – ' || public.audit_changes(v_old, v_new)
    end;

  elsif TG_TABLE_NAME = 'games' then
    -- Laufende Spiele (Tore zählen) nicht protokollieren
    if TG_OP = 'UPDATE' then
      if not ((v_old ->> 'finished')::boolean is distinct from (v_new ->> 'finished')::boolean
              or ((v_old ->> 'finished')::boolean
                  and ((v_old ->> 'goals_team_a') is distinct from (v_new ->> 'goals_team_a')
                       or (v_old ->> 'goals_team_b') is distinct from (v_new ->> 'goals_team_b')))) then
        return null;
      end if;
    end if;
    select t.team_number::text into v_tnum from public.teams t where t.id = (v_row ->> 'team_a_id')::uuid;
    select t.team_number::text into v_tnum2 from public.teams t where t.id = (v_row ->> 'team_b_id')::uuid;
    v_tnum := coalesce(v_tnum, '?');
    v_tnum2 := coalesce(v_tnum2, '?');
    v_summary := case TG_OP
      when 'INSERT' then 'Spiel Team ' || v_tnum || ' gegen Team ' || v_tnum2 || ' angelegt (Spieltag ' || v_date || ')'
      when 'DELETE' then 'Spiel Team ' || v_tnum || ' gegen Team ' || v_tnum2 || ' entfernt (Spieltag ' || v_date || ', Stand '
                         || (v_old ->> 'goals_team_a') || ':' || (v_old ->> 'goals_team_b') || ')'
      else case
        when (v_old ->> 'finished')::boolean = false and (v_new ->> 'finished')::boolean = true
          then 'Spiel Team ' || v_tnum || ' gegen Team ' || v_tnum2 || ' beendet, Endstand '
               || (v_new ->> 'goals_team_a') || ':' || (v_new ->> 'goals_team_b') || ' (Spieltag ' || v_date || ')'
        when (v_old ->> 'finished')::boolean = true and (v_new ->> 'finished')::boolean = false
          then 'Spiel Team ' || v_tnum || ' gegen Team ' || v_tnum2 || ' wieder geöffnet (Spieltag ' || v_date || ')'
        else 'Spiel Team ' || v_tnum || ' gegen Team ' || v_tnum2 || ' korrigiert: '
             || (v_old ->> 'goals_team_a') || ':' || (v_old ->> 'goals_team_b') || ' → '
             || (v_new ->> 'goals_team_a') || ':' || (v_new ->> 'goals_team_b') || ' (Spieltag ' || v_date || ')'
      end
    end;

  elsif TG_TABLE_NAME = 'match_day_awards' then
    select t.team_number::text into v_tnum from public.teams t where t.id = (v_row ->> 'team_id')::uuid;
    v_tnum := coalesce(v_tnum, '?');
    v_summary := (case TG_OP when 'DELETE' then 'Entscheidung entfernt: ' else 'Entscheidung festgelegt: ' end)
      || case v_row ->> 'award_type' when 'crown' then 'Krone' when 'strichl' then 'Strichl' else (v_row ->> 'award_type') end
      || ' für Team ' || v_tnum || ' (Spieltag ' || v_date || ')';

  else
    v_summary := TG_TABLE_NAME || ' ' || v_action;
  end if;

  insert into public.audit_log
    (actor_email, actor_role, table_name, action, row_id, match_day_id, summary, old_data, new_data)
  values
    (v_email, v_role, TG_TABLE_NAME, v_action, v_row ->> 'id', v_md, v_summary, v_old, v_new);

  return null;
end;
$$;

revoke all on function public.audit_row() from public, anon, authenticated;

-- 5. Auslöser an die Tabellen hängen
do $$
declare
  t text;
begin
  foreach t in array array[
    'players', 'seasons', 'season_players', 'match_days', 'teams',
    'match_day_players', 'team_players', 'games', 'match_day_awards'
  ] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s '
      'for each row execute function public.audit_row()', t);
  end loop;
end;
$$;

commit;

-- Kontrolle: 9 Auslöser, 1 Tabelle (die Protokolltabelle ist anfangs leer)
select
  (select count(*) from pg_trigger
    where tgname like 'audit\_%' and not tgisinternal) as ausloeser,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'audit_log') as tabelle,
  (select count(*) from public.audit_log) as eintraege;
