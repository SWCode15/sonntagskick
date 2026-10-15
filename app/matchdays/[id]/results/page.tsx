"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = { id: string; team_number: number };
type Game = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  goals_team_a: number;
  goals_team_b: number;
  finished: boolean;
};
type TeamPlayer = { team_id: string; player_id: string };
type AwardType = "crown" | "strichl";
type Award = { award_type: AwardType; team_id: string };
type Player = { id: string; name: string; nickname: string | null };

type Row = {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
  points: number;
};

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function teamList(rows: Row[]) {
  return rows.map((r) => `Team ${r.team.team_number}`).join(" und ");
}

export default function ResultsPage() {
  const params = useParams<{ id: string }>();
  const matchDayId = params.id;

  const [playDate, setPlayDate] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [dayFinished, setDayFinished] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [awards, setAwards] = useState<Award[]>([]);
  const [picks, setPicks] = useState<Record<AwardType, string[]>>({
    crown: [],
    strichl: [],
  });
  const [asking, setAsking] = useState<AwardType | null>(null);
  const [clearing, setClearing] = useState<AwardType | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: md, error: mdError } = await supabase
      .from("match_days")
      .select("id, play_date, finished_at")
      .eq("id", matchDayId)
      .single();

    if (mdError || !md) {
      setErrorMessage("Spieltag nicht gefunden.");
      setLoading(false);
      return;
    }

    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, team_number")
      .eq("match_day_id", matchDayId)
      .order("team_number", { ascending: true });

    const { data: gameRows } = await supabase
      .from("games")
      .select(
        "id, team_a_id, team_b_id, goals_team_a, goals_team_b, finished"
      )
      .eq("match_day_id", matchDayId);

    const teamIds = (teamRows ?? []).map((t) => t.id);
    let tpRows: TeamPlayer[] = [];
    let playerRows: Player[] = [];
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from("team_players")
        .select("team_id, player_id")
        .in("team_id", teamIds);
      tpRows = data ?? [];

      const playerIds = tpRows.map((tp) => tp.player_id);
      if (playerIds.length > 0) {
        const { data: pData } = await supabase
          .from("players")
          .select("id, name, nickname")
          .in("id", playerIds);
        playerRows = pData ?? [];
      }
    }

    const { data: awardRows } = await supabase
      .from("match_day_awards")
      .select("award_type, team_id")
      .eq("match_day_id", matchDayId);
    const { data: adminFlag } = await supabase.rpc("is_admin");

    setPlayDate(md.play_date);
    setDayFinished(!!md.finished_at);
    setAwards((awardRows ?? []) as Award[]);
    setIsAdmin(adminFlag === true);
    setTeams(teamRows ?? []);
    setGames(gameRows ?? []);
    setTeamPlayers(tpRows);
    setPlayers(playerRows);
    setLoading(false);
  }, [matchDayId]);

  useEffect(() => {
    load();
  }, [load]);

  // Alle 5 Sekunden auffrischen, damit der Zwischenstand live mitläuft
  useEffect(() => {
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p>Lädt…</p>
      </main>
    );
  }

  if (!playDate) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p className="text-red-600 font-medium">
          {errorMessage ?? "Spieltag nicht gefunden."}
        </p>
      </main>
    );
  }

  // --- Tabelle aus den beendeten Spielen berechnen ---
  const finishedGames = games.filter((g) => g.finished);
  const allFinished = games.length > 0 && finishedGames.length === games.length;

  const rows: Row[] = teams.map((team) => {
    const row: Row = {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      diff: 0,
      points: 0,
    };

    finishedGames.forEach((g) => {
      let own: number;
      let other: number;
      if (g.team_a_id === team.id) {
        own = g.goals_team_a;
        other = g.goals_team_b;
      } else if (g.team_b_id === team.id) {
        own = g.goals_team_b;
        other = g.goals_team_a;
      } else {
        return;
      }
      row.played += 1;
      row.goalsFor += own;
      row.goalsAgainst += other;
      if (own > other) {
        row.wins += 1;
        row.points += 3;
      } else if (own === other) {
        row.draws += 1;
        row.points += 1;
      } else {
        row.losses += 1;
      }
    });

    row.diff = row.goalsFor - row.goalsAgainst;
    return row;
  });

  // Sortierung: Punkte, dann Tordifferenz
  const ranking = [...rows].sort(
    (a, b) => b.points - a.points || b.diff - a.diff
  );

  const hasResults = finishedGames.length > 0;
  const top = ranking[0];
  const bottom = ranking[ranking.length - 1];

  const crownRows =
    hasResults && top
      ? ranking.filter((r) => r.points === top.points && r.diff === top.diff)
      : [];
  const strichlRows =
    hasResults && bottom
      ? ranking.filter(
          (r) => r.points === bottom.points && r.diff === bottom.diff
        )
      : [];

  const allEqual =
    hasResults && crownRows.length === ranking.length && ranking.length > 1;
  const crownTie = !allEqual && crownRows.length > 1;
  const strichlTie = !allEqual && strichlRows.length > 1;

  // Entscheidungen von Hand (nur bei beendetem Spieltag gültig)
  const decidedTeams = (type: AwardType) =>
    awards.filter((a) => a.award_type === type).map((a) => a.team_id);
  const crownDecided = decidedTeams("crown");
  const strichlDecided = decidedTeams("strichl");
  const crownManual = dayFinished && crownDecided.length > 0;
  const strichlManual = dayFinished && strichlDecided.length > 0;

  const crownIds = new Set(
    crownManual
      ? crownDecided
      : allEqual
      ? []
      : crownRows.map((r) => r.team.id)
  );
  const strichlIds = new Set(
    strichlManual
      ? strichlDecided
      : allEqual
      ? []
      : strichlRows.map((r) => r.team.id)
  );
  const teamName = (teamId: string) => {
    const t = teams.find((x) => x.id === teamId);
    return t ? `Team ${t.team_number}` : "?";
  };

  function togglePick(type: AwardType, teamId: string) {
    setAsking(null);
    setPicks((prev) => ({
      ...prev,
      [type]: prev[type].includes(teamId)
        ? prev[type].filter((id) => id !== teamId)
        : [...prev[type], teamId],
    }));
  }

  async function saveAward(type: AwardType) {
    if (picks[type].length === 0 || busy) return;
    setErrorMessage(null);
    setBusy(true);
    const { error } = await supabase.from("match_day_awards").insert(
      picks[type].map((teamId) => ({
        match_day_id: matchDayId,
        award_type: type,
        team_id: teamId,
        notes: "von Hand entschieden",
      }))
    );
    if (error) {
      setErrorMessage(`Fehler beim Speichern: ${error.message}`);
    } else {
      setPicks((prev) => ({ ...prev, [type]: [] }));
      setAsking(null);
    }
    await load();
    setBusy(false);
  }

  async function clearAward(type: AwardType) {
    if (busy) return;
    setErrorMessage(null);
    setBusy(true);
    const { error } = await supabase
      .from("match_day_awards")
      .delete()
      .eq("match_day_id", matchDayId)
      .eq("award_type", type);
    if (error) {
      setErrorMessage(`Fehler beim Löschen: ${error.message}`);
    }
    setClearing(null);
    await load();
    setBusy(false);
  }

  function renderAward(type: AwardType) {
    const isCrown = type === "crown";
    const title = isCrown ? "👑 Krone" : "❌ Strichl";
    const manual = isCrown ? crownManual : strichlManual;
    const decided = isCrown ? crownDecided : strichlDecided;
    const tiedRows = isCrown ? crownRows : strichlRows;
    const tie = allEqual || (isCrown ? crownTie : strichlTie);
    const candidates = allEqual
      ? ranking.map((r) => r.team.id)
      : tiedRows.map((r) => r.team.id);
    const picked = picks[type];

    return (
      <div key={type}>
        <p className="font-semibold">
          {title}
          {!dayFinished && !manual ? " (vorläufig)" : ""}
        </p>

        {manual && (
          <>
            <p className="text-xl font-bold">
              {decided.map((id) => teamName(id)).join(" und ")}
            </p>
            <p className="text-sm text-gray-600">von Hand entschieden</p>
            {isAdmin && clearing !== type && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setClearing(type)}
                className="mt-2 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
              >
                Entscheidung ändern (Admin)
              </button>
            )}
            {isAdmin && clearing === type && (
              <div className="mt-2">
                <p className="font-semibold mb-2">
                  Entscheidung löschen und neu festlegen? Bist du sicher?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => clearAward(type)}
                    className="rounded-xl bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    Ja, löschen
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setClearing(null)}
                    className="rounded-xl border border-gray-300 px-4 py-2 font-semibold text-gray-800"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
            {!isAdmin && (
              <p className="text-xs text-gray-500 mt-1">
                Ändern kann nur ein Admin.
              </p>
            )}
          </>
        )}

        {!manual && !tie && (
          <p className="text-xl font-bold">{teamList(tiedRows)}</p>
        )}

        {!manual && tie && !dayFinished && (
          <p className="text-amber-700 font-medium">
            {allEqual
              ? "Alle Teams gleichauf."
              : "Gleichstand bei Punkten und Tordifferenz."}{" "}
            Die Entscheidung von Hand ist möglich, sobald der Spieltag
            beendet ist.
          </p>
        )}

        {!manual && tie && dayFinished && (
          <div className="mt-1">
            <p className="text-amber-700 font-medium mb-2">
              {allEqual
                ? "Alle Teams gleichauf."
                : "Gleichstand bei Punkten und Tordifferenz."}{" "}
              Wer bekommt {isCrown ? "die Krone" : "das Strichl"}? Mehrere
              Teams sind möglich.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {candidates.map((teamId) => (
                <button
                  key={teamId}
                  type="button"
                  disabled={busy}
                  onClick={() => togglePick(type, teamId)}
                  className={
                    "h-14 px-4 rounded-xl border text-lg font-bold disabled:opacity-50 " +
                    (picked.includes(teamId)
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-white border-gray-300 text-gray-800")
                  }
                >
                  {teamName(teamId)}
                </button>
              ))}
            </div>
            {picked.length > 0 && asking !== type && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAsking(type)}
                className="rounded-xl bg-gray-800 px-4 py-3 font-semibold text-white"
              >
                Festlegen
              </button>
            )}
            {picked.length > 0 && asking === type && (
              <div>
                <p className="font-semibold mb-2">
                  {isCrown ? "Krone" : "Strichl"} für{" "}
                  {picked.map((id) => teamName(id)).join(" und ")}. Bist du
                  sicher?
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveAward(type)}
                    className="rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    Ja, festlegen
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setAsking(null)}
                    className="rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-800"
                  >
                    Zurück
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Hinweis: Teams mit unterschiedlich vielen beendeten Spielen
  const playedCounts = ranking.map((r) => r.played);
  const unequalGames =
    hasResults &&
    playedCounts.length > 1 &&
    Math.max(...playedCounts) !== Math.min(...playedCounts);
  const playedOverview = [...rows]
    .sort((a, b) => a.team.team_number - b.team.team_number)
    .map((r) => `Team ${r.team.team_number}: ${r.played}`)
    .join(" · ");

  const playerName = (playerId: string) => {
    const p = players.find((pl) => pl.id === playerId);
    return p ? p.nickname ?? p.name : "?";
  };

  const membersOf = (teamId: string) =>
    teamPlayers
      .filter((tp) => tp.team_id === teamId)
      .map((tp) => playerName(tp.player_id))
      .sort((a, b) => a.localeCompare(b, "de"));

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <Link
        href={`/matchdays/${matchDayId}`}
        className="text-green-800 font-medium"
      >
        ← Spieltag
      </Link>

      <h1 className="text-3xl font-bold mt-2 mb-1">📊 Auswertung</h1>
      <p className="text-gray-600 mb-2">{formatDate(playDate)}</p>
      <p className="text-sm text-gray-600 mb-6">
        {finishedGames.length} von {games.length} Spielen beendet
        {dayFinished ? " · Spieltag beendet (Endstand)" : games.length > 0 && !allFinished ? " (Zwischenstand)" : ""}
      </p>

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
      )}

      {!hasResults && (
        <p className="bg-white rounded-xl p-5 shadow text-gray-700">
          Noch kein Spiel beendet. Sobald das erste Spiel beendet ist, erscheint
          hier die Tabelle.
        </p>
      )}

      {hasResults && (
        <>
          {/* Hinweis bei unterschiedlicher Spielanzahl */}
          {unequalGames && (
            <section className="rounded-xl border border-amber-400 bg-amber-50 p-5 mb-6">
              <p className="font-semibold text-amber-800">
                ⚠ Die Teams haben unterschiedlich viele Spiele
              </p>
              <p className="text-amber-800 text-sm mt-1">
                {playedOverview}
              </p>
              <p className="text-amber-800 text-sm mt-1">
                {allFinished
                  ? "Alle angelegten Spiele sind beendet, aber die Teams haben nicht gleich oft gespielt. Die Wertung ist so nicht fair vergleichbar. Bitte prüfen, ob Spiele fehlen oder zu viel angelegt wurden."
                  : "Das ist während des Spieltags normal. Krone und Strichl sind erst aussagekräftig, wenn alle Teams gleich viele Spiele haben."}
              </p>
            </section>
          )}

          {/* Krone und Strichl */}
          <section className="bg-white rounded-xl p-5 shadow mb-6 space-y-5">
            {renderAward("crown")}
            {renderAward("strichl")}
          </section>

          {/* Tabelle */}
          <div className="space-y-4">
            {ranking.map((row, index) => {
              const members = membersOf(row.team.id);
              return (
                <section
                  key={row.team.id}
                  className="bg-white rounded-xl p-5 shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold">
                      {index + 1}. Team {row.team.team_number}
                      {crownIds.has(row.team.id) ? " 👑" : ""}
                      {strichlIds.has(row.team.id) ? " ❌" : ""}
                    </h2>
                    <span className="text-3xl font-bold">
                      {row.points}
                      <span className="text-base font-semibold text-gray-500">
                        {" "}
                        Pkt
                      </span>
                    </span>
                  </div>

                  <p className="text-gray-700">
                    Tore {row.goalsFor}:{row.goalsAgainst} (
                    {row.diff > 0 ? "+" : ""}
                    {row.diff}) · {row.played} Spiele
                  </p>
                  <p className="text-gray-700 mb-2">
                    {row.wins} Siege · {row.draws} Unentschieden ·{" "}
                    {row.losses} Niederlagen
                  </p>

                  <p className="text-sm text-gray-500">
                    {members.length > 0
                      ? members.join(", ")
                      : "Keine Spieler zugeordnet"}
                  </p>
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
