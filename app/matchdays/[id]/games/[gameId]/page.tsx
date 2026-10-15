"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function LiveGamePage() {
  const params = useParams<{ id: string; gameId: string }>();
  const matchDayId = params.id;
  const gameId = params.gameId;
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [teamNumbers, setTeamNumbers] = useState<Record<string, number>>({});
  const [teamNames, setTeamNames] = useState<Record<string, string[]>>({});
  const [nextGameId, setNextGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: gameRow, error: gameError } = await supabase
      .from("games")
      .select(
        "id, game_number, round_number, team_a_id, team_b_id, goals_team_a, goals_team_b, finished"
      )
      .eq("id", gameId)
      .single();

    if (gameError || !gameRow) {
      setErrorMessage("Spiel nicht gefunden.");
      setLoading(false);
      return;
    }

    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, team_number")
      .eq("match_day_id", matchDayId);

    const numbers: Record<string, number> = {};
    (teamRows ?? []).forEach((t) => {
      numbers[t.id] = t.team_number;
    });

    const teamIdList = (teamRows ?? []).map((t) => t.id);
    const names: Record<string, string[]> = {};
    if (teamIdList.length > 0) {
      const { data: tpRows } = await supabase
        .from("team_players")
        .select("team_id, players(nickname, name)")
        .in("team_id", teamIdList);
      (tpRows ?? []).forEach((row) => {
        const p = (Array.isArray(row.players) ? row.players[0] : row.players) as
          | { nickname: string | null; name: string }
          | null
          | undefined;
        if (!p) return;
        (names[row.team_id] ??= []).push(p.nickname ?? p.name);
      });
      Object.values(names).forEach((list) => list.sort((a, b) => a.localeCompare(b, "de")));
    }

    // Nächstes noch nicht beendetes Spiel dieses Spieltags
    const { data: openGames } = await supabase
      .from("games")
      .select("id, game_number")
      .eq("match_day_id", matchDayId)
      .eq("finished", false)
      .neq("id", gameId)
      .order("game_number", { ascending: true });

    const next =
      (openGames ?? []).find(
        (g) => (g.game_number ?? 0) > (gameRow.game_number ?? 0)
      ) ?? (openGames ?? [])[0];

    setGame(gameRow);
    setTeamNumbers(numbers);
    setTeamNames(names);
    setNextGameId(next ? next.id : null);
    setLoading(false);
  }, [gameId, matchDayId]);

  useEffect(() => {
    load();
  }, [load]);

  // Alle 3 Sekunden auffrischen, damit Eingaben von anderen Handys sichtbar werden
  useEffect(() => {
    const timer = setInterval(() => {
      if (!busy) load();
    }, 3000);
    return () => clearInterval(timer);
  }, [load, busy]);

  async function changeGoal(side: "a" | "b", delta: 1 | -1) {
    if (!game || game.finished || busy) return;
    setErrorMessage(null);
    setBusy(true);

    const { data, error } = await supabase.rpc("change_goal", {
      p_game_id: game.id,
      p_side: side,
      p_delta: delta,
    });

    if (error) {
      setErrorMessage(`Fehler: ${error.message}`);
    } else {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setGame({
          ...game,
          goals_team_a: row.new_a,
          goals_team_b: row.new_b,
        });
      }
    }
    setBusy(false);
  }

  async function finishGame() {
    if (!game || busy) return;
    setErrorMessage(null);
    setBusy(true);

    const { error } = await supabase.rpc("finish_game", {
      p_game_id: game.id,
    });

    if (error) {
      setErrorMessage(`Fehler: ${error.message}`);
      setConfirmFinish(false);
      await load();
      setBusy(false);
      return;
    }
    // Spiel beendet: automatisch zurück zur Spieleübersicht
    router.replace(`/matchdays/${matchDayId}/games`);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p>Lädt…</p>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p className="text-red-600 font-medium mb-4">
          {errorMessage ?? "Spiel nicht gefunden."}
        </p>
        <Link
          href={`/matchdays/${matchDayId}/games`}
          className="text-green-800 font-medium"
        >
          ← Zurück zu den Spielen
        </Link>
      </main>
    );
  }

  const teamAName = `Team ${teamNumbers[game.team_a_id] ?? "?"}`;
  const teamBName = `Team ${teamNumbers[game.team_b_id] ?? "?"}`;

  const sides = [
    {
      key: "a" as const,
      name: teamAName,
      goals: game.goals_team_a,
      players: (teamNames[game.team_a_id] ?? []).join(", "),
    },
    {
      key: "b" as const,
      name: teamBName,
      goals: game.goals_team_b,
      players: (teamNames[game.team_b_id] ?? []).join(", "),
    },
  ];

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <Link
        href={`/matchdays/${matchDayId}/games`}
        className="text-green-800 font-medium"
      >
        ← Alle Spiele
      </Link>

      <p className="text-gray-600 mt-2">
        Runde {game.round_number} · Spiel {game.game_number ?? "–"}
        {game.finished ? " · beendet" : ""}
      </p>
      <h1 className="text-3xl font-bold mb-5">
        {teamAName} : {teamBName}
      </h1>

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
      )}

      <div className="space-y-4">
        {sides.map((side) => (
          <section
            key={side.key}
            className="bg-white rounded-xl p-5 shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{side.name}</h2>
                {side.players && (
                  <p className="text-sm text-gray-600">{side.players}</p>
                )}
              </div>
              <span className="text-6xl font-bold tabular-nums">
                {side.goals}
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={busy || game.finished}
                onClick={() => changeGoal(side.key, 1)}
                className="flex-1 h-28 rounded-xl bg-green-600 text-white text-4xl font-bold disabled:opacity-40"
              >
                +1
              </button>
              <button
                type="button"
                disabled={busy || game.finished || side.goals === 0}
                onClick={() => changeGoal(side.key, -1)}
                className="w-24 h-28 rounded-xl border border-gray-300 text-2xl font-bold text-gray-700 disabled:opacity-40"
              >
                −1
              </button>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <Link
          href={`/matchdays/${matchDayId}/table`}
          className="block text-center rounded-xl border-2 border-green-600 bg-white px-4 py-3 text-lg font-semibold text-green-800"
        >
          📊 Live-Tabelle
        </Link>

        {!game.finished && !confirmFinish && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmFinish(true)}
            className="w-full rounded-xl bg-gray-800 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50"
          >
            Spiel beenden
          </button>
        )}

        {!game.finished && confirmFinish && (
          <div className="bg-white rounded-xl p-5 shadow">
            <p className="font-semibold mb-3">
              Endstand {game.goals_team_a} : {game.goals_team_b} bestätigen?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={finishGame}
                className="rounded-xl bg-green-600 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50"
              >
                Ja, beenden
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmFinish(false)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-4 text-lg font-semibold text-gray-800"
              >
                Zurück
              </button>
            </div>
          </div>
        )}

        {game.finished && (
          <p className="text-center text-green-800 font-semibold">
            Spiel beendet. Endstand {game.goals_team_a} : {game.goals_team_b}
          </p>
        )}

        {game.finished && nextGameId && (
          <Link
            href={`/matchdays/${matchDayId}/games/${nextGameId}`}
            className="block text-center rounded-xl bg-green-600 px-4 py-4 text-lg font-semibold text-white"
          >
            Weiter zum nächsten Spiel →
          </Link>
        )}
      </div>
    </main>
  );
}
