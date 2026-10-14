"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MatchDay = {
  id: string;
  play_date: string;
  notes: string | null;
  started_at: string | null;
};
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const { data: md, error: mdError } = await supabase
      .from("match_days")
      .select("id, play_date, notes, started_at")
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

    const { data: adminFlag } = await supabase.rpc("is_admin");

    setIsAdmin(adminFlag === true);
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

  // Nach dem Start ist die Zuordnung für alle außer Admins gesperrt
  const started = !!matchDay?.started_at;
  const locked = started && !isAdmin;

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
    if (locked) return;
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
    if (locked) return;
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

  async function startMatchDay() {
    setErrorMessage(null);
    setStarting(true);
    const { error } = await supabase.rpc("start_match_day", {
      p_match_day_id: matchDayId,
    });
    if (error) {
      setErrorMessage(`Fehler beim Starten: ${error.message}`);
    }
    setShowStartDialog(false);
    await load();
    setStarting(false);
  }

  async function reopenMatchDay() {
    setErrorMessage(null);
    const { error } = await supabase
      .from("match_days")
      .update({ started_at: null })
      .eq("id", matchDayId);
    if (error) {
      setErrorMessage(`Fehler beim Öffnen: ${error.message}`);
    }
    await load();
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

  const absentNames = players
    .filter((p) => !presentIds.has(p.id))
    .map((p) => p.nickname ?? p.name);

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

      {/* Status des Spieltags */}
      {started ? (
        <div className="rounded-xl border border-green-600 bg-white p-4 mb-4">
          <p className="font-semibold text-green-800">
            ✓ Spieltag gestartet
            {matchDay.started_at
              ? ` (${new Date(matchDay.started_at).toLocaleTimeString("de-AT", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Vienna",
                })} Uhr)`
              : ""}
          </p>
          {isAdmin ? (
            <>
              <p className="text-sm text-gray-600 mt-1">
                Als Admin kannst du die Zuordnung weiter ändern.
              </p>
              <button
                type="button"
                onClick={reopenMatchDay}
                className="mt-2 rounded-xl border border-gray-400 bg-white px-4 py-2 font-semibold text-gray-700"
              >
                🔓 Spieltag wieder öffnen
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              Die Teamzuordnung ist gesperrt. Änderungen nur durch einen Admin.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4">
          {!showStartDialog && (
            <button
              type="button"
              onClick={() => setShowStartDialog(true)}
              className="rounded-xl bg-green-700 px-6 py-4 text-lg font-semibold text-white"
            >
              ▶ Spieltag starten
            </button>
          )}

          {showStartDialog && (
            <div className="rounded-xl border-2 border-green-600 bg-white p-5">
              <p className="text-lg font-bold mb-2">
                Sind alle Spieler richtig zugeordnet?
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {teamCounts.map(({ team, count }) => (
                  <span
                    key={team.id}
                    className="rounded-xl bg-green-100 px-3 py-1 font-semibold text-green-900"
                  >
                    Team {team.team_number}: {count}
                  </span>
                ))}
              </div>
              {warnings.map((w) => (
                <p key={w} className="text-amber-700 font-semibold mb-1">
                  ⚠ {w}
                </p>
              ))}
              {totalAssigned === 0 && (
                <p className="text-amber-700 font-semibold mb-1">
                  ⚠ Noch kein Spieler ist einem Team zugeordnet.
                </p>
              )}
              <p className="text-gray-700 mt-2">
                <span className="font-semibold">Nicht da:</span>{" "}
                {absentNames.length > 0 ? absentNames.join(", ") : "niemand"}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Nach dem Start ist die Zuordnung gesperrt. Änderungen sind dann
                nur noch durch einen Admin möglich.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  disabled={starting}
                  onClick={startMatchDay}
                  className="rounded-xl bg-green-700 px-6 py-3 text-lg font-semibold text-white disabled:opacity-50"
                >
                  {starting ? "Startet…" : "Ja, starten"}
                </button>
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => setShowStartDialog(false)}
                  className="rounded-xl border border-gray-400 bg-white px-6 py-3 text-lg font-semibold text-gray-700"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-2">
        {started ? (
          <Link
            href={`/matchdays/${matchDayId}/games`}
            className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white"
          >
            ⚽ Zu den Spielen
          </Link>
        ) : (
          <span className="inline-block rounded-xl bg-gray-200 px-6 py-4 text-lg font-semibold text-gray-500">
            ⚽ Spiele (erst nach Start)
          </span>
        )}
        <Link
          href={`/matchdays/${matchDayId}/results`}
          className="inline-block rounded-xl bg-white border border-green-600 px-6 py-4 text-lg font-semibold text-green-800"
        >
          📊 Auswertung
        </Link>
      </div>

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
                    disabled={busy || locked}
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
                  disabled={busy || locked}
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
