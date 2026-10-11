"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MatchDay = { id: string; play_date: string; notes: string | null };
type Team = { id: string; team_number: number };
type Player = { id: string; name: string; nickname: string | null };
type TeamPlayer = { team_id: string; player_id: string };

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("de-AT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MatchDayPage() {
  const params = useParams<{ id: string }>();
  const matchDayId = params.id;

  const [matchDay, setMatchDay] = useState<MatchDay | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlayerId, setBusyPlayerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: md, error: mdError } = await supabase
      .from("match_days")
      .select("id, play_date, notes")
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

    const { data: playerRows } = await supabase
      .from("players")
      .select("id, name, nickname")
      .eq("active", true)
      .order("created_at", { ascending: true });

    const { data: presentRows } = await supabase
      .from("match_day_players")
      .select("player_id")
      .eq("match_day_id", matchDayId);

    const teamIds = (teamRows ?? []).map((t) => t.id);
    let teamPlayerRows: TeamPlayer[] = [];
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from("team_players")
        .select("team_id, player_id")
        .in("team_id", teamIds);
      teamPlayerRows = data ?? [];
    }

    setMatchDay(md);
    setTeams(teamRows ?? []);
    setPlayers(playerRows ?? []);
    setPresentIds(new Set((presentRows ?? []).map((r) => r.player_id)));
    setTeamPlayers(teamPlayerRows);
    setLoading(false);
  }, [matchDayId]);

  useEffect(() => {
    load();
  }, [load]);

  const teamOfPlayer = new Map<string, string>();
  teamPlayers.forEach((tp) => teamOfPlayer.set(tp.player_id, tp.team_id));

  const teamCounts = teams.map((team) => ({
    team,
    count: teamPlayers.filter((tp) => tp.team_id === team.id).length,
  }));

  async function removePlayer(playerId: string) {
    const teamIds = teams.map((t) => t.id);
    if (teamIds.length > 0) {
      const { error } = await supabase
        .from("team_players")
        .delete()
        .eq("player_id", playerId)
        .in("team_id", teamIds);
      if (error) throw error;
    }
    const { error } = await supabase
      .from("match_day_players")
      .delete()
      .eq("match_day_id", matchDayId)
      .eq("player_id", playerId);
    if (error) throw error;
  }

  async function chooseTeam(playerId: string, teamId: string) {
    setErrorMessage(null);
    setBusyPlayerId(playerId);
    try {
      const currentTeamId = teamOfPlayer.get(playerId);

      // Zweiter Tipp auf dasselbe Team = Spieler wieder entfernen
      if (currentTeamId === teamId) {
        await removePlayer(playerId);
      } else {
        if (!presentIds.has(playerId)) {
          const { error } = await supabase
            .from("match_day_players")
            .insert({ match_day_id: matchDayId, player_id: playerId });
          if (error && error.code !== "23505") throw error;
        }
        if (currentTeamId) {
          const { error } = await supabase
            .from("team_players")
            .delete()
            .eq("player_id", playerId)
            .eq("team_id", currentTeamId);
          if (error) throw error;
        }
        const { error } = await supabase
          .from("team_players")
          .insert({ team_id: teamId, player_id: playerId });
        if (error) throw error;
      }
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "unbekannter Fehler";
      setErrorMessage(`Fehler beim Speichern: ${message}`);
      await load();
    }
    setBusyPlayerId(null);
  }

  async function markAbsent(playerId: string) {
    setErrorMessage(null);
    setBusyPlayerId(playerId);
    try {
      await removePlayer(playerId);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "unbekannter Fehler";
      setErrorMessage(`Fehler beim Speichern: ${message}`);
      await load();
    }
    setBusyPlayerId(null);
  }

  // Zusammenfassung / Hinweis zur Teamgröße
  const totalAssigned = teamCounts.reduce((sum, t) => sum + t.count, 0);
  const maxCount = Math.max(0, ...teamCounts.map((t) => t.count));
  const minCount = teamCounts.length
    ? Math.min(...teamCounts.map((t) => t.count))
    : 0;
  const balanced = totalAssigned > 0 && maxCount - minCount <= 1;
  const warnings = teamCounts
    .filter((t) => totalAssigned > 0 && t.count < maxCount - 1)
    .map(
      (t) =>
        `Team ${t.team.team_number} hat ${maxCount - t.count} Spieler weniger als das größte Team.`
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p>Lädt…</p>
      </main>
    );
  }

  if (!matchDay) {
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

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <Link href="/matchdays" className="text-green-800 font-medium">
        ← Spieltage
      </Link>

      <h1 className="text-3xl font-bold mt-2 mb-1">
        {formatDate(matchDay.play_date)}
      </h1>
      {matchDay.notes && <p className="text-gray-600 mb-4">{matchDay.notes}</p>}

      <Link
        href={`/matchdays/${matchDayId}/games`}
        className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white mt-2"
      >
        ⚽ Zu den Spielen
      </Link>

      {/* Übersicht der Teams */}
      <section className="bg-white rounded-xl p-5 shadow mb-6 mt-4">
        <h2 className="font-semibold mb-3">Teams</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {teamCounts.map(({ team, count }) => (
            <span
              key={team.id}
              className="rounded-xl bg-green-100 px-4 py-2 font-semibold text-green-900"
            >
              Team {team.team_number}: {count}
            </span>
          ))}
        </div>
        <p className="text-sm text-gray-600 mb-2">
          {totalAssigned} Spieler zugeordnet
        </p>
        {totalAssigned === 0 && (
          <p className="text-gray-600">Noch keine Spieler zugeordnet.</p>
        )}
        {balanced && (
          <p className="text-green-700 font-semibold">
            ✓ Teams ausgeglichen
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} className="text-amber-700 font-semibold">
            ⚠ {w}
          </p>
        ))}
      </section>

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
      )}

      {/* Spielerliste */}
      <div className="space-y-4">
        {players.map((player) => {
          const currentTeamId = teamOfPlayer.get(player.id);
          const present = presentIds.has(player.id);
          const busy = busyPlayerId === player.id;

          return (
            <div
              key={player.id}
              className="bg-white rounded-xl p-5 shadow"
            >
              <p className="text-xl font-bold">
                {player.nickname ?? player.name}
              </p>
              {player.nickname && (
                <p className="text-gray-600 mb-2">{player.name}</p>
              )}

              <div className="flex flex-wrap gap-2 mt-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    disabled={busy}
                    onClick={() => chooseTeam(player.id, team.id)}
                    className={
                      "h-14 min-w-14 px-4 rounded-xl border text-xl font-bold disabled:opacity-50 " +
                      (currentTeamId === team.id
                        ? "bg-green-600 border-green-600 text-white"
                        : "bg-white border-gray-300 text-gray-800")
                    }
                  >
                    {team.team_number}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => markAbsent(player.id)}
                  className={
                    "h-14 px-4 rounded-xl border font-semibold disabled:opacity-50 " +
                    (!present
                      ? "bg-gray-200 border-gray-300 text-gray-700"
                      : "bg-white border-gray-300 text-gray-500")
                  }
                >
                  nicht da
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
