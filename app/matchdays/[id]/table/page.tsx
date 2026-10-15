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

export default function LiveTablePage() {
  const params = useParams<{ id: string }>();
  const matchDayId = params.id;

  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [names, setNames] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: teamRows, error } = await supabase
      .from("teams")
      .select("id, team_number")
      .eq("match_day_id", matchDayId)
      .order("team_number", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const { data: gameRows } = await supabase
      .from("games")
      .select("id, team_a_id, team_b_id, goals_team_a, goals_team_b, finished")
      .eq("match_day_id", matchDayId);

    const teamIds = (teamRows ?? []).map((t) => t.id);
    const nameMap: Record<string, string[]> = {};
    if (teamIds.length > 0) {
      const { data: tpRows } = await supabase
        .from("team_players")
        .select("team_id, players(nickname, name)")
        .in("team_id", teamIds);
      (tpRows ?? []).forEach((row) => {
        const p = (Array.isArray(row.players) ? row.players[0] : row.players) as
          | { nickname: string | null; name: string }
          | null
          | undefined;
        if (!p) return;
        (nameMap[row.team_id] ??= []).push(p.nickname ?? p.name);
      });
      Object.values(nameMap).forEach((list) =>
        list.sort((a, b) => a.localeCompare(b, "de"))
      );
    }

    setTeams(teamRows ?? []);
    setGames(gameRows ?? []);
    setNames(nameMap);
    setLoading(false);
  }, [matchDayId]);

  useEffect(() => {
    load();
  }, [load]);

  // Alle 5 Sekunden auffrischen
  useEffect(() => {
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  const finishedGames = games.filter((g) => g.finished);
  const runningGames = games.filter(
    (g) => !g.finished && (g.goals_team_a > 0 || g.goals_team_b > 0)
  );
  const teamName = (id: string) => {
    const t = teams.find((x) => x.id === id);
    return t ? `Team ${t.team_number}` : "?";
  };

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

  const ranking = [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.diff - a.diff ||
      b.goalsFor - a.goalsFor ||
      a.team.team_number - b.team.team_number
  );

  return (
    <main className="min-h-screen bg-green-100 p-4">
      <Link
        href={`/matchdays/${matchDayId}/games`}
        className="text-green-800 font-medium"
      >
        ← Spiele
      </Link>

      <h1 className="text-3xl font-bold mt-2 mb-1">📊 Live-Tabelle</h1>
      <p className="text-sm text-gray-600 mb-4">
        Nur beendete Spiele zählen. Aktualisiert sich automatisch.
      </p>

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
      )}
      {loading && <p className="text-gray-600">Lädt…</p>}

      {!loading && teams.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-center tabular-nums">
            <thead>
              <tr className="bg-green-700 text-white text-sm">
                <th className="py-2 pl-3 text-left">#</th>
                <th className="py-2 text-left">Team</th>
                <th className="py-2" title="Spiele">Sp</th>
                <th className="py-2">S</th>
                <th className="py-2">U</th>
                <th className="py-2">N</th>
                <th className="py-2">Tore</th>
                <th className="py-2">Diff</th>
                <th className="py-2 pr-3 font-bold">Pkt</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.team.id} className="border-t border-gray-200">
                  <td className="py-3 pl-3 text-left font-bold">{i + 1}</td>
                  <td className="py-3 text-left font-bold">
                    Team {r.team.team_number}
                  </td>
                  <td>{r.played}</td>
                  <td>{r.wins}</td>
                  <td>{r.draws}</td>
                  <td>{r.losses}</td>
                  <td>
                    {r.goalsFor}:{r.goalsAgainst}
                  </td>
                  <td>
                    {r.diff > 0 ? "+" : ""}
                    {r.diff}
                  </td>
                  <td className="pr-3 text-xl font-bold">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && finishedGames.length === 0 && (
        <p className="text-gray-700 mt-4">
          Noch kein Spiel beendet. Sobald das erste Spiel beendet ist, füllt
          sich die Tabelle.
        </p>
      )}

      {runningGames.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mt-4">
          <p className="font-semibold mb-1">Läuft gerade (zählt noch nicht)</p>
          {runningGames.map((g) => (
            <p key={g.id} className="text-lg">
              {teamName(g.team_a_id)} {g.goals_team_a} : {g.goals_team_b}{" "}
              {teamName(g.team_b_id)}
            </p>
          ))}
        </div>
      )}

      {!loading && teams.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mt-4 space-y-1">
          {teams.map((t) => (
            <p key={t.id} className="text-sm text-gray-700">
              <span className="font-bold">Team {t.team_number}:</span>{" "}
              {(names[t.id] ?? []).join(", ") || "–"}
            </p>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Sp = Spiele · S = Siege · U = Unentschieden · N = Niederlagen · Pkt =
        Punkte (Sieg 3, Unentschieden 1)
      </p>
    </main>
  );
}
