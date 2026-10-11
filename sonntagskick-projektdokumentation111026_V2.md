# ⚽ Sonntagskick – Projektdokumentation

**Stand:** 11.10.2026 · **Version des Dokuments:** 4
**Zweck:** Single Source of Truth. Dieses Dokument in jeden neuen Chat (Claude, Copilot, ChatGPT) hochladen, dann muss nichts neu erklärt werden. Nach jedem abgeschlossenen Schritt wird es aktualisiert (siehe Änderungsprotokoll am Ende).
**Hinweis zum Dateinamen:** Die Datei heißt im Repo weiterhin `sonntagskick-projektdokumentation111026_V2.md` (nicht umbenennen, damit die Verbindung zum Claude-Projekt stabil bleibt). Die echte Version steht oben im Dokument.

---

## 1. Projektziel

Kostenlose, mobile Webplattform für die Sonntags-Fußballrunde. Ergebnisse werden **live am Platz mit dem Handy** erfasst, daraus entstehen Spieltags-, Saison- und All-Time-Auswertungen.

**Mobile-First ist Pflicht:** große Buttons, große Touch-Flächen, wenige Eingaben pro Bildschirm, keine breiten Tabellen.

---

## 2. Spielweise (Fachliches Konzept)

### 2.1 Spieltag
- Gespielt wird **jeden Sonntag**.
- **Saison: Oktober bis Februar** (Winter). Saisons müssen auch rückwirkend angelegt werden können.
- Pro Spieltag ca. **10 bis 15 Spieler**.
- Teams werden **per Los** gebildet (in V1 weiterhin von Hand, die App hält nur das Ergebnis fest).

### 2.2 Spielertypen
- **Stammspieler** (ca. 13), **Springer** (ca. 3 bis 4), **Gastspieler** (werden eingeladen, wenn zu wenige da sind).
- Alle drei Typen kommen in die Wertung, **Auswertungen müssen nach Typ filterbar sein** (nur Stamm, Stamm + Springer, alle).
- **Der Typ gilt pro Saison** und kann zwischen Saisons wechseln. Er gehört deshalb nicht in `players`, sondern in eine Zuordnung Spieler ↔ Saison (`season_players`).

### 2.3 Teams
- **Standard: 3 Teams** (ca. 95 % der Spieltage), meist 4 bis 5 Spieler pro Team.
- Ausnahmen müssen möglich sein: **2 Teams** (z. B. 5 gegen 5), **4 Teams** (noch nie vorgekommen), **ein Team mit einem Spieler mehr**, außerdem ein **offener Modus** mit frei wählbarer Teamanzahl (2 bis 8).
- **Jeder Spieler hat pro Spieltag genau ein Team.** Alle Ergebnisse dieses Teams zählen für ihn. Fällt jemand zwischendurch aus (Verletzung), wird das im Kommentar des Spieltags festgehalten.
- Teams heißen immer **Team 1, Team 2, Team 3, ...** (nicht A/B).

### 2.4 Runden und Spiele
- Ein **Spiel** dauert **7 Minuten**.
- Eine **Runde** ist erreicht, wenn **jedes Team einmal gegen jedes andere** gespielt hat. Bei 3 Teams: 3 Spiele, jedes Team hat ein Spiel Pause.
- **Standard: 4 Runden** (= 12 Spiele). Je nach Zeit auch weniger (z. B. 3 Runden).
- **Reihenfolge bei 3 Teams (bestätigt):** Das erste Spiel der Runde 1 kann von Spieltag zu Spieltag unterschiedlich sein (z. B. 1:2 oder 1:3). Danach wird entschieden, welches Team bleibt (spielt gleich nochmal gegen das dritte Team), danach spielt der Rest. Ab Runde 2 **wiederholt sich dieselbe Reihenfolge** wie in Runde 1 (welches Team links oder rechts steht, ist egal). Beispiel: Runde 1: 1:2, 1:3, 2:3 / Runde 2: 1:2, 1:3, 2:3 usw.
- Spiele müssen einzeln anlegbar, auslassbar und (nur wenn unbegonnen) entfernbar sein.

### 2.5 Punkte
- Sieg **3 Punkte**, Unentschieden **1 Punkt**, Niederlage **0 Punkte**.
- Teampunkte werden **aus den Spielergebnissen berechnet**, nicht separat gespeichert. Es zählen nur **beendete** Spiele.

### 2.6 Krone und Strichl
- Am Ende des Spieltags:
  - Team mit den **meisten Punkten** → alle Spieler des Teams bekommen die **Krone** 👑.
  - Team mit den **wenigsten Punkten** → alle Spieler des Teams bekommen das **Strichl** ❌.
- **Punktgleichheit:** Es entscheidet das **Torverhältnis** (Tordifferenz).
- **Auch Torverhältnis gleich:** Strichl (bzw. Krone) wird **von Hand** entschieden und eingetragen. Es kann auch **an zwei Teams** vergeben werden.
- Es gibt einen **Standard**, aber die App muss **manuelle Überschreibung** zulassen.
- Haben die Teams nicht gleich viele beendete Spiele, ist die Wertung nicht fair vergleichbar. Die App zeigt dann eine Warnung.

---

## 3. Funktionsumfang

### 3.1 Version 1 (Umsetzungsstand 11.10.2026)
- ✅ Spieler anlegen (Name, Spitzname optional, Typ in der aktuellen Saison). ⏳ Spieler bearbeiten und aktiv/inaktiv setzen: noch offen.
- ⏳ Saisons anlegen (auch rückwirkend): noch keine Seite, Saison 2026/2027 liegt in der Datenbank.
- ✅ Spieltag anlegen (Datum frei wählbar, auch nachträglich; Modus 3/2/4 Teams oder Offen; Kommentar)
- ✅ Spieler als anwesend markieren und einem Team zuordnen, mit Hinweis ob die Teams ausgeglichen sind
- ✅ Spiele anlegen (Standard-Runden mit Wiederholung der Reihenfolge, einzelne Spiele frei) und **live Tore zählen** (große **+1**-Taste, kleine **−1**-Taste, „Spiel beenden“ mit Bestätigung, Auffrischen für mehrere Handys)
- ✅ Kommentarfeld am Spieltag. ⏳ Kommentar am einzelnen Spiel: Spalte vorhanden, noch ohne Oberfläche.
- ✅ Spieltags-Auswertung: Punkte, Tore, Tordifferenz, Krone, Strichl, Warnung bei ungleicher Spielzahl
- ⏳ Manuelle Entscheidung bei Gleichstand (Tabelle `match_day_awards`, noch ohne Oberfläche)
- ⏳ Auswertungen Saison/All-Time:
  - Kronen- und Strichl-Rangliste (Spieltag, Saison, All-Time)
  - Anwesenheitsquote
  - Bestes Team / Teamstatistiken
  - Duo-Statistik (welche Spieler gewinnen zusammen am häufigsten)
  - Angstgegner je Spieler
  - **„Tore im Team“**: Summe der Tore, die das Team eines Spielers geschossen hat (offensiv), und der Gegentore (defensiv). Das ist **keine** persönliche Torjäger-Wertung, weil keine Torschützen erfasst werden.
- ⏳ Nachträgliches Erfassen vergangener Spieltage: technisch möglich (Datum frei wählbar), Saison wird automatisch passend zum Datum gewählt.

### 3.2 Spätere Updates (nicht jetzt bauen, aber nicht verbauen)
- Torschützen pro Tor (eigene Tabelle, für echten „Torgefährlichsten“)
- 7-Minuten-Stoppuhr mit Signal
- Automatische Auslosung per Knopfdruck (mit Tauschen)
- Weitere Auswertungen

---

## 4. Rechte (Benutzerrollen)

### 4.1 Soll (Konzept)

| Aktion | Jeder (ohne Login) | Admin (Login) |
|---|---|---|
| Alles ansehen | ✅ | ✅ |
| Spieler anlegen | ✅ | ✅ |
| Spieltag anlegen, Teams zuordnen | ✅ | ✅ |
| Ergebnisse eintragen (Tore +1/−1, Spiel beenden) | ✅ | ✅ |
| Bestehende Daten nachträglich ändern | ❌ | ✅ |
| Löschen (inkl. beendete Spiele korrigieren) | ❌ | ✅ |

- **2 bis 3 Admins**, Anmeldung mit E-Mail und Passwort (Supabase Auth). **Noch nicht umgesetzt.**
- Umsetzung über **Row Level Security (RLS)**: Lesen und Einfügen für alle, Ändern und Löschen nur für Admins.
- Hinweis: Wer den Link kennt, kann eintragen. Für eine private Runde okay, Link nicht öffentlich verbreiten.

### 4.2 Ist-Stand (11.10.2026, alle Policies für `public`, ohne Login)
- Lesen: players, seasons, season_players, match_days, teams, match_day_players, team_players, games.
- Einfügen: players, season_players, match_days, teams, match_day_players, team_players, games.
- **Bewusste Abweichung vom Soll:** Löschen ist für alle erlaubt bei `match_day_players` und `team_players` (damit am Platz korrigiert werden kann) und bei `games` nur für **unbegonnene** Spiele (0:0, nicht beendet).
- **Es gibt keine UPDATE-Policy.** Tore ändern sich nur über zwei Datenbankfunktionen: `change_goal(p_game_id, p_side 'a'|'b', p_delta +1/-1)` (nie unter 0, nur bei nicht beendeten Spielen) und `finish_game(p_game_id)`. Damit überschreiben sich mehrere Handys nicht („+1/−1 auf den bestehenden Stand“).
- Beendete Spiele lassen sich aktuell **gar nicht** mehr ändern (auch nicht korrigieren). Das kommt mit dem Admin-Login.
- Keine Policies für `match_day_awards` (gesperrt).

---

## 5. Technik

| Baustein | Zweck | Status |
|---|---|---|
| Next.js 16.4 (App Router, TypeScript, Turbopack) | Oberfläche | läuft lokal |
| React 19 | UI | läuft |
| Tailwind CSS 4 | Design | läuft |
| Supabase | Datenbank (später Login) | läuft, Policies und Funktionen siehe 4.2 und 6 |
| Vercel | Veröffentlichung | noch nicht eingerichtet |
| Git + GitHub | Versionen/Backup | Repo `SWCode15/sonntagskick`, Branch `main`, alle Commits online |

Umgebung: Windows, VS Code, Node.js v24, Projektordner `C:\Users\witsc\sonntagskick`. Entwicklungsserver mit `npm run dev` im ersten Terminal laufen lassen, Git-Befehle in einem zweiten Terminal.

### 5.1 Seiten (alle in `app/`)

| Adresse | Datei | Inhalt |
|---|---|---|
| `/` | `app/page.tsx` | Dashboard mit Karten (Spieltage, Spieler; Statistiken und Strichl-Tabelle noch Platzhalter) |
| `/players` | `app/players/page.tsx` | Spielerliste mit Typ der aktuellen Saison |
| `/players/new` | `app/players/new/page.tsx` | Formular Spieler anlegen (Name, Spitzname, Typ) |
| `/matchdays` | `app/matchdays/page.tsx` | Liste der Spieltage |
| `/matchdays/new` | `app/matchdays/new/page.tsx` | Spieltag anlegen (Datum, Modus, Kommentar) |
| `/matchdays/[id]` | `app/matchdays/[id]/page.tsx` | Anwesenheit und Teamzuordnung, Knöpfe zu Spielen und Auswertung |
| `/matchdays/[id]/games` | `app/matchdays/[id]/games/page.tsx` | Spiele anlegen und auflisten |
| `/matchdays/[id]/games/[gameId]` | `app/matchdays/[id]/games/[gameId]/page.tsx` | Live-Torezählen |
| `/matchdays/[id]/results` | `app/matchdays/[id]/results/page.tsx` | Auswertung des Spieltags |

Weitere Dateien: `app/layout.tsx` (Rahmen, Titel „Sonntagskick“, Sprache de, bindet `NavBar` ein), `app/components/NavBar.tsx` („← Zurück“ und „🏠 Start“ auf allen Seiten außer `/`), `lib/supabase.ts`, `.env.local` (enthält Supabase-URL und Publishable Key, **nie auf GitHub, nie in Chats posten**).

Alle Seiten unter `/matchdays/[id]/...` sind Client-Komponenten (`"use client"`, `useParams`) und laden direkt aus Supabase.

### 5.2 Sicherung (wichtig)
- **Code:** liegt auf GitHub (`SWCode15/sonntagskick`).
- **Datenbank-Änderungen** (Spalten, Policies, Funktionen) macht man im Supabase SQL Editor und stehen nicht automatisch im Code. Deshalb liegen sie als Skripte im Repo: `sonntagskick-schema-v2.sql` und `sonntagskick-schema-v3.sql` (Änderungen danach). Neue Datenbank-Änderungen immer in einer Skriptdatei festhalten.
- **Daten** (Spieler, Spieltage, Ergebnisse) liegen nur in Supabase. Backup-Möglichkeit: im Supabase Table Editor jede Tabelle als CSV exportieren (später prüfen, welche Backups im Supabase-Tarif enthalten sind).

---

## 6. Datenbank

### 6.1 Tabellen (aktueller Stand)

Alle Tabellen haben `id` (uuid, Primary Key) und `created_at`.

| Tabelle | Spalten (Pflicht = NOT NULL) |
|---|---|
| `players` | name (Pflicht), nickname (optional, UNIQUE), active (Pflicht) |
| `seasons` | season_name (Pflicht, UNIQUE), start_date, end_date, active |
| `season_players` | season_id, player_id, player_type (`stamm` / `springer` / `gast`), eindeutig pro Saison und Spieler |
| `match_days` | season_id, play_date, match_format (optional: `3_teams`, `2_teams`, `4_teams`, `open`), notes (optional) |
| `match_day_players` | match_day_id, player_id (Spieler war anwesend) |
| `teams` | match_day_id, team_number |
| `team_players` | team_id, player_id |
| `games` | match_day_id, round_number, game_number (Reihenfolge, eindeutig pro Spieltag), team_a_id, team_b_id, goals_team_a, goals_team_b, finished (Standard false), notes |
| `match_day_awards` | match_day_id, award_type (`crown` / `strichl`), team_id, notes. Enthält **nur manuelle** Entscheidungen. Noch ohne Oberfläche und ohne Policies |

**Schutzregeln in der Datenbank:** Fremdschlüssel überall (Löschen eines Spieltags löscht Teams, Zuordnungen und Spiele mit; Spieler und Saisons mit Daten lassen sich nicht löschen), Tore ≥ 0, Team A ≠ Team B, Runde ≥ 1, Saison-Ende ≥ Saison-Start, Spieler nur einmal pro Spieltag, Teamnummer nur einmal pro Spieltag, Spieler nur einmal pro Team, Spielnummer nur einmal pro Spieltag. Zur `match_format`-Spalte: sie hält nur die Auswahl beim Anlegen fest, die echten Daten stehen in `teams` und `games`.

**Daten-Stand 11.10.2026:** 2 Spieler (Witschy, Harry, beide Stammspieler), 1 Saison `2026/2027` (03.10.2026 bis 28.02.2027). Testdaten werden von Hand in Supabase gelöscht (Kinddaten zuerst).

### 6.2 Historie der Skripte
- `sonntagskick-schema-v2.sql` (ausgeführt 11.10.2026): Fremdschlüssel, Unique- und Check-Regeln, `season_players`, `match_day_awards`, `games.finished`/`notes`, `start_Date` → `start_date`.
- `sonntagskick-schema-v3.sql` (ausgeführt 11.10.2026): `players.palyer_type` gelöscht, `games.game_number`, alle Policies aus 4.2, Funktionen `change_goal` und `finish_game`.

### 6.3 Bekannte Lücken im Modell (bewusst offen)
- „Jeder Spieler hat pro Spieltag genau ein Team“ lässt sich mit den vorhandenen Tabellen nicht rein per Unique-Regel erzwingen (`team_players` kennt den Spieltag nicht). Die App löst es, indem sie beim Zuordnen zuerst das alte Team entfernt. Absicherung per Trigger später.
- „Beide Teams eines Spiels gehören zum selben Spieltag wie das Spiel“ ist ebenfalls nicht abgesichert (später Trigger).
- Soll es pro Datum nur einen Spieltag geben (`unique (play_date)`)? Noch offen.
- Die „aktuelle Saison“ ist in den Seiten Spieler und Spieler anlegen die mit dem neuesten Startdatum. Spieler, die in einer neuen Saison weiterspielen, müssen dort erst in `season_players` eingetragen werden (Seite dafür fehlt noch).

### 6.4 Spätere Erweiterung
- `goals` (Torschützen pro Tor)

---

## 7. Arbeitsregeln für die Zusammenarbeit
- **Komplette Dateien** mit Dateinamen, keine Schnipsel („füge irgendwo ein“).
- **Kleine Schritte:** ein Schritt → testen → Git-Commit → nächster Schritt.
- Screenshots vom Editor oder Fehlermeldungen im Zweifel mitschicken. Ergebnisse aus Supabase am besten als CSV-Text einfügen.
- Keine Zugangsdaten (Keys, Passwörter) in Chats.
- Der Nutzer ist Einsteiger: Schritte kleinteilig erklären, Fehlermeldungen gemeinsam durchgehen.
- Nach jedem funktionierenden Schritt sichern: speichern, `git add`, `git commit -m`, `git push`.

## 8. Lessons Learned
- Copilot hat teilweise Code verfälscht dargestellt (JSX-Teile wurden als Links/Text angezeigt, z. B. Fehler „Invalid regular expression flag“; beim Dashboard fehlte das öffnende `<Link>`). Deshalb: komplette Dateien, im Zweifel Screenshot des Editors.
- Next.js 16 hatte ein Cache-Problem beim Laden der Daten (eingegrenzt). Seiten mit Live-Daten daher mit `export const dynamic = "force-dynamic"` oder als Client-Komponente.
- Supabase-Zugriff funktioniert erst mit passenden RLS-Policies. Ohne Policy ist eine Tabelle mit aktivem RLS komplett gesperrt. Löschen und Ändern ist ohne eigene Policy ebenfalls gesperrt.
- Git früh nutzen: ein guter Commit ist ein Rückfallpunkt.
- PowerShell blockierte anfangs Skripte, gelöst mit `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- Nicht auf die Tabellennamen aus Chat-Protokollen verlassen, sondern die Datenbank auslesen (ursprünglich geplant: `spieler`, tatsächlich: `players`).
- Spaltennamen mit Großbuchstaben (`start_Date`) erzwingen Anführungszeichen in SQL. Immer klein schreiben.
- Neue Check-Regeln entdecken Fehler in Altdaten. Das Skript läuft als Transaktion, bei einem Fehler wird nichts übernommen.
- Ein doppelt ausgeführter `insert` wird durch Unique-Regeln mit Fehler 23505 abgewiesen. Das ist kein Schaden, sondern der Schutz vor Doppeleinträgen.
- **Terminals:** `npm run dev` läuft im ersten Terminal und bleibt dort. Git-Befehle in einem zweiten Terminal (+ im Terminal-Fenster). Wer im selben Terminal weitertippt, beendet den Server und die Seite ist nicht mehr erreichbar.
- **404 bei neuen Seiten:** Die Datei muss genau `page.tsx` heißen (einmal `pag.tsx`), im richtigen Ordner liegen und gespeichert sein. Bei neuen Ordnern mit eckigen Klammern den Server neu starten (`Strg + C`, `npm run dev`). Hilft das nicht, den Ordner `.next` löschen (`Remove-Item -Recurse -Force .next`).
- **„Element type is invalid“:** Meist ist eine neu angelegte Komponentendatei leer oder nicht gespeichert (kein `export default`).
- Tore nie als „Stand ersetzen“ speichern, sondern per Datenbankfunktion „+1/−1 auf den bestehenden Stand“.

---

## 9. Offene Punkte / nächste Schritte
1. **Manuelle Entscheidung bei Gleichstand** (Krone/Strichl): Oberfläche auf der Auswertungsseite, Policies für `match_day_awards`. Offene Entscheidung: darf das jeder oder erst mit Admin-Login?
2. **Admin-Login und RLS** für Ändern und Löschen, Korrektur beendeter Spiele.
3. **Auswertungen Saison/All-Time** (Kronen, Strichl, Anwesenheit, Duos, Angstgegner, Tore im Team), Filter nach Spielertyp. Dashboard-Karten Statistiken und Strichl-Tabelle verlinken.
4. **Veröffentlichung mit Vercel** (Umgebungsvariablen eintragen, Link nur an die Runde geben).
5. Kleinere Verbesserungen: Spieler bearbeiten und inaktiv setzen, Saison anlegen, Typ pro Saison ändern, Spielertyp in der Zuordnungsliste anzeigen, Kommentar pro Spiel, 7-Minuten-Stoppuhr, Teams eines Spieltags nachträglich ändern.
6. Backups der Daten klären (siehe 5.2).

---

## 10. Änderungsprotokoll
| Datum | Änderung |
|---|---|
| 11.10.2026 | Version 1: Spielweise, Regeln, Rechte, Funktionsumfang und Arbeitsregeln aus dem Fragen-Gespräch ergänzt, Technikstand aus Copilot-Protokoll übernommen |
| 11.10.2026 | Version 2: Datenbank-Ist-Stand ausgelesen (Spalten, RLS, Policies, Constraints), Befunde und Soll-Stand ergänzt, Schema-Skript erstellt, Datenmodell-Entwurf durch echte Struktur ersetzt |
| 11.10.2026 | Version 3: Schema-Skript ausgeführt (Fremdschlüssel, Unique- und Check-Regeln, `season_players`, `match_day_awards`, `games.finished`/`notes`). Enddatum der Saison 2026/2027 korrigiert, Spielertypen nach `season_players` übernommen |
| 11.10.2026 | Version 4: App gebaut und getestet: Spielerverwaltung mit Typ pro Saison, Spieltag anlegen (Modi 3/2/4/Offen), Anwesenheit und Teamzuordnung, Spiele anlegen (Rundenlogik), Live-Torezählen per Datenbankfunktion, Dashboard und Navigationsleiste, Spieltags-Auswertung mit Krone, Strichl und Warnung bei ungleicher Spielzahl. `palyer_type` gelöscht, `games.game_number` ergänzt, Policies und Funktionen (`sonntagskick-schema-v3.sql`). Rechte-Ist-Stand und Seitenübersicht ergänzt |
