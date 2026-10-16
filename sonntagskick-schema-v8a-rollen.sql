-- ============================================================
-- Sonntagskick – Rollen vorbereiten (Schema v8a)
-- Stand: 16.10.2026
--
-- Voraussetzung: v4 bis v7 sind ausgeführt.
--
-- Dieses Skript FÜGT NUR NEUES HINZU. Bestehende Regeln und
-- Funktionen werden NICHT geändert, die App läuft unverändert weiter.
-- Die Umstellung der Regeln folgt später in v8b.
--
-- Was das Skript macht:
--   * Tabelle "writers": E-Mail-Adressen der Konten, die am Spieltag
--     eintragen dürfen (von außen nicht lesbar, wie "admins").
--   * Funktion is_writer(): ist das angemeldete Konto in "writers"?
--   * Funktion my_role(): liefert 'admin', 'writer' oder 'reader'.
--   * Spalte match_days.entry_locked: Admin kann das Eintragen für
--     einen Spieltag sperren (Standard: nicht gesperrt).
--   * Funktion can_edit_match_day(spieltag): darf das angemeldete
--     Konto bei diesem Spieltag eintragen? Admin immer; "writer" nur
--     am Spieltag selbst (Datum in Wien) und wenn nicht gesperrt.
--   * Funktion can_write_today(): darf das Konto heute irgendetwas
--     eintragen (z. B. neuen Spieler anlegen)? Admin immer; "writer"
--     nur, wenn heute ein nicht gesperrter Spieltag ist.
--
-- Eine Transaktion: bei einem Fehler wird NICHTS geändert.
-- Mehrfach ausführbar.
-- Im SQL Editor: Editor leeren, einfügen, Run.
-- ============================================================

begin;

-- 1. Liste der Eintragen-Konten
create table if not exists public.writers (
  email text primary key
);
alter table public.writers enable row level security;

-- 2. Prüffunktionen
create or replace function public.is_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.writers w
    where lower(w.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then 'admin'
    when public.is_writer() then 'writer'
    else 'reader'
  end;
$$;

-- 3. Sperre pro Spieltag
alter table public.match_days
  add column if not exists entry_locked boolean not null default false;

-- 4. Darf das Konto bei diesem Spieltag eintragen?
create or replace function public.can_edit_match_day(p_match_day_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_writer()
      and exists (
        select 1 from public.match_days m
        where m.id = p_match_day_id
          and m.entry_locked = false
          and m.play_date = (now() at time zone 'Europe/Vienna')::date
      )
    );
$$;

-- 5. Darf das Konto heute irgendetwas eintragen (z. B. Spieler anlegen)?
create or replace function public.can_write_today()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or (
      public.is_writer()
      and exists (
        select 1 from public.match_days m
        where m.entry_locked = false
          and m.play_date = (now() at time zone 'Europe/Vienna')::date
      )
    );
$$;

-- 6. Rechte: nur Angemeldete, nicht "anon"
revoke all on function public.is_writer() from public;
revoke all on function public.my_role() from public;
revoke all on function public.can_edit_match_day(uuid) from public;
revoke all on function public.can_write_today() from public;

revoke execute on function public.is_writer() from anon;
revoke execute on function public.my_role() from anon;
revoke execute on function public.can_edit_match_day(uuid) from anon;
revoke execute on function public.can_write_today() from anon;

grant execute on function public.is_writer() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.can_edit_match_day(uuid) to authenticated;
grant execute on function public.can_write_today() to authenticated;

commit;

-- Kontrolle: alles sollte vorhanden sein (4 Funktionen, 1 Tabelle, 1 Spalte)
select
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('is_writer','my_role','can_edit_match_day','can_write_today')) as funktionen,
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_name = 'writers') as tabelle_writers,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'match_days'
      and column_name = 'entry_locked') as spalte_entry_locked;
