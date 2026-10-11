"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = { id: string; team_number: number };
type Game = {
  id: string;
  game_number: number | null;
  round_number: number;
  team_a_id: string;
  team_b_id: string;
  goals_team_a: number;
  goals_team_b: number;
  finished: boolean;
};
type NewGame = {
  match_day_id: string;
  game_number: number;
  round_number: number;
  team_a_id: string;
  team_b_id: string;
};

const STANDARD_ROUNDS = 4;

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function GamesPage() {
  const params = useParams<{ id: string }>();
  const matchDayId = params.id;

  const [playDate, setPlayDate] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formular "Einzelnes Spiel"
  const [freeA, setFreeA] = useState<string | null>(null);
  const [freeB, setFreeB] = useState<string | null>(null);
  const [freeRound, setFreeRound] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data: md, error: mdError } = await supabase
      .from("match_days")
      .select("id, play_date")
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
        "id, game_number, round_number, team_a_id, team_b_id, goals_team_a, goals_team_b, finished"
      )
      .eq("match_day_id", matchDayId)
      .order("game_number", { ascending: true, nullsFirst: false });

    setPlayDate(md.play_date);
    setTeams(teamRows ?? []);
    setGames(gameRows ?? []);
    setLoading(false);
  }, [matchDayId]);

  useEffect(() => {
    load();
  }, [load]);

  const teamLabel = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team ? `Team ${team.team_number}` : "?";
  };

  const nextGameNumber =
    games.reduce((max, g) => Math.max(max, g.game_number ?? 0), 0) + 1;
  const lastRound = games.reduce((max, g) => Math.max(max, g.round_number), 0);

  async function insertGames(rows: NewGame[]) {
    setErrorMessage(null);
    setBusy(true);
    const { error } = await supabase.from("games").insert(rows);
    if (error) {
      setErrorMessage(`Fehler beim Speichern: ${error.message}`);
    }
    await load();
    setBusy(false);
  }

  function makeGame(
    number: number,
    round: number,
    a: string,
    b: string
  ): NewGame {
    return {
      match_day_id: matchDayId,
      game_number: number,
      round_number: round,
      team_a_id: a,
      team_b_id: b,
    };
  }

  // --- Standard mit 3 Teams ---
  const isThreeTeams = teams.length === 3;

  async function startWithPairing(a: string, b: string) {
    await insertGames([makeGame(nextGameNumber, 1, a, b)]);
  }

  async function chooseStayer(stayerId: string) {
    const first = games[0];
    const third = teams.find(
      (t) => t.id !== first.team_a_id && t.id !== first.team_b_id
    );
    if (!third) return;
    const other =
      stayerId === first.team_a_id ? first.team_b_id : first.team_a_id;
    await insertGames([
      makeGame(nextGameNumber, 1, stayerId, third.id),
      makeGame(nextGameNumber + 1, 1, other, third.id),
    ]);
  }

  function roundRows(roundNo: number, startNumber: number): NewGame[] {
    // Reihenfolge der ersten Runde wiederholen
    const pattern = games.slice(0, 3);
    return pattern.map((g, i) =>
      makeGame(startNumber + i, roundNo, g.team_a_id, g.team_b_id)
    );
  }

  async function addNextRound() {
    await insertGames(roundRows(lastRound + 1, nextGameNumber));
  }

  async function addAllRounds() {
    const rows: NewGame[] = [];
    let number = nextGameNumber;
    for (let round = lastRound + 1; round <= STANDARD_ROUNDS; round++) {
      rows.push(...roundRows(round, number));
      number += 3;
    }
    await insertGames(rows);
  }

  // --- Einzelnes Spiel ---
  const pairsPerRound = (teams.length * (teams.length - 1)) / 2;
  const defaultRound =
    pairsPerRound > 0 ? Math.floor(games.length / pairsPerRound) + 1 : 1;
  const roundForFree = freeRound ?? defaultRound;

  async function addFreeGame() {
    if (!freeA || !freeB) {
      setErrorMessage("Bitte beide Teams wählen.");
      return;
    }
    if (freeA === freeB) {
      setErrorMessage("Ein Team kann nicht gegen sich selbst spielen.");
      return;
    }
    await insertGames([makeGame(nextGameNumber, roundForFree, freeA, freeB)]);
    setFreeA(null);
    setFreeB(null);
    setFreeRound(null);
  }

  async function removeGame(gameId: string) {
    setErrorMessage(null);
    setBusy(true);
    const { error } = await supabase.from("games").delete().eq("id", gameId);
    if (error) {
      setErrorMessage(`Fehler beim Entfernen: ${error.message}`);
    }
    await load();
    setBusy(false);
  }

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
        <p className="text-red-600 font-medium mb-4">
          {errorMessage ?? "Spieltag nicht gefunden."}
        </p>
        <Link href="/matchdays" className="text-green-800 font-medium">
          ← Zurück zu den Spieltagen
        </Link>
      </main>
    );
  }

  // Spiele nach Runden gruppieren
  const rounds = Array.from(new Set(games.map((g) => g.round_number))).sort(
    (a, b) => a - b
  );

  const firstGame = games[0];
  const threeTeamStep: "start" | "stayer" | "rounds" | null = !isThreeTeams
    ? null
    : games.length === 0
    ? "start"
    : games.length === 1
    ? "stayer"
    : games.length % 3 === 0
    ? "rounds"
    : null;

  const btnBase =
    "rounded-xl border px-4 py-4 text-lg font-semibold disabled:opacity-50";

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <Link
        href={`/matchdays/${matchDayId}`}
        className="text-green-800 font-medium"
      >
        ← Spieltag
      </Link>

      <h1 className="text-3xl font-bold mt-2 mb-1">⚽ Spiele</h1>
      <p className="text-gray-600 mb-6">{formatDate(playDate)}</p>

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
      )}

      {/* Liste der Spiele */}
      {games.length === 0 && (
        <p className="text-gray-600 mb-6">Noch kein Spiel angelegt.</p>
      )}

      <div className="space-y-5 mb-8">
        {rounds.map((round) => (
          <section key={round}>
            <h2 className="font-bold text-lg mb-2">Runde {round}</h2>
            <div className="space-y-2">
              {games
                .filter((g) => g.round_number === round)
                .map((game) => {
                  const removable =
                    !game.finished &&
                    game.goals_team_a === 0 &&
                    game.goals_team_b === 0;
                  return (
                    <div
                      key={game.id}
                      className="bg-white rounded-xl p-4 shadow flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm text-gray-500">
                          Spiel {game.game_number ?? "–"}
                          {game.finished ? " · beendet" : ""}
                        </p>
                        <p className="text-xl font-bold">
                          {teamLabel(game.team_a_id)} :{" "}
                          {teamLabel(game.team_b_id)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold">
                          {game.goals_team_a} : {game.goals_team_b}
                        </span>
                        <Link
                          href={`/matchdays/${matchDayId}/games/${game.id}`}
                          className="rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                          {game.finished ? "Ansehen" : "Zählen"}
                        </Link>
                        {removable && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeGame(game.id)}
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                          >
                            Entfernen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {/* Standard mit 3 Teams */}
      {threeTeamStep === "start" && (
        <section className="bg-white rounded-xl p-5 shadow mb-6">
          <h2 className="font-semibold mb-3">Erstes Spiel wählen</h2>
          <div className="grid grid-cols-1 gap-2">
            {[
              [teams[0], teams[1]],
              [teams[0], teams[2]],
              [teams[1], teams[2]],
            ].map(([a, b]) => (
              <button
                key={`${a.id}-${b.id}`}
                type="button"
                disabled={busy}
                onClick={() => startWithPairing(a.id, b.id)}
                className={`${btnBase} bg-green-600 border-green-600 text-white`}
              >
                Team {a.team_number} : Team {b.team_number}
              </button>
            ))}
          </div>
        </section>
      )}

      {threeTeamStep === "stayer" && firstGame && (
        <section className="bg-white rounded-xl p-5 shadow mb-6">
          <h2 className="font-semibold mb-1">Welches Team bleibt?</h2>
          <p className="text-sm text-gray-600 mb-3">
            Danach stehen Spiel 2 und 3 der Runde fest.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[firstGame.team_a_id, firstGame.team_b_id].map((teamId) => (
              <button
                key={teamId}
                type="button"
                disabled={busy}
                onClick={() => chooseStayer(teamId)}
                className={`${btnBase} bg-green-600 border-green-600 text-white`}
              >
                {teamLabel(teamId)}
              </button>
            ))}
          </div>
        </section>
      )}

      {threeTeamStep === "rounds" && (
        <section className="bg-white rounded-xl p-5 shadow mb-6 space-y-2">
          <h2 className="font-semibold mb-1">Weitere Runden</h2>
          <p className="text-sm text-gray-600 mb-2">
            Die Reihenfolge der ersten Runde wird wiederholt.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={addNextRound}
            className={`${btnBase} w-full bg-green-600 border-green-600 text-white`}
          >
            Runde {lastRound + 1} anlegen
          </button>
          {lastRound < STANDARD_ROUNDS && (
            <button
              type="button"
              disabled={busy}
              onClick={addAllRounds}
              className={`${btnBase} w-full bg-white border-green-600 text-green-800`}
            >
              Alle Runden bis Runde {STANDARD_ROUNDS} anlegen
            </button>
          )}
        </section>
      )}

      {/* Einzelnes Spiel (immer möglich) */}
      <section className="bg-white rounded-xl p-5 shadow">
        <h2 className="font-semibold mb-3">Einzelnes Spiel hinzufügen</h2>

        <p className="text-sm text-gray-600 mb-1">Erstes Team</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => setFreeA(team.id)}
              className={
                "h-14 min-w-14 px-4 rounded-xl border text-xl font-bold " +
                (freeA === team.id
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-gray-300 text-gray-800")
              }
            >
              {team.team_number}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-600 mb-1">gegen</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => setFreeB(team.id)}
              className={
                "h-14 min-w-14 px-4 rounded-xl border text-xl font-bold " +
                (freeB === team.id
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-gray-300 text-gray-800")
              }
            >
              {team.team_number}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-600 mb-1">Runde</p>
        <div className="flex items-center gap-4 mb-4">
          <button
            type="button"
            onClick={() => setFreeRound(Math.max(1, roundForFree - 1))}
            className="h-12 w-12 rounded-xl border border-gray-300 text-2xl font-bold"
          >
            −
          </button>
          <span className="text-2xl font-bold w-8 text-center">
            {roundForFree}
          </span>
          <button
            type="button"
            onClick={() => setFreeRound(roundForFree + 1)}
            className="h-12 w-12 rounded-xl border border-gray-300 text-2xl font-bold"
          >
            +
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={addFreeGame}
          className={`${btnBase} w-full bg-green-600 border-green-600 text-white`}
        >
          Spiel anlegen
        </button>
      </section>
    </main>
  );
}
