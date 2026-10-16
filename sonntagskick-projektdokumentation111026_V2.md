# ⚽ Sonntagskick – Projektdokumentation

**Stand:** 16.10.2026 · **Version des Dokuments:** 9
**Zweck:** Single Source of Truth. Dieses Dokument in jeden neuen Chat (Claude, Copilot, ChatGPT) hochladen, dann muss nichts neu erklärt werden. Nach jedem abgeschlossenen Schritt wird es aktualisiert (siehe Änderungsprotokoll am Ende).
**Hinweis zum Dateinamen:** Die Datei heißt im Repo weiterhin `sonntagskick-projektdokumentation111026_V2.md` (nicht umbenennen, damit die Verbindung zum Claude-Projekt stabil bleibt). Die echte Version steht oben im Dokument.

---

## 1. Projektziel

Kostenlose, mobile Webplattform für die Sonntags-Fußballrunde. Ergebnisse werden **live am Platz mit dem Handy** erfasst, daraus entstehen Spieltags-, Saison- und All-Time-Auswertungen.

**Mobile-First ist Pflicht:** große Buttons, große Touch-Flächen, wenige Eingaben pro Bildschirm, keine breiten Tabellen (die Live-Tabelle ist bewusst kompakt, 9 schmale Spalten).

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
- **Standard: 3 Teams** (ca. 95 % der Spieltage), normalerweise **4 Spieler pro Team** (Hinweis vor dem Start, wenn es anders ist; Abweichung ist kein Fehler).
- Ausnahmen müssen möglich sein: **2 Teams** (z. B. 5 gegen 5), **4 Teams** (noch nie vorgekommen), **ein Team mit einem Spieler mehr**, außerdem ein **offener Modus** mit frei wählbarer Teamanzahl (2 bis 8).
- **Jeder Spieler hat pro Spieltag genau ein Team.** Alle Ergebnisse dieses Teams zählen für ihn. Fällt jemand zwischendurch aus (Verletzung), wird das im Kommentar des Spieltags festgehalten.
- Teams heißen immer **Team 1, Team 2, Team 3, ...** (nicht A/B).
- Alle Stammspieler stehen in der Liste; „nicht da“ = kein Team. Nachzügler gibt es nicht, man weiß vorher, in welchem Team jemand spielt.

### 2.4 Runden und Spiele
- Ein **Spiel** dauert **7 Minuten**.
- Eine **Runde** ist erreicht, wenn **jedes Team einmal gegen jedes andere** gespielt hat. Bei 3 Teams: 3 Spiele, jedes Team hat ein Spiel Pause.
- **Standard: 4 Runden** (= 12 Spiele). Je nach Zeit auch weniger: Der Knopf „🏁 Spieltag beenden“ beendet den Spieltag früher, das Ergebnis zählt bis dahin.
- **Reihenfolge bei 3 Teams (bestätigt):** Das erste Spiel der Runde 1 kann von Spieltag zu Spieltag unterschiedlich sein (z. B. 1:2 oder 1:3). **Erst nach dem ersten Spiel** wird entschieden, welches Team bleibt (der Spielverlauf entscheidet darüber), das Bleiberteam spielt gleich nochmal gegen das dritte Team, danach spielt der Rest gegen das dritte Team. Ab Runde 2 **wiederholt sich dieselbe Reihenfolge** wie in Runde 1. Beispiel (1:2 zuerst, Team 1 bleibt): Runde 1: 1:2, 1:3, 2:3 / Runde 2: 1:2, 1:3, 2:3 usw.
- **Ablauf in der App (3 Teams):** erstes Spiel wählen (Bestätigung) → Spiel zählen und beenden → „Welches Team bleibt?“ → Bestätigung → alle restlichen Spiele bis Runde 4 werden angelegt. Danach können Runden und Spiele **nur noch Admins** ändern, hinzufügen oder entfernen; alle anderen zählen nur Tore. Bei 2 oder 4 Teams (und offenem Modus) legt ein Admin die Spiele an.

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

### 3.1 Version 1 (Umsetzungsstand 15.10.2026)
- ✅ Spieler anlegen (Name, Spitzname optional, Typ in der aktuellen Saison). ⏳ Spieler bearbeiten und aktiv/inaktiv setzen: noch offen.
- ⏳ Saisons anlegen (auch rückwirkend): noch keine Seite, Saison 2026/2027 liegt in der Datenbank.
- ✅ Spieltag anlegen (Datum frei wählbar, auch nachträglich; Modus 3/2/4 Teams oder Offen; Kommentar), Spieltage vorab per Skript
- ✅ Spieler als anwesend markieren und einem Team zuordnen; Hinweis vor dem Start bei ungleich großen Teams
- ✅ **Spieltag starten** (Kontrolldialog) und **beenden** (Kontrolldialog), Bestätigungsfragen bei allen wichtigen Knöpfen
- ✅ Spiele: Standard-Runden bei 3 Teams in zwei Schritten (siehe 2.4), Admin-Werkzeuge zum Ergänzen/Entfernen; **live Tore zählen** (große **+1**-Taste, kleine **−1**-Taste, „Spiel beenden“ mit Bestätigung, danach zurück zur Übersicht, Button „▶ Nächstes Spiel zählen“, Auffrischen für mehrere Handys)
- ✅ Spitznamen der Spieler je Team in Spieleübersicht und Live-Spiel
- ✅ **Live-Tabelle** (Sp, S, U, N, Tore, Diff, Pkt) mit automatischer Aktualisierung
- ✅ Kommentarfeld am Spieltag. ⏳ Kommentar am einzelnen Spiel: Spalte vorhanden, noch ohne Oberfläche.
- ✅ Spieltags-Auswertung: Punkte, Tore, Tordifferenz, Krone, Strichl, Warnung bei ungleicher Spielzahl
- ✅ Manuelle Entscheidung bei Gleichstand (Tabelle `match_day_awards`): nach „Spieltag beenden“ auf der Auswertungsseite, alle dürfen eintragen, Admins ändern; auffälliger Hinweis
- ⏳ Admin: Spieltag bearbeiten/löschen, Team ergänzen, beendete Spiele korrigieren
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
- Automatische Auslosung per Knopfdruck (mit Tauschen), geringe Priorität, siehe 9.1
- Weitere Auswertungen

---

## 4. Rechte (Benutzerrollen)

### 4.1 Konzept (Anmeldung 14.10.2026, Rollen 16.10.2026)

**Ohne Anmeldung kommt niemand in die App und niemand an die Daten.** Es gibt drei Rollen mit je eigenem Zugang. Die Anmeldeseite hat drei Knöpfe (Leser, Eintragen, Admin); bei Leser und Eintragen steht der Benutzername fest (`leser`, `eintragen`) und man gibt nur das Passwort ein, bei Admin E-Mail und Passwort (so speichern Passwort-Manager jedes Konto getrennt).

| Aktion | Leser | Eintragen (nur am Spieltag) | Admin |
|---|---|---|---|
| Alles ansehen (Spieltage, Spiele, Live-Tabelle, Auswertung, Spieler) | ✅ | ✅ | ✅ |
| Spieler anlegen (z. B. Gäste) | ❌ | ✅ | ✅ |
| Anwesenheit und Teamzuordnung (**bis zum Start**) | ❌ | ✅ | ✅ |
| Spieltag starten, beenden | ❌ | ✅ | ✅ |
| Erstes Spiel, „Welches Team bleibt?“, restliche Spiele (3 Teams) | ❌ | ✅ | ✅ |
| Tore zählen, Spiel beenden | ❌ | ✅ | ✅ |
| Gleichstand bei Krone/Strichl entscheiden | ❌ | ✅ | ✅ |
| Teamzuordnung **nach dem Start** ändern, Spieltag wieder öffnen, Beenden rückgängig | ❌ | ❌ | ✅ |
| Spieltage und Teams anlegen/ändern/löschen, Spiele und Runden ändern, Gleichstand-Entscheidung ändern, „Eintragen sperren/freigeben“ | ❌ | ❌ | ✅ (Oberfläche teils noch offen) |

- **„Nur am Spieltag“ gilt automatisch:** Das Konto „Eintragen“ darf nur ändern, wenn das Datum des Spieltags **heute** ist (Zeitzone Europe/Vienna) und der Spieltag **nicht gesperrt** ist. Ein Admin kann pro Spieltag „🔒 Eintragen sperren“ und „🔓 Eintragen freigeben“ (Spalte `match_days.entry_locked`). Notfall: Konto in Supabase (Authentication → Users) sperren oder Passwort ändern.
- **Leser:** gemeinsames Konto `login@sonntagskick.app` (Passwort für die ganze Runde). **Eintragen:** ein Konto `eintragen@sonntagskick.app` (Passwort nur an wenige Personen), eingetragen in der Tabelle `writers`. **Admins:** eigene Konten, eingetragen in `admins`. E-Mails von Leser und Eintragen stehen fest in `app/login/page.tsx`. Passwörter liegen **nie** im Chat oder im Repo.
- **Selbstregistrierung ist ausgeschaltet** (Supabase: Authentication → Sign In / Providers → „Allow new users to sign up“ aus). Neue Konten legt nur ein Admin im Supabase-Dashboard an (Häkchen „Auto Confirm User“).
- **Später/optional:** nur eine Anmeldung gleichzeitig pro Konto (Sitzungstabelle mit Lebenszeichen, Prüfung in den Funktionen, Zeitgrenze und Admin-Freigabe; Aufwand mittel bis hoch), weitere Einzelkonten pro Spieler.
- Passwort vergessen: Admins mit echter E-Mail können es zurücksetzen lassen, bei erfundenen Adressen (z. B. `admin@harry.app`) setzt man es im Supabase-Dashboard neu. Gelangt ein Passwort nach außen: dort einmal ändern.
- **Notfall am Spieltag:** `sonntagskick-schema-v8b-zurueck.sql` schaltet die Rollenprüfung aus (alle Angemeldeten dürfen wieder eintragen). Danach v8a erneut ausführen, um die Prüfung wiederherzustellen.

### 4.2 Ist-Stand (16.10.2026, Skripte v4 bis v8b)
- **Rolle `anon` (ohne Anmeldung) hat keinen Zugriff** auf Tabellen und Funktionen. Alle Regeln gelten für die Rolle `authenticated`.
- **Lesen:** alle Tabellen (inkl. `match_day_awards`) für alle Angemeldeten.
- **Prüffunktionen** (`security definer`, nur für Angemeldete): `is_admin()`, `is_writer()`, `my_role()` (liefert `admin`, `writer` oder `reader`), `can_edit_match_day(spieltag)` (Admin immer; Eintragen nur am Tag des Spieltags und nicht gesperrt), `can_write_today()` (Admin immer; Eintragen nur, wenn heute ein nicht gesperrter Spieltag ist).
- **Anlegen/Löschen für Angemeldete:** `players` und `season_players` nur mit `can_write_today()`; `match_day_players` und `team_players` nur **vor dem Start** und mit `can_edit_match_day`; `match_day_awards` nur bei **beendetem** Spieltag und mit `can_edit_match_day`. `match_days`, `teams`, `games` legen/ändern/löschen nur Admins.
- **Admins** (Tabelle `admins`): Regel „Admin all …“ für **alle** Tabellen. Die Tabellen `admins` und `writers` sind von außen nicht lesbar.
- **Es gibt für Leser und Eintragen keine UPDATE-Policy.** Änderungen laufen über Funktionen (alle `security definer`, nur für Angemeldete, jede prüft `can_edit_match_day`):
  - `change_goal(p_game_id, p_side 'a'|'b', p_delta +1/-1)` (nie unter 0, nur bei nicht beendeten Spielen) und `finish_game(p_game_id)`;
  - `start_match_day(p_match_day_id)`;
  - `create_first_game(p_match_day_id, p_team_a, p_team_b)`: nur gestarteter, nicht beendeter Spieltag mit genau 3 Teams, nur wenn es noch kein Spiel gibt;
  - `create_remaining_games(p_match_day_id, p_stayer, p_rounds default 4)`: nur wenn genau ein, bereits **beendetes** Spiel existiert; Bleiber muss darin gespielt haben; legt Spiel 2 und 3 der Runde 1 und die Runden 2 bis p_rounds an (Standard 12 Spiele insgesamt);
  - `end_match_day(p_match_day_id)`: lehnt ab, wenn ein nicht beendetes Spiel Tore hat; löscht nicht beendete Spiele; setzt `finished_at`; liefert Anzahl entfernter und beendeter Spiele.
- Damit überschreiben sich mehrere Handys nicht („+1/−1 auf den bestehenden Stand“).
- `match_day_awards`: eindeutig pro Spieltag, Art und Team; Ändern/Löschen nur Admins.
- Beendete Spiele korrigieren dürfen technisch Admins, die **Oberfläche dafür fehlt noch**.

---

## 5. Technik

| Baustein | Zweck | Status |
|---|---|---|
| Next.js 16.4 (App Router, TypeScript, Turbopack) | Oberfläche | läuft lokal und auf Vercel |
| React 19 | UI | läuft |
| Tailwind CSS 4 | Design | läuft |
| Supabase | Datenbank + Anmeldung (Supabase Auth) | läuft, Policies und Funktionen siehe 4.2 und 6 |
| Vercel | Veröffentlichung (Hosting der App, siehe 5.3) | läuft seit 14.10.2026 (Region Dublin, passend zu Supabase eu-west-1) |
| Git + GitHub | Versionen/Backup | Repo `SWCode15/sonntagskick`, Branch `main` |

Umgebung: Windows, VS Code, Node.js v24, Projektordner `C:\Users\witsc\sonntagskick`. Entwicklungsserver mit `npm run dev` im ersten Terminal laufen lassen, Git-Befehle in einem zweiten Terminal.

### 5.1 Seiten (alle in `app/`)

| Adresse | Datei | Inhalt |
|---|---|---|
| `/login` | `app/login/page.tsx` | Anmeldung mit drei Knöpfen (Leser, Eintragen, Admin); Benutzername fest bei Leser/Eintragen, E-Mail bei Admin; dazu das Passwort |
| `/` | `app/page.tsx` | Dashboard mit Karten (Spieltage, Spieler; Statistiken und Strichl-Tabelle noch Platzhalter) |
| `/players` | `app/players/page.tsx` | Spielerliste mit Typ der aktuellen Saison; „➕ Spieler hinzufügen“ nur bei Berechtigung |
| `/players/new` | `app/players/new/page.tsx` | Formular Spieler anlegen (Name, Spitzname, Typ); Admin oder Eintragen am Spieltag; gleicher Name/Spitzname wird abgelehnt, bei ähnlichem Namen gelbe Warnung mit „Trotzdem anlegen“ |
| `/players/[id]/edit` | `app/players/[id]/edit/page.tsx` | Spieler ändern (Name, Spitzname, Typ in der aktuellen Saison, Aktiv/Inaktiv); nur Admins |
| `/matchdays` | `app/matchdays/page.tsx` | Liste der Spieltage: „Nächster Spieltag“ groß, „Kommende“, „Vergangene“; „➕ Neuer Spieltag“ nur für Admins |
| `/matchdays/new` | `app/matchdays/new/page.tsx` | Spieltag anlegen (Datum, Modus, Kommentar), nur Admins |
| `/matchdays/[id]` | `app/matchdays/[id]/page.tsx` | Anwesenheit und Teamzuordnung; „▶ Spieltag starten“ mit Kontrolldialog (Teamgrößen, gelber Hinweis bei Teams ohne 4 Spieler, „Nicht da: …“); „🏁 Spieltag beenden“ mit Kontrolldialog; danach Zuordnung gesperrt; Admin: „Beenden rückgängig machen“, „Spieltag wieder öffnen“; Knöpfe zu Spielen (erst nach Start) und Auswertung |
| `/matchdays/[id]/games` | `app/matchdays/[id]/games/page.tsx` | Spieleübersicht: Kasten „Teams“ mit Spitznamen, Button „📊 Live-Tabelle“, großer Button „▶ Nächstes Spiel zählen“, Spiele nach Runden. Standard-Ablauf bei 3 Teams (erstes Spiel → Bleiber nach Spiel 1 → Bestätigung); Admin-Werkzeuge (Runde ergänzen, letzte Runde entfernen, einzelnes Spiel, Spiel entfernen) |
| `/matchdays/[id]/games/[gameId]` | `app/matchdays/[id]/games/[gameId]/page.tsx` | Live-Torezählen mit Spitznamen, Button zur Live-Tabelle; nach „Spiel beenden“ zurück zur Spieleübersicht |
| `/matchdays/[id]/table` | `app/matchdays/[id]/table/page.tsx` | Live-Tabelle (aktualisiert alle 5 s) |
| `/matchdays/[id]/results` | `app/matchdays/[id]/results/page.tsx` | Auswertung des Spieltags mit Krone und Strichl; bei Gleichstand gelber Hinweis und Entscheidung von Hand (nur bei beendetem Spieltag); Admin kann sie ändern |

Weitere Dateien: `app/layout.tsx` (Rahmen, bindet `NavBar` und `AuthGate` ein), `app/components/NavBar.tsx` („← Zurück“, „🏠 Start“, „Abmelden“; Abmelden mit `scope: "local"`), `app/components/AuthGate.tsx` (zeigt Seiten nur Angemeldeten), `lib/supabase.ts`, `.env.local` (enthält Supabase-URL und Publishable Key, **nie auf GitHub, nie in Chats posten**).

**Alle** Seiten laden ihre Daten im Browser (Client-Komponenten, `"use client"`) mit der Anmeldung des Nutzers. Das ist nötig, weil die Datenbank nur Angemeldeten antwortet. Neue Seiten deshalb immer als Client-Komponenten bauen.

### 5.2 Sicherung (wichtig)
- **Code:** liegt auf GitHub (`SWCode15/sonntagskick`).
- **Datenbank-Änderungen** (Spalten, Policies, Funktionen) macht man im Supabase SQL Editor und stehen nicht automatisch im Code. Deshalb liegen sie als Skripte im Repo (siehe 6.2). Neue Datenbank-Änderungen immer in einer Skriptdatei festhalten.
- **Daten** (Spieler, Spieltage, Ergebnisse) liegen nur in Supabase. Backup-Möglichkeit: im Supabase Table Editor jede Tabelle als CSV exportieren (später prüfen, welche Backups im Supabase-Tarif enthalten sind).

### 5.3 Vercel: wofür und wofür nicht
**Warum:** Die App läuft bisher nur auf dem PC (`npm run dev`, Adresse `localhost`). Am Platz brauchen alle Handys einen echten Internet-Link. Vercel liefert ihn.

**Zuständig für:**
- Die fertige App (den Next.js-Code aus GitHub) bauen und ins Internet stellen. Ergebnis: ein Link, der auf jedem Handy funktioniert (`sonntagskick.vercel.app`).
- Automatisch neu veröffentlichen bei jedem `git push` auf `main`. Ein Update ist also: speichern, `git add`, `git commit`, `git push`, nach etwa einer Minute ist die neue Version online.
- Die Umgebungsvariablen für die Veröffentlichung verwalten (Supabase-URL und Publishable Key, genau wie in `.env.local`). Sie werden im Vercel-Projekt unter Settings → Environment Variables selbst eingetragen, **nie in den Chat und nie auf GitHub**.

**Nicht zuständig für:**
- **Daten:** liegen weiter in Supabase. Vercel speichert keine Spieler, Spieltage oder Ergebnisse.
- **Benutzer, Passwörter, Rollen:** laufen über Supabase Auth plus RLS (Abschnitt 4). Der Passwortschutz von Vercel für die ganze Seite kostet extra (Pro-Tarif) und wird nicht verwendet.
- **Code und Versionen:** bleiben bei Git/GitHub. Vercel liest nur mit.

**Kosten:** Der Tarif **Hobby ist kostenlos** (keine Zahlungsdaten nötig), gilt aber nur für private, nicht kommerzielle Nutzung. Das passt für die Sonntagsrunde. Wird die App je kommerziell genutzt, braucht es einen bezahlten Tarif.

### 5.4 Git-Befehle (Spickzettel)
Git ist das Versionsprogramm, GitHub der Online-Speicher dafür. Alle Befehle im **zweiten** Terminal eingeben (im ersten läuft `npm run dev`), im Projektordner `C:\Users\witsc\sonntagskick`.

| Befehl | Was er macht | Wann |
|---|---|---|
| `git status -s` | Zeigt kurz, welche Dateien geändert oder neu sind. Ist die Ausgabe **leer**, ist alles gesichert. `M` = geändert, `??` = neu, noch nicht erfasst. | Vor und nach dem Sichern |
| `git add .` | Legt **alle** Änderungen in den „Warenkorb“ für den nächsten Commit. Der Punkt gehört dazu. Einzelne Datei: `git add app/matchdays/page.tsx`. | Nach jedem funktionierenden Schritt |
| `git commit -m "Text"` | Macht aus dem Warenkorb einen **Speicherpunkt** (lokal auf dem PC) mit einer kurzen Beschreibung. **Text in Anführungszeichen direkt hinter `-m`, alles in einer Zeile.** | Nach `git add` |
| `git push` | **Lädt die Speicherpunkte zu GitHub hoch.** Danach veröffentlicht Vercel die App automatisch neu (etwa 1 bis 2 Minuten). | Nach `git commit` |
| `git log --oneline` | Liste der bisherigen Speicherpunkte, neuester oben. | Zum Nachsehen |
| `git restore <Datei>` | Verwirft Änderungen an einer Datei, die noch **nicht** committet sind, und holt den letzten Speicherpunkt zurück. Vorsicht: Änderungen sind dann weg. | Wenn eine Datei versehentlich überschrieben wurde |
| `git checkout <Commit> -- <Datei>` | Holt eine Datei aus einem älteren Speicherpunkt zurück, z. B. `git checkout c496245 -- sonntagskick-schema-v2.sql`. | Wiederherstellen aus der Vergangenheit |

**Normaler Ablauf in drei Schritten:**
```
git add .
git commit -m "Kurze Beschreibung"
git push
```
Danach `git status -s` eingeben: Bleibt die Ausgabe leer, ist alles gesichert. Reihenfolge einhalten: erst speichern (Strg+S), dann add, commit, push.

**Typische Stolpersteine:**
- `git commit` **ohne** `-m "…"` öffnet den Editor Vim (ein Texteditor im Terminal, den Git automatisch startet). Raus kommt man mit **Esc**, dann `:q!` und Enter (bricht den Commit ab, nichts geht verloren). Danach den Befehl mit `-m "…"` wiederholen.
- `git commit -m` ohne Text gibt „switch `m' requires a value“. Der Text fehlt.
- `git push` meldet „Everything up-to-date“, wenn es nichts zu senden gibt, meist weil `git add .` oder `git commit` fehlt. `git status -s` zeigt dann `M`/`??`.
- `git add` ohne Punkt oder Dateiname fügt nichts hinzu.
- Nicht gespeicherte Dateien (Punkt neben dem Dateinamen im Reiter) werden nicht mitgesichert. Erst Strg+S.
- Dateien in `.gitignore` (z. B. `.env.local`, im Dateibaum grau) werden bewusst **nie** hochgeladen.

---

## 6. Datenbank

### 6.1 Tabellen (aktueller Stand)

Alle Tabellen haben `id` (uuid, Primary Key) und `created_at`.

| Tabelle | Spalten (Pflicht = NOT NULL) |
|---|---|
| `players` | name (Pflicht), nickname (optional, UNIQUE), active (Pflicht) |
| `seasons` | season_name (Pflicht, UNIQUE), start_date, end_date, active |
| `season_players` | season_id, player_id, player_type (`stamm` / `springer` / `gast`), eindeutig pro Saison und Spieler |
| `match_days` | season_id, play_date, match_format (optional: `3_teams`, `2_teams`, `4_teams`, `open`), notes (optional), **started_at** (leer = nicht gestartet; gesetzt durch `start_match_day`), **finished_at** (leer = nicht beendet; gesetzt durch `end_match_day`), **entry_locked** (Standard false; Admin sperrt damit das Eintragen für diesen Spieltag) |
| `match_day_players` | match_day_id, player_id (Spieler war anwesend) |
| `teams` | match_day_id, team_number |
| `team_players` | team_id, player_id |
| `games` | match_day_id, round_number, game_number (Reihenfolge, eindeutig pro Spieltag), team_a_id, team_b_id, goals_team_a, goals_team_b, finished (Standard false), notes |
| `admins` | email (Primary Key). Wer hier steht und ein Konto hat, ist Admin. Von außen nicht lesbar |
| `writers` | email (Primary Key). Konten, die am Spieltag eintragen dürfen (aktuell `eintragen@sonntagskick.app`). Von außen nicht lesbar |
| `match_day_awards` | match_day_id, award_type (`crown` / `strichl`), team_id, notes. Enthält **nur manuelle** Entscheidungen. Noch ohne Oberfläche |

**Schutzregeln in der Datenbank:** Fremdschlüssel überall (Löschen eines Spieltags löscht Teams, Zuordnungen und Spiele mit; Spieler und Saisons mit Daten lassen sich nicht löschen), Tore ≥ 0, Team A ≠ Team B, Runde ≥ 1, Saison-Ende ≥ Saison-Start, Spieler nur einmal pro Spieltag, Teamnummer nur einmal pro Spieltag, Spieler nur einmal pro Team, Spielnummer nur einmal pro Spieltag. Zur `match_format`-Spalte: sie hält nur die Auswahl beim Anlegen fest, die echten Daten stehen in `teams` und `games`.

**Daten-Stand 15.10.2026:** 2 Spieler (Witschy, Harry, beide Stammspieler), 1 Saison `2026/2027` (03.10.2026 bis 28.02.2027), Spieltage der Saison vorab angelegt (je 3 Teams, per Skript, einige Termine bewusst ausgelassen). Testdaten wurden am 15.10.2026 abends zurückgesetzt (danach am Testspieltag erneut getestet, vor dem echten Einsatz noch einmal zurücksetzen) (Spiele, Anwesenheit, Zuordnungen gelöscht, `started_at`/`finished_at` geleert). Es gibt 18 Spieltage mit je 3 Teams.

### 6.2 Historie der Skripte
- `sonntagskick-schema-v2.sql` (ausgeführt 11.10.2026): Fremdschlüssel, Unique- und Check-Regeln, `season_players`, `match_day_awards`, `games.finished`/`notes`, `start_Date` → `start_date`.
- `sonntagskick-schema-v3.sql` (ausgeführt 11.10.2026): `players.palyer_type` gelöscht, `games.game_number`, alle Policies aus 4.2, Funktionen `change_goal` und `finish_game`.
- `sonntagskick-spieltage-vorab.sql` (ausgeführt 14.10.2026, **mehrfach ausführbar**): legt Spieltage mit je 3 Teams für eine selbst gepflegte Terminliste an; vorhandene Daten werden übersprungen.
- `sonntagskick-schema-v4-auth.sql` (ausgeführt 14.10.2026): Tabelle `admins`, Funktion `is_admin()`, alle offenen „Public“-Regeln ersetzt durch Regeln für `authenticated` plus „Admin all …“, Funktionen nur noch für Angemeldete. **Nicht erneut ausführen.**
- `sonntagskick-schema-v5-start.sql` (ausgeführt 14.10.2026): `match_days.started_at`, Funktion `start_match_day`, Sperre von Anwesenheit/Teamzuordnung nach dem Start. **Nicht erneut ausführen.**
- `sonntagskick-schema-v9-spieler-eindeutig.sql` (ausgeführt 16.10.2026, **mehrfach ausführbar**): eindeutiger Name und Spitzname in `players` (Groß/Klein und Leerzeichen am Rand egal), Indizes `players_name_unique_ci`, `players_nickname_unique_ci`.
- `sonntagskick-schema-v8a-rollen.sql` (ausgeführt 16.10.2026, **mehrfach ausführbar**, fügt nur Neues hinzu): Tabelle `writers`, Funktionen `is_writer`, `my_role`, `can_edit_match_day`, `can_write_today`, Spalte `match_days.entry_locked`.
- `sonntagskick-schema-v8b-rollen-regeln.sql` (ausgeführt 16.10.2026, **mehrfach ausführbar**): schaltet die Rollen scharf (Regeln für `players`, `season_players`, `match_days`, `teams`, `match_day_players`, `team_players`, `match_day_awards` und alle Eintragen-Funktionen mit Prüfung `can_edit_match_day`). Notfall: `sonntagskick-schema-v8b-zurueck.sql` (macht die beiden Prüffunktionen „immer erlaubt“; danach v8a erneut ausführen).
- `sonntagskick-schema-v7-gleichstand.sql` (ausgeführt 15.10.2026, **mehrfach ausführbar**): Regel „Auth insert match_day_awards“ (nur bei beendetem Spieltag), eindeutiger Index auf `match_day_awards`.
- `sonntagskick-schema-v6-runden-ende.sql` (ausgeführt 15.10.2026, **mehrfach ausführbar**): `match_days.finished_at`, Regeln „Auth insert games“ und „Auth delete unplayed games“ entfernt (Spiele direkt anlegen/löschen nur Admins), Funktionen `create_first_game`, `create_remaining_games`, `end_match_day`. Die frühere Funktion `create_standard_games` (Bleiber vor dem ersten Spiel) wurde verworfen.

### 6.3 Bekannte Lücken im Modell (bewusst offen)
- „Jeder Spieler hat pro Spieltag genau ein Team“ lässt sich mit den vorhandenen Tabellen nicht rein per Unique-Regel erzwingen (`team_players` kennt den Spieltag nicht). Die App löst es, indem sie beim Zuordnen zuerst das alte Team entfernt. Absicherung per Trigger später.
- „Beide Teams eines Spiels gehören zum selben Spieltag wie das Spiel“ ist ebenfalls nicht abgesichert (später Trigger).
- Soll es pro Datum nur einen Spieltag geben (`unique (play_date)`)? Noch offen.
- Die „aktuelle Saison“ ist in den Seiten Spieler und Spieler anlegen die mit dem neuesten Startdatum. Spieler, die in einer neuen Saison weiterspielen, müssen dort erst in `season_players` eingetragen werden (Seite dafür fehlt noch).

### 6.4 Spätere Erweiterung
- `goals` (Torschützen pro Tor)

---

## 7. Arbeitsregeln für die Zusammenarbeit
- **Komplette Dateien** mit Dateinamen und Zielpfad, keine Schnipsel („füge irgendwo ein“).
- **Kleine Schritte:** ein Schritt → testen → Git-Commit → nächster Schritt. Nicht mehrere Dinge parallel.
- Screenshots vom Editor oder Fehlermeldungen im Zweifel mitschicken. Ergebnisse aus Supabase am besten als CSV-Text einfügen.
- Keine Zugangsdaten (Keys, Passwörter) in Chats.
- Der Nutzer ist Einsteiger: Schritte kleinteilig erklären, Fehlermeldungen gemeinsam durchgehen.
- Nach jedem funktionierenden Schritt sichern: speichern, `git add .`, `git commit -m`, `git push`, `git status -s`.

## 8. Lessons Learned
- Copilot hat teilweise Code verfälscht dargestellt (JSX-Teile wurden als Links/Text angezeigt, z. B. Fehler „Invalid regular expression flag“; beim Dashboard fehlte das öffnende `<Link>`). Deshalb: komplette Dateien, im Zweifel Screenshot des Editors.
- Next.js 16 hatte ein Cache-Problem beim Laden der Daten (eingegrenzt). Seiten mit Live-Daten daher als Client-Komponente.
- Supabase-Zugriff funktioniert erst mit passenden RLS-Policies. Ohne Policy ist eine Tabelle mit aktivem RLS komplett gesperrt. Löschen und Ändern ist ohne eigene Policy ebenfalls gesperrt.
- Git früh nutzen: ein guter Commit ist ein Rückfallpunkt.
- PowerShell blockierte anfangs Skripte, gelöst mit `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- Nicht auf die Tabellennamen aus Chat-Protokollen verlassen, sondern die Datenbank auslesen (ursprünglich geplant: `spieler`, tatsächlich: `players`).
- Spaltennamen mit Großbuchstaben (`start_Date`) erzwingen Anführungszeichen in SQL. Immer klein schreiben.
- Neue Check-Regeln entdecken Fehler in Altdaten. Das Skript läuft als Transaktion, bei einem Fehler wird nichts übernommen.
- Ein doppelt ausgeführter `insert` wird durch Unique-Regeln mit Fehler 23505 abgewiesen. Das ist kein Schaden, sondern der Schutz vor Doppeleinträgen.
- **Terminals:** `npm run dev` läuft im ersten Terminal und bleibt dort. Git-Befehle in einem zweiten Terminal. Wer im selben Terminal weitertippt, beendet den Server.
- **404 bei neuen Seiten:** Die Datei muss genau `page.tsx` heißen, im richtigen Ordner liegen und gespeichert sein. Bei neuen Ordnern mit eckigen Klammern den Server neu starten (`Strg + C`, `npm run dev`). Hilft das nicht, den Ordner `.next` löschen (`Remove-Item -Recurse -Force .next`).
- **„Element type is invalid“:** Meist ist eine neu angelegte Komponentendatei leer oder nicht gespeichert (kein `export default`).
- Tore nie als „Stand ersetzen“ speichern, sondern per Datenbankfunktion „+1/−1 auf den bestehenden Stand“.
- Vercel: Function Region auf **Dublin (dub1)** stellen, passend zu Supabase `eu-west-1` (Irland). Nach der Änderung **Redeploy** nötig.
- `app/matchdays/page.tsx` enthielt einmal den Code der Einzel-Spieltag-Seite (Erkennung: `/matchdays` zeigt „Spieltag nicht gefunden“). Beim Einfügen von Dateien immer Zielpfad und erste Zeile prüfen.
- **Vercel-Adressen:** `sonntagskick.vercel.app` (Production) zeigt immer die neueste Version. Adressen mit Code in der Mitte zeigen genau **eine alte** Veröffentlichung. Der Knopf „Visit“ führt zu so einer Einzel-Adresse.
- **Server- vs. Client-Seiten:** Sobald die Datenbank nur Angemeldeten antwortet, müssen alle Seiten im Browser laden (siehe 5.1).
- **Abmelden:** `signOut()` ohne `scope: "local"` würde bei einem gemeinsamen Konto alle Handys abmelden.
- **Konto-E-Mail:** Die E-Mail des Rundenkontos muss exakt zu `RUNDE_EMAIL` in `app/login/page.tsx` passen.
- **SQL-Editor-Warnungen:** „Destructive operations“ erscheint bei `drop policy` (harmlos). „Table without RLS“ → „Run and enable RLS“. Vorher den Editor leeren (Strg+A, Entf), sonst läuft alter Text mit.
- **Reihenfolge bei Rechte-Umbauten:** erst die App veröffentlichen und testen, dann die Datenbank-Regeln umstellen, sonst sperrt man sich aus.
- **Git:** `git commit` ohne `-m "…"` öffnet Vim (Esc, `:q!`, Enter). Fehlt `git add .`, meldet `git push` „Everything up-to-date“. Siehe 5.4.
- **Fachlich:** Welches Team nach dem ersten Spiel bleibt, entscheidet der Spielverlauf. Die App darf es deshalb erst **nach** dem ersten Spiel abfragen, nicht vor dem Anlegen der Runden. Fachliche Abläufe vor dem Bauen mit dem Nutzer durchspielen.
- **Nicht ungefragt eigene Knöpfe erfinden** (z. B. „Alle Runden anlegen“), sondern nur das bauen, was besprochen ist.

---

## 9. Offene Punkte / nächste Schritte

### 9.1 Merkliste für die nächste Sitzung (vom Nutzer gewünscht, unbedingt aufgreifen)
0. ~~Rollenkonzept~~: **umgesetzt am 16.10.2026** (siehe 4.1). Offen daraus: optional Einzelanmeldung pro Konto.
0a. ~~Live-Tabelle inkl. laufendes Spiel~~: **erledigt 16.10.2026** (Umschalter „Nur beendete“ / „Inkl. laufendes“).
0b. ~~Admin: Spieler ändern~~: **erledigt 16.10.2026** (Seite `/players/[id]/edit`).
0c. ~~Doppelte Spieler vermeiden~~: **erledigt 16.10.2026** (Sperre v9 und Warnung bei ähnlichen Namen). **Offen:** Admin-Funktion „Spieler zusammenführen“ (Saison-Typen je Saison, Anwesenheit, Teamzuordnung umhängen; Konflikte vorher anzeigen, Bestätigung).
0c. **Neues Feature, geringe Priorität: Auslosung der Teams per Knopfdruck** (zufällig, mit Tauschen; siehe 3.2). Beachten: gleich große Teams (normal 4), Nicht-Anwesende ausnehmen, Ergebnis bestätigen, dann erst zuordnen.
1. **Erinnerung (auf Wunsch des Nutzers): Team 4 / „Spieltag bearbeiten“.** Admin: Datum, Modus, Kommentar ändern, Team ergänzen, Spieltag löschen. Modus-Wechsel auf 2 oder 4 Teams; bei 2 Teams Runden erweiterbar (Admin). Niedrige Priorität, 95 % der Spieltage sind 3 Teams und 4 Runden. Bis dahin Notlösung: Team in Supabase von Hand eintragen oder Spieltag mit 4 Teams neu anlegen, solange nichts eingetragen ist.

### 9.2 Weitere offene Punkte
1. **Admin-Funktionen in der App:** beendete Spiele korrigieren, Spieltag bearbeiten/löschen. Die Datenbank erlaubt es Admins bereits, die Oberfläche fehlt.
2. ~~Manuelle Entscheidung bei Gleichstand~~: erledigt am 15.10.2026. Offen: Auswertungen (Statistik) müssen später Entscheidungen aus `match_day_awards` vor der berechneten Wertung berücksichtigen.
3. **Warnung beim Wiederöffnen** eines Spieltags mit bereits beendeten Spielen („Änderungen an den Teams ändern die Ergebnisse“).
4. ~~„nicht da“-Knopf~~: erledigt am 15.10.2026 (wie die Team-Knöpfe, ausgewählt orange).
5. **Auswertungen Saison/All-Time** (Kronen, Strichl, Anwesenheit, Duos, Angstgegner, Tore im Team), Filter nach Spielertyp. Dashboard-Karten Statistiken und Strichl-Tabelle verlinken. Auswertungsseite: Beschriftung „Endstand“ bei beendetem Spieltag.
6. Kleinere Verbesserungen: Spieler bearbeiten und inaktiv setzen, Saison anlegen, Typ pro Saison ändern, Kommentar pro Spiel, 7-Minuten-Stoppuhr.
7. **Vor dem echten Einsatz:** CSV-Backup testen, Handytest über Mobilfunk, Passwörter verteilen (Leser an alle, Eintragen nur an wenige), Link `sonntagskick.vercel.app` weitergeben, Handy-Startbildschirm-Verknüpfung. (Testdaten sind am 16.10.2026 zurückgesetzt, Rollen getestet.)
8. **Backups/Historie (Wunsch des Nutzers, 15.10.2026):** (A) vor dem ersten echten Spieltag CSV-Export aller Tabellen testen, danach nach jedem Spieltag (kleiner Aufwand). (B) Seite „Spielbericht“ pro Spieltag mit PDF per Drucken, evtl. Export-Knopf (mittlerer Aufwand, ein Arbeitsschritt). (C) später automatisches Backup per GitHub-Zeitplan in ein privates Archiv; das DB-Passwort liegt nur als GitHub-Secret (größerer Aufwand). (D) bezahlter Supabase-Tarif mit täglichen Backups, aktuell nicht nötig. Im Free-Tarif unter Database → Backups prüfen, was enthalten ist; inaktive Projekte werden pausiert.
9. Optional: Einzelkonten pro Spieler statt gemeinsamem Zugang (siehe 4.1). Im Claude-Projekt ist das GitHub-Repo mehrfach als Quelle eingetragen (harmlos, kann entfernt werden).

---

## 10. Änderungsprotokoll
| Datum | Änderung |
|---|---|
| 11.10.2026 | Version 1: Spielweise, Regeln, Rechte, Funktionsumfang und Arbeitsregeln aus dem Fragen-Gespräch ergänzt, Technikstand aus Copilot-Protokoll übernommen |
| 11.10.2026 | Version 2: Datenbank-Ist-Stand ausgelesen (Spalten, RLS, Policies, Constraints), Befunde und Soll-Stand ergänzt, Schema-Skript erstellt, Datenmodell-Entwurf durch echte Struktur ersetzt |
| 11.10.2026 | Version 3: Schema-Skript ausgeführt (Fremdschlüssel, Unique- und Check-Regeln, `season_players`, `match_day_awards`, `games.finished`/`notes`). Enddatum der Saison 2026/2027 korrigiert, Spielertypen nach `season_players` übernommen |
| 11.10.2026 | Version 4: App gebaut und getestet: Spielerverwaltung mit Typ pro Saison, Spieltag anlegen (Modi 3/2/4/Offen), Anwesenheit und Teamzuordnung, Spiele anlegen (Rundenlogik), Live-Torezählen per Datenbankfunktion, Dashboard und Navigationsleiste, Spieltags-Auswertung mit Krone, Strichl und Warnung bei ungleicher Spielzahl. `palyer_type` gelöscht, `games.game_number` ergänzt, Policies und Funktionen (`sonntagskick-schema-v3.sql`). Rechte-Ist-Stand und Seitenübersicht ergänzt |
| 14.10.2026 | Version 5: Abschnitt 5.3 ergänzt (wofür Vercel gebraucht wird, was es übernimmt und was nicht, Kosten), Abschnitt 5.4 Git-Spickzettel, Vercel eingerichtet und veröffentlicht (Region Dublin), Lessons Learned |
| 14.10.2026 (abends) | Version 6: Anmeldung eingeführt (Login-Seite, AuthGate, Rundenkonto + Admins, Tabelle `admins`, alle Regeln auf `authenticated`, Selbstregistrierung aus), alle Seiten als Client-Komponenten, Spieltage-Liste mit „Nächster Spieltag“, Spieltag starten mit Sperre der Zuordnung (`started_at`, Skripte v4 und v5), Skript für vorab angelegte Spieltage |
| 15.10.2026 | Version 7: Skript v6 (`finished_at`, Funktionen `create_first_game`, `create_remaining_games`, `end_match_day`, Spiele nur noch über Funktionen/Admin). Standard 4 Runden bei 3 Teams in zwei Schritten (Bleiber erst nach dem ersten Spiel), „Spieltag beenden“, Bestätigungsfragen, Hinweis bei Teams ohne 4 Spieler, Nach-Spielende-zurück zur Übersicht, „Nächstes Spiel zählen“, Spitznamen bei den Teams, Live-Tabelle. Abschnitte 2.3, 2.4, 3.1, 4, 5.1, 6 und 8 überarbeitet, Merkliste auf Team-4-Erinnerung gekürzt |
| 15.10.2026 (abends) | Version 8: Skript v7 (Gleichstand-Entscheidung per Datenbank-Regel), Entscheidung von Hand auf der Auswertungsseite (alle dürfen, Admins ändern), auffälliger Hinweis, nach „Spieltag beenden“ direkt zur Auswertung, „nicht da“-Knopf wie die Team-Knöpfe, Testdaten zurückgesetzt, Backup-Ideen (A bis D) in die Merkliste |
| 16.10.2026 | Version 9: Rollenkonzept umgesetzt (Leser, Eintragen nur am Spieltag mit Sperre durch Admin, Admin): Skripte v8a und v8b (plus Notfallskript), Tabelle `writers`, Spalte `entry_locked`, Prüffunktionen, alle Eintragen-Funktionen prüfen die Berechtigung, Anmeldeseite mit drei Knöpfen, Oberfläche je Rolle (Hinweise „Nur ansehen“, Knöpfe ausgeblendet), Konto `eintragen@sonntagskick.app`. Abschnitte 4, 5.1, 6, 9 überarbeitet |
| 16.10.2026 (abends) | Live-Tabelle mit Umschalter „Nur beendete“ / „Inkl. laufendes“; Admin kann Spieler ändern (Seite `/players/[id]/edit`, Knopf „✏ Ändern“ in der Spielerliste). Inaktive Spieler erscheinen nicht in der Anwesenheit eines Spieltags |
| 17.10.2026 | Spielerliste mit Testspielern geleert und neu aufgebaut; Skript v9 (eindeutige Namen), Warnung bei ähnlichen Namen beim Anlegen |
