"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MatchDay = {
  id: string;
  play_date: string;
  notes: string | null;
  season_id: string;
  started_at: string | null;
  finished_at: string | null;
  entry_locked: boolean;
  seasons?: { season_name: string } | { season_name: string }[] | null;
  excluded_type: "not_played" | "not_rated" | null;
  excluded_reason: string | null;
};
type GameRow = {
  id: string;
  team_a_id: string;
  team_b_id: string;
  finished: boolean;
  goals_team_a: number;
  goals_team_b: number;
};
type Team = { id: string; team_number: number };
type Player = { id: string; name: string; nickname: string | null };
type TeamPlayer = { team_id: string; player_id: string };

const TYPE_LABELS: Record<string, string> = {
  stamm: "Stammspieler",
  springer: "Springer",
  gast: "Gast",
};
const FILTERS = [
  { value: "alle", label: "Alle" },
  { value: "stamm", label: "Stamm" },
  { value: "springer", label: "Springer" },
  { value: "gast", label: "Gast" },
];

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
  const [role, setRole] = useState<"admin" | "writer" | "reader">("reader");
  const [canEdit, setCanEdit] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [starting, setStarting] = useState(false);
  const [gameRows, setGameRows] = useState<GameRow[]>([]);
  const [awardTypes, setAwardTypes] = useState<string[]>([]);
  // Typ (Stamm/Springer/Gast) der Spieler in der Saison dieses Spieltags
  const [typeByPlayer, setTypeByPlayer] = useState<Map<string, string>>(
    new Map()
  );
  const [typeFilter, setTypeFilter] = useState("alle");
  // Reiter: null = automatisch (ohne Anwesende: Anwesenheit, sonst Teams)
  const [tab, setTab] = useState<"presence" | "teams" | null>(null);
  const router = useRouter();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    const { data: md, error: mdError } = await supabase
      .from("match_days")
      .select(
        "id, play_date, notes, season_id, started_at, finished_at, entry_locked, excluded_type, excluded_reason, seasons(season_name)"
      )
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

    const { data: seasonPlayerRows } = await supabase
      .from("season_players")
      .select("player_id, player_type")
      .eq("season_id", md.season_id);
    const types = new Map<string, string>();
    (seasonPlayerRows ?? []).forEach((sp) =>
      types.set(sp.player_id as string, sp.player_type as string)
    );

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

    const { data: gamesData } = await supabase
      .from("games")
      .select("id, team_a_id, team_b_id, finished, goals_team_a, goals_team_b")
      .eq("match_day_id", matchDayId);

    const { data: awardRows } = await supabase
      .from("match_day_awards")
      .select("award_type")
      .eq("match_day_id", matchDayId);

    const { data: adminFlag } = await supabase.rpc("is_admin");
    const { data: roleData } = await supabase.rpc("my_role");
    const { data: editFlag } = await supabase.rpc("can_edit_match_day", {
      p_match_day_id: matchDayId,
    });

    setRole(
      roleData === "admin" || roleData === "writer" ? roleData : "reader"
    );
    setCanEdit(editFlag === true);
    setGameRows(gamesData ?? []);
    setAwardTypes((awardRows ?? []).map((a) => a.award_type as string));
    setIsAdmin(adminFlag === true);
    setMatchDay(md);
    setTeams(teamRows ?? []);
    setPlayers(playerRows ?? []);
    setTypeByPlayer(types);
    setPresentIds(new Set((presentRows ?? []).map((r) => r.player_id)));
    setTeamPlayers(teamPlayerRows);
    setLoading(false);
  }, [matchDayId]);

  useEffect(() => {
    load();
  }, [load]);

  // Nach dem Start ist die Zuordnung für alle außer Admins gesperrt
  const started = !!matchDay?.started_at;
  const dayFinished = !!matchDay?.finished_at;
  // Gesperrt: kein Recht zum Eintragen oder nach dem Start (außer Admin)
  const locked = !canEdit || (started && !isAdmin);

  const finishedCount = gameRows.filter((g) => g.finished).length;
  const inProgressCount = gameRows.filter(
    (g) => !g.finished && (g.goals_team_a > 0 || g.goals_team_b > 0)
  ).length;
  const unplayedCount = gameRows.filter(
    (g) => !g.finished && g.goals_team_a === 0 && g.goals_team_b === 0
  ).length;

  // Gleichstand bei Krone/Strichl, der noch von Hand entschieden werden muss?
  const standings = teams.map((team) => {
    let points = 0;
    let diff = 0;
    gameRows
      .filter((g) => g.finished)
      .forEach((g) => {
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
        diff += own - other;
        points += own > other ? 3 : own === other ? 1 : 0;
      });
    return { points, diff };
  });
  const sortedStandings = [...standings].sort(
    (a, b) => b.points - a.points || b.diff - a.diff
  );
  const topS = sortedStandings[0];
  const bottomS = sortedStandings[sortedStandings.length - 1];
  const hasFinishedGames = gameRows.some((g) => g.finished);
  const crownTieOpen =
    hasFinishedGames &&
    !awardTypes.includes("crown") &&
    standings.filter((s) => s.points === topS.points && s.diff === topS.diff)
      .length > 1;
  const strichlTieOpen =
    hasFinishedGames &&
    !awardTypes.includes("strichl") &&
    standings.filter(
      (s) => s.points === bottomS.points && s.diff === bottomS.diff
    ).length > 1;
  const decisionNeeded = dayFinished && (crownTieOpen || strichlTieOpen);

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

  async function togglePresence(playerId: string) {
    if (locked) return;
    setErrorMessage(null);
    setBusyPlayerId(playerId);
    try {
      if (presentIds.has(playerId)) {
        await removePlayer(playerId);
      } else {
        const { error } = await supabase
          .from("match_day_players")
          .insert({ match_day_id: matchDayId, player_id: playerId });
        if (error && error.code !== "23505") throw error;
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

  async function endMatchDay() {
    setErrorMessage(null);
    setEnding(true);
    const { error } = await supabase.rpc("end_match_day", {
      p_match_day_id: matchDayId,
    });
    if (error) {
      setErrorMessage(`Fehler beim Beenden: ${error.message}`);
      setShowEndDialog(false);
      await load();
      setEnding(false);
      return;
    }
    // Spieltag beendet: direkt zur Auswertung (dort ggf. Gleichstand entscheiden)
    router.push(`/matchdays/${matchDayId}/results`);
  }

  async function toggleEntryLock() {
    if (!matchDay) return;
    setErrorMessage(null);
    const { error } = await supabase
      .from("match_days")
      .update({ entry_locked: !matchDay.entry_locked })
      .eq("id", matchDayId);
    if (error) {
      setErrorMessage(`Fehler: ${error.message}`);
    }
    await load();
  }

  async function undoEnd() {
    setErrorMessage(null);
    // Entscheidungen bei Gleichstand gelten nur für den beendeten Stand
    await supabase
      .from("match_day_awards")
      .delete()
      .eq("match_day_id", matchDayId);
    const { error } = await supabase
      .from("match_days")
      .update({ finished_at: null })
      .eq("id", matchDayId);
    if (error) {
      setErrorMessage(`Fehler: ${error.message}`);
    }
    await load();
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

  // Hinweis vor dem Start: normalerweise 4 Spieler pro Team
  const startHints = teamCounts
    .filter((t) => t.count !== 4)
    .map(
      (t) =>
        `Team ${t.team.team_number} hat ${t.count} Spieler (normal sind 4).`
    );

  const absentNames = players
    .filter((p) => !presentIds.has(p.id) && typeByPlayer.has(p.id))
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
      {(() => {
        const s = Array.isArray(matchDay.seasons)
          ? matchDay.seasons[0]
          : matchDay.seasons;
        return s ? (
          <p className="text-sm text-gray-600 mb-1">Saison {s.season_name}</p>
        ) : null;
      })()}
      {matchDay.notes && <p className="text-gray-600 mb-4">{matchDay.notes}</p>}

      {matchDay.excluded_type && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 mb-4 text-red-900">
          <p className="font-bold">
            🚫{" "}
            {matchDay.excluded_type === "not_played"
              ? "Spieltag nicht stattgefunden"
              : "Spieltag nicht gewertet"}
          </p>
          <p className="mt-1">Begründung: {matchDay.excluded_reason}</p>
        </div>
      )}

      {/* Status des Spieltags */}
      {started ? (
        <div className="space-y-3 mb-4">
          <div className="rounded-xl border border-green-600 bg-white p-4">
            <p className="font-semibold text-green-800">
              ✓ Spieltag gestartet
              {matchDay.started_at
                ? ` (${new Date(matchDay.started_at).toLocaleTimeString(
                    "de-AT",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Vienna",
                    }
                  )} Uhr)`
                : ""}
            </p>
            {dayFinished ? (
              <p className="font-semibold text-green-800 mt-1">
                🏁 Spieltag beendet
                {matchDay.finished_at
                  ? ` (${new Date(matchDay.finished_at).toLocaleTimeString(
                      "de-AT",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Vienna",
                      }
                    )} Uhr)`
                  : ""}
              </p>
            ) : null}
            {isAdmin ? (
              <p className="text-sm text-gray-600 mt-1">
                Als Admin kannst du die Zuordnung weiter ändern.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mt-1">
                Die Teamzuordnung ist gesperrt. Änderungen nur durch einen
                Admin.
              </p>
            )}
          </div>

          {decisionNeeded && (
            <Link
              href={`/matchdays/${matchDayId}/results`}
              className="block rounded-xl border-2 border-amber-500 bg-amber-50 p-4 font-semibold text-amber-900"
            >
              ⚠ Entscheidung nötig: Gleichstand bei{" "}
              {crownTieOpen && strichlTieOpen
                ? "Krone und Strichl"
                : crownTieOpen
                ? "der Krone"
                : "dem Strichl"}
              . Hier tippen und in der Auswertung entscheiden →
            </Link>
          )}

          {/* Spieltag beenden (mit Kontrollfrage) */}
          {canEdit && !dayFinished && !showEndDialog && (
            <button
              type="button"
              onClick={() => setShowEndDialog(true)}
              className="rounded-xl bg-gray-800 px-6 py-4 text-lg font-semibold text-white"
            >
              🏁 Spieltag beenden
            </button>
          )}

          {canEdit && !dayFinished && showEndDialog && (
            <div className="rounded-xl border-2 border-amber-500 bg-white p-5">
              <p className="text-lg font-bold mb-2">
                Spieltag wirklich beenden?
              </p>
              <p className="text-gray-700 mb-1">
                {finishedCount === 1
                  ? "1 Spiel ist beendet"
                  : `${finishedCount} Spiele sind beendet`}
                , das Ergebnis zählt bis hierher.
              </p>
              {unplayedCount > 0 && (
                <p className="text-gray-700 mb-1">
                  {unplayedCount === 1
                    ? "1 nicht gespieltes Spiel wird entfernt."
                    : `${unplayedCount} nicht gespielte Spiele werden entfernt.`}
                </p>
              )}
              {inProgressCount > 0 && (
                <p className="text-red-600 font-semibold mb-1">
                  ⚠ Es läuft noch ein Spiel mit Toren. Bitte zuerst bei dem
                  Spiel „Spiel beenden“ tippen.
                </p>
              )}
              <p className="font-semibold mt-3 mb-2">Bist du sicher?</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={ending || inProgressCount > 0}
                  onClick={endMatchDay}
                  className="rounded-xl bg-gray-800 px-6 py-3 text-lg font-semibold text-white disabled:opacity-50"
                >
                  {ending ? "Beendet…" : "Ja, Spieltag beenden"}
                </button>
                <button
                  type="button"
                  disabled={ending}
                  onClick={() => setShowEndDialog(false)}
                  className="rounded-xl border border-gray-400 bg-white px-6 py-3 text-lg font-semibold text-gray-700"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Nur Admins */}
          {isAdmin && dayFinished && (
            <button
              type="button"
              onClick={undoEnd}
              className="rounded-xl border border-gray-400 bg-white px-4 py-2 font-semibold text-gray-700"
            >
              🔓 Beenden rückgängig machen
            </button>
          )}
          {isAdmin && !dayFinished && (
            <button
              type="button"
              onClick={reopenMatchDay}
              className="rounded-xl border border-gray-400 bg-white px-4 py-2 font-semibold text-gray-700"
            >
              🔓 Spieltag wieder öffnen (Start zurücknehmen)
            </button>
          )}
          {isAdmin && (
            <Link
              href={`/matchdays/${matchDayId}/edit`}
              className="inline-block rounded-xl border border-green-700 bg-white px-4 py-2 font-semibold text-green-800"
            >
              ⚙ Spieltag verwalten
            </Link>
          )}
        </div>
      ) : (
        <div className="mb-4">
          {canEdit && !showStartDialog && (
            <button
              type="button"
              onClick={() => setShowStartDialog(true)}
              className="rounded-xl bg-green-700 px-6 py-4 text-lg font-semibold text-white"
            >
              ▶ Spieltag starten
            </button>
          )}

          {canEdit && showStartDialog && (
            <div className="rounded-xl border-2 border-green-600 bg-white p-5">
              <p className="text-lg font-bold mb-2">
                Spieltag wirklich starten?
              </p>
              <p className="text-gray-700 mb-2">
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
              {startHints.length > 0 && totalAssigned > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-400 p-3 mb-2">
                  <p className="font-semibold text-amber-800 mb-1">
                    Hinweis: Die Teams sind nicht gleich groß.
                  </p>
                  {startHints.map((h) => (
                    <p key={h} className="text-amber-800">
                      {h}
                    </p>
                  ))}
                  <p className="text-sm text-amber-800 mt-1">
                    Das ist kein Fehler. Prüfe nur, ob wirklich alle richtig
                    zugeordnet sind.
                  </p>
                </div>
              )}
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
              <p className="font-semibold mt-3 mb-2">Bist du sicher?</p>
              <div className="flex flex-wrap gap-3">
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
          {isAdmin && (
            <div className="mt-3">
              <Link
                href={`/matchdays/${matchDayId}/edit`}
                className="inline-block rounded-xl border border-green-700 bg-white px-4 py-2 font-semibold text-green-800"
              >
                ⚙ Spieltag verwalten
              </Link>
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

      {/* Admin: Eintragen für diesen Spieltag sperren oder freigeben */}
      {isAdmin && (
        <div className="rounded-xl bg-white p-4 mt-4 shadow">
          <p className="text-sm text-gray-600 mb-2">
            Admin: Das Konto „Eintragen“ darf am Spieltag selbst eintragen.{" "}
            {matchDay.entry_locked
              ? "Derzeit ist es für diesen Spieltag gesperrt."
              : "Derzeit ist es nicht gesperrt."}
          </p>
          <button
            type="button"
            onClick={toggleEntryLock}
            className="rounded-xl border border-gray-400 bg-white px-4 py-2 font-semibold text-gray-700"
          >
            {matchDay.entry_locked
              ? "🔓 Eintragen freigeben"
              : "🔒 Eintragen sperren"}
          </button>
        </div>
      )}

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

      {/* Hinweis, wenn dieses Konto nichts eintragen darf */}
      {!canEdit && (
        <p className="rounded-xl border border-gray-400 bg-white p-4 mb-4 font-semibold text-gray-700">
          {role === "reader"
            ? "👁 Nur ansehen. Mit diesem Zugang kann nichts eingetragen werden."
            : matchDay.entry_locked
            ? "🔒 Eintragen ist für diesen Spieltag gesperrt."
            : "📅 Eintragen ist nur am Tag des Spieltags möglich."}
        </p>
      )}

      {/* Reiter: Anwesenheit / Teams */}
      {(() => {
        const activeTab = tab ?? (presentIds.size === 0 ? "presence" : "teams");
        const presentCount = players.filter((p) => presentIds.has(p.id)).length;
        const withoutTeam = players.filter(
          (p) => presentIds.has(p.id) && !teamOfPlayer.has(p.id)
        ).length;
        const shownPlayers = players.filter(
          (p) =>
            (typeFilter === "alle" || typeByPlayer.get(p.id) === typeFilter) &&
            (activeTab === "presence" || presentIds.has(p.id))
        );
        const filterBase =
          activeTab === "presence"
            ? players
            : players.filter((p) => presentIds.has(p.id));

        return (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTab("presence")}
                className={
                  "rounded-xl border px-3 py-3 font-semibold " +
                  (activeTab === "presence"
                    ? "bg-green-700 border-green-700 text-white"
                    : "bg-white border-gray-300 text-gray-800")
                }
              >
                ① Anwesenheit ({presentCount})
              </button>
              <button
                type="button"
                onClick={() => setTab("teams")}
                className={
                  "rounded-xl border px-3 py-3 font-semibold " +
                  (activeTab === "teams"
                    ? "bg-green-700 border-green-700 text-white"
                    : "bg-white border-gray-300 text-gray-800")
                }
              >
                ② Teams
              </button>
            </div>

            {activeTab === "presence" ? (
              <p className="text-gray-700 mb-3">
                Tippe auf alle, die heute da sind. {presentCount} anwesend.
              </p>
            ) : (
              <p className="text-gray-700 mb-3">
                {presentCount} anwesend
                {withoutTeam > 0
                  ? `, davon ${withoutTeam} noch ohne Team.`
                  : "."}
              </p>
            )}

            {/* Filter nach Spielertyp (Typ der Saison dieses Spieltags) */}
            <div className="flex flex-wrap gap-2 mb-4">
              {FILTERS.map((f) => {
                const count =
                  f.value === "alle"
                    ? filterBase.length
                    : filterBase.filter(
                        (p) => typeByPlayer.get(p.id) === f.value
                      ).length;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setTypeFilter(f.value)}
                    className={
                      "rounded-xl border px-4 py-2 font-semibold " +
                      (typeFilter === f.value
                        ? "bg-green-600 border-green-600 text-white"
                        : "bg-white border-gray-300 text-gray-800")
                    }
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>

            {activeTab === "presence" && canEdit && !started && (
              <Link
                href="/players/new"
                className="inline-block rounded-xl border border-green-700 bg-white px-4 py-2 font-semibold text-green-800 mb-4"
              >
                ➕ Neuen Spieler anlegen
              </Link>
            )}

            {activeTab === "teams" && presentCount === 0 && (
              <p className="rounded-xl bg-white p-4 text-gray-700">
                Noch niemand als anwesend eingetragen. Bitte zuerst bei ①
                Anwesenheit die Spieler antippen.
              </p>
            )}

            <div className="space-y-4">
              {shownPlayers.map((player) => {
                const currentTeamId = teamOfPlayer.get(player.id);
                const present = presentIds.has(player.id);
                const busy = busyPlayerId === player.id;
                const typeText = typeByPlayer.has(player.id)
                  ? TYPE_LABELS[typeByPlayer.get(player.id) as string] ??
                    typeByPlayer.get(player.id)
                  : "Kein Typ in dieser Saison";

                if (activeTab === "presence") {
                  return (
                    <button
                      key={player.id}
                      type="button"
                      disabled={busy || locked}
                      onClick={() => togglePresence(player.id)}
                      className={
                        "w-full text-left rounded-xl p-5 shadow border-2 disabled:opacity-60 " +
                        (present
                          ? "bg-green-50 border-green-600"
                          : "bg-white border-transparent")
                      }
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <span className="block text-xl font-bold">
                            {player.nickname ?? player.name}
                          </span>
                          {player.nickname && (
                            <span className="block text-gray-600">
                              {player.name}
                            </span>
                          )}
                          <span className="block text-sm text-green-700 font-medium">
                            {typeText}
                          </span>
                        </span>
                        <span
                          className={
                            "text-lg font-bold " +
                            (present ? "text-green-700" : "text-gray-400")
                          }
                        >
                          {present ? "✓ da" : "nicht da"}
                        </span>
                      </span>
                    </button>
                  );
                }

                return (
                  <div
                    key={player.id}
                    className="bg-white rounded-xl p-5 shadow"
                  >
                    <p className="text-xl font-bold">
                      {player.nickname ?? player.name}
                    </p>
                    {player.nickname && (
                      <p className="text-gray-600">{player.name}</p>
                    )}
                    <p className="text-sm text-green-700 font-medium mb-2">
                      {typeText}
                    </p>

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
                        className="h-14 px-4 rounded-xl border border-gray-300 bg-white text-xl font-bold text-gray-800 disabled:opacity-50"
                      >
                        nicht da
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}
    </main>
  );
}
