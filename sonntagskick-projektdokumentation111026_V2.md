# ⚽ Sonntagskick – Projektdokumentation

**Stand:** 11.10.2026 · **Version des Dokuments:** 3
**Zweck:** Single Source of Truth. Dieses Dokument in jeden neuen Chat (Claude, Copilot, ChatGPT) hochladen, dann muss nichts neu erklärt werden. Nach jedem abgeschlossenen Schritt wird es aktualisiert (siehe Änderungsprotokoll am Ende).

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
- Ausnahmen müssen möglich sein: **2 Teams** (z. B. 5 gegen 5), **4 Teams** (noch nie vorgekommen), **ein Team mit einem Spieler mehr**.
- **Jeder Spieler hat pro Spieltag genau ein Team.** Alle Ergebnisse dieses Teams zählen für ihn. Fällt jemand zwischendurch aus (Verletzung), wird das im Kommentar des Spieltags festgehalten.

### 2.4 Runden und Spiele
- Ein **Spiel** dauert **7 Minuten**.
- Eine **Runde** ist erreicht, wenn **jedes Team einmal gegen jedes andere** gespielt hat. Bei 3 Teams: 1:2, 1:3, 2:3 (3 Spiele, jedes Team hat ein Spiel Pause).
- **Standard: 4 Runden** (= 12 Spiele). Je nach Zeit auch weniger (z. B. 3 Runden).
- Die Rundenreihenfolge ist nur ein **Vorschlag der App**. Spiele müssen einzeln anlegbar, änderbar und auslassbar sein (z. B. wenn spontan nur 2 Teams weiterspielen).

### 2.5 Punkte
- Sieg **3 Punkte**, Unentschieden **1 Punkt**, Niederlage **0 Punkte**.
- Teampunkte werden **aus den Spielergebnissen berechnet**, nicht separat gespeichert.

### 2.6 Krone und Strichl
- Am Ende des Spieltags:
  - Team mit den **meisten Punkten** → alle Spieler des Teams bekommen die **Krone** 👑.
  - Team mit den **wenigsten Punkten** → alle Spieler des Teams bekommen das **Strichl**.
- **Punktgleichheit:** Es entscheidet das **Torverhältnis** (Tordifferenz).
- **Auch Torverhältnis gleich:** Strichl (bzw. Krone) wird **von Hand** entschieden und eingetragen. Es kann auch **an zwei Teams** vergeben werden.
- Es gibt einen **Standard**, aber die App muss **manuelle Überschreibung** zulassen.

---

## 3. Funktionsumfang

### 3.1 Version 1 (jetzt)
- Spieler anlegen und verwalten (aktiv/inaktiv)
- Saisons anlegen (auch rückwirkend)
- Spieltag anlegen (Datum frei wählbar, auch nachträglich)
- Spieler dem Team zuordnen (manuell)
- Spiele anlegen und **live Tore zählen**: große **+1**-Taste pro Team, kleinere **−1**-Taste für Fehleingaben, Stand wird bei jedem Tipp gespeichert, „Spiel beenden“ bestätigt den Endstand
- **Kommentarfeld** an Spieltag und an jedem Spiel
- Automatische Berechnung von Punkten, Krone, Strichl (mit manueller Überschreibung)
- Nachträgliches Erfassen vergangener Spieltage und Saisons
- Auswertungen (Reihenfolge wird nach dem Eingabe-Teil festgelegt):
  - Kronen- und Strichl-Rangliste (Spieltag, Saison, All-Time)
  - Anwesenheitsquote
  - Bestes Team / Teamstatistiken
  - Duo-Statistik (welche Spieler gewinnen zusammen am häufigsten)
  - Angstgegner je Spieler
  - **„Tore im Team“**: Summe der Tore, die das Team eines Spielers geschossen hat (offensiv), und der Gegentore (defensiv). Das ist **keine** persönliche Torjäger-Wertung, weil keine Torschützen erfasst werden.

### 3.2 Spätere Updates (nicht jetzt bauen, aber nicht verbauen)
- Torschützen pro Tor (eigene Tabelle, für echten „Torgefährlichsten“)
- 7-Minuten-Stoppuhr mit Signal
- Automatische Auslosung per Knopfdruck (mit Tauschen)
- Weitere Auswertungen

---

## 4. Rechte (Benutzerrollen)

| Aktion | Jeder (ohne Login) | Admin (Login) |
|---|---|---|
| Alles ansehen | ✅ | ✅ |
| Spieler anlegen | ✅ | ✅ |
| Spieltag anlegen, Teams zuordnen | ✅ | ✅ |
| Ergebnisse eintragen (Tore +1/−1, Spiel beenden) | ✅ | ✅ |
| Bestehende Daten nachträglich ändern | ❌ | ✅ |
| Löschen (inkl. beendete Spiele korrigieren) | ❌ | ✅ |

- **2 bis 3 Admins**, Anmeldung mit E-Mail und Passwort (Supabase Auth).
- Umsetzung über **Row Level Security (RLS)**: Lesen und Einfügen für alle, Ändern und Löschen nur für Admins.
- Hinweis: Wer den Link kennt, kann eintragen. Für eine private Runde okay, Link nicht öffentlich verbreiten.
- Offener Punkt: Wenn mehrere Handys gleichzeitig dasselbe Spiel zählen, darf sich nichts überschreiben. Tore werden deshalb als „+1/−1 auf den bestehenden Stand“ gespeichert (kleine Datenbankfunktion mit `goals_team_a = goals_team_a + 1`), nicht als „Stand ersetzen“.

---

## 5. Technik

| Baustein | Zweck | Status |
|---|---|---|
| Next.js 16 (App Router, TypeScript) | Oberfläche | läuft lokal |
| React 19 | UI | läuft |
| Tailwind CSS | Design | läuft |
| Supabase | Datenbank + Login | eingerichtet, Lesezugriff auf `players` funktioniert |
| Vercel | Veröffentlichung | noch nicht eingerichtet |
| Git + GitHub | Versionen/Backup | Repo `SWCode15/sonntagskick`, mehrere Commits |

Umgebung: Windows, VS Code, Node.js v24, Projektordner `C:\Users\witsc\sonntagskick`.

### Vorhandene Seiten
- `/` Dashboard
- `/players` Spielerliste (lädt aus Supabase)
- `/players/new` nur Grundgerüst (noch kein echtes Formular)

### Vorhandene Dateien (laut Copilot-Protokoll, noch nicht geprüft)
- `lib/supabase.ts`
- `.env.local` (enthält Supabase-URL und Publishable Key, **nie auf GitHub, nie in Chats posten**)

---

## 6. Datenbank

### 6.1 Ist-Stand (ausgelesen am 11.10.2026, vor dem Schema-Update)

Alle Tabellen haben `id` (uuid, Primary Key) und `created_at`, sofern nicht anders genannt.

| Tabelle | Spalten (Pflicht = NOT NULL) |
|---|---|
| `players` | name (Pflicht), nickname (Pflicht, UNIQUE), active (Pflicht), `palyer_type` (Pflicht, Tippfehler) |
| `seasons` | season_name (Pflicht, UNIQUE), `start_Date` (großes D), end_date, active |
| `match_days` | season_id, play_date, match_format (Pflicht), notes (optional) |
| `match_day_players` | match_day_id, player_id |
| `teams` | match_day_id, team_number |
| `team_players` | team_id, player_id |
| `games` | match_day_id, round_number, team_a_id, team_b_id, goals_team_a, goals_team_b |

**Befunde:**
- Es gibt **keine Fremdschlüssel**, keine Unique-Regeln auf den Zuordnungstabellen und keine Check-Regeln. Nur Primary Keys sowie UNIQUE auf `players.nickname` und `seasons.season_name`.
- Alte Constraint-Namen sind deutsch (`Spieler_pkey`, `Saison_pkey`, `Spieltag_pkey`), Überbleibsel aus Umbenennungen.
- **RLS ist bei allen 7 Tabellen aktiv.** Es existiert genau **eine** Policy: `Public read players` (SELECT, alle, `true`). Alle anderen Tabellen sind damit komplett gesperrt, Einfügen/Ändern/Löschen ist überall gesperrt.

### 6.2 Aktueller Stand nach Schema-Update (Skript `sonntagskick-schema-v2.sql`, **ausgeführt am 11.10.2026**)

**Daten-Stand:** 2 Spieler (Witschy, Harry, beide Stammspieler), 1 Saison `2026/2027` (03.10.2026 bis 28.02.2027). Der Typ beider Spieler wurde aus `players.palyer_type` nach `season_players` übernommen (`stamm`). Das Enddatum der Saison war vorher fälschlich 2026 statt 2027 und wurde korrigiert.

**Was das Skript umgesetzt hat:**

- `players`: `nickname` und `palyer_type` nicht mehr Pflicht. `palyer_type` wird später gelöscht (Typ gehört in `season_players`).
- `seasons`: `start_Date` → `start_date`, Prüfung `end_date >= start_date`.
- `match_days`: `match_format` nicht mehr Pflicht (wird nicht gebraucht, Teamanzahl ergibt sich aus `teams`).
- `games`: neu `finished` (boolean, Standard false) und `notes`. Tore Standard 0. Prüfungen: Tore ≥ 0, Team A ≠ Team B, Runde ≥ 1.
- **Fremdschlüssel** für alle Verknüpfungen. Löschen eines Spieltags löscht Teams, Zuordnungen und Spiele mit. Spieler und Saisons mit Daten lassen sich nicht löschen.
- **Unique-Regeln:** Spieler nur einmal pro Spieltag (`match_day_players`), Teamnummer nur einmal pro Spieltag, Spieler nur einmal pro Team.
- **Neu `season_players`:** season_id, player_id, player_type (`stamm` / `springer` / `gast`), eindeutig pro Saison und Spieler.
- **Neu `match_day_awards`:** nur **manuelle** Entscheidungen zu Krone/Strichl (match_day_id, award_type `crown` / `strichl`, team_id, notes). Existieren Einträge für Spieltag und Typ, ersetzen sie das berechnete Standardergebnis. Mehrere Teams pro Typ möglich.
- RLS auf den neuen Tabellen eingeschaltet, noch ohne Policies (also gesperrt).

### 6.3 Bekannte Lücken im Modell (bewusst offen)
- „Jeder Spieler hat pro Spieltag genau ein Team“ lässt sich mit den vorhandenen Tabellen nicht rein per Unique-Regel erzwingen (`team_players` kennt den Spieltag nicht). Lösung später per Trigger oder Prüfung in der App.
- „Beide Teams eines Spiels gehören zum selben Spieltag wie das Spiel“ ist ebenfalls noch nicht abgesichert (später Trigger).
- Soll es pro Datum nur einen Spieltag geben (`unique (play_date)`)? Noch offen.

### 6.4 Spätere Erweiterung
- `goals` (Torschützen pro Tor)

---

## 7. Arbeitsregeln für die Zusammenarbeit
- **Komplette Dateien** mit Dateinamen, keine Schnipsel („füge irgendwo ein“).
- **Kleine Schritte:** ein Schritt → testen → Git-Commit → nächster Schritt.
- Screenshots vom Editor oder Fehlermeldungen im Zweifel mitschicken. Ergebnisse aus Supabase am besten als CSV-Text einfügen.
- Keine Zugangsdaten (Keys, Passwörter) in Chats.
- Der Nutzer ist Einsteiger: Schritte kleinteilig erklären, Fehlermeldungen gemeinsam durchgehen.

## 8. Lessons Learned
- Copilot hat teilweise Code verfälscht dargestellt (JSX-Teile wurden als Links/Text angezeigt, z. B. Fehler „Invalid regular expression flag“). Deshalb: komplette Dateien, im Zweifel Screenshot des Editors.
- Next.js 16 hatte ein Cache-Problem beim Laden der Daten (eingegrenzt).
- Supabase-Zugriff funktioniert erst mit passenden RLS-Policies. Ohne Policy ist eine Tabelle mit aktivem RLS komplett gesperrt.
- Git früh nutzen: ein guter Commit ist ein Rückfallpunkt.
- PowerShell blockierte anfangs Skripte, gelöst mit `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
- Nicht auf die Tabellennamen aus Chat-Protokollen verlassen, sondern die Datenbank auslesen (ursprünglich geplant: `spieler`, tatsächlich: `players`).
- Spaltennamen mit Großbuchstaben (`start_Date`) erzwingen Anführungszeichen in SQL. Immer klein schreiben.
- Neue Check-Regeln entdecken Fehler in Altdaten (Saison 2026/2027 hatte Enddatum 2026). Das Skript läuft als Transaktion, bei einem Fehler wird nichts übernommen. Fehler dann in den Daten korrigieren und das Skript erneut ausführen.
- Ein doppelt ausgeführter `insert` wird durch Unique-Regeln mit Fehler 23505 abgewiesen. Das ist kein Schaden, sondern der Schutz vor Doppeleinträgen.

---

## 9. Offene Punkte / nächste Schritte
1. ✅ Tabellenstruktur, RLS-Status, Policies und Constraints ausgelesen.
2. ✅ Schema-Skript ausgeführt (`sonntagskick-schema-v2.sql`), `season_players` mit den beiden Stammspielern befüllt.
3. Spalte `players.palyer_type` löschen, sobald klar ist, dass der Code sie nicht verwendet (Suche in VS Code). Wofür war `match_format` gedacht? Danach ggf. löschen.
4. **Aktuellen Code prüfen:** `package.json`, `lib/supabase.ts`, alle Dateien in `app`. Dabei suchen, ob Code `start_Date` oder `palyer_type` verwendet.
5. Klären: Welche Angaben gehören zu einem Spieler (nur Name/Spitzname, Foto, Notiz)?
6. Spieler-Formular `/players/new` fertigstellen (Insert in Supabase, RLS-Policy für Insert).
7. Lese-Policies für die übrigen Tabellen.
8. Admin-Login und RLS für Ändern/Löschen.
9. Spieltag anlegen, Teams zuordnen.
10. Live-Spielerfassung (+1/−1).
11. Auswertungen.
12. Veröffentlichung mit Vercel.
13. GitHub-Push prüfen (ob alle Commits online sind).

---

## 10. Änderungsprotokoll
| Datum | Änderung |
|---|---|
| 11.10.2026 | Version 1: Spielweise, Regeln, Rechte, Funktionsumfang und Arbeitsregeln aus dem Fragen-Gespräch ergänzt, Technikstand aus Copilot-Protokoll übernommen |
| 11.10.2026 | Version 2: Datenbank-Ist-Stand ausgelesen (Spalten, RLS, Policies, Constraints), Befunde und Soll-Stand ergänzt, Schema-Skript erstellt (noch nicht ausgeführt), Datenmodell-Entwurf durch echte Struktur ersetzt |
| 11.10.2026 | Version 3: Schema-Skript ausgeführt (Fremdschlüssel, Unique- und Check-Regeln, `season_players`, `match_day_awards`, `games.finished`/`notes`). Enddatum der Saison 2026/2027 korrigiert, Spielertypen nach `season_players` übernommen |
