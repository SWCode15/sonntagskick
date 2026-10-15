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

// Knopf mit Kontrollfrage: erster Tipp fragt "Bist du sicher?"
function ConfirmButton({
  label,
  question,
  onConfirm,
  disabled,
  className,
}: {
  label: string;
  question: string;
  onConfirm: () => void;
  disabled?: boolean;
  className: string;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className={className}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-amber-400 bg-amber-50 p-3">
      <p className="font-semibold text-amber-900 mb-2">{question}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
          className="rounded-xl bg-green-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Ja
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-800"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

export default function GamesPage() {
  const params = useParams<{ id: string }>();
  const matchDayId = params.id;

  const [playDate, setPlayDate] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [dayFinished, setDayFinished] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Standard mit 3 Teams: Auswahl merken wir uns, bis sie bestätigt wird
  // (erst dann geht etwas in die Datenbank).
  const [pendingPair, setPendingPair] = useState<[string, string] | null>(null);
  const [stayer, setStayer] = useState<string | null>(null);

  // Formular "Einzelnes Spiel" (nur Admin)
  const [freeA, setFreeA] = useState<string | null>(null);
  const [freeB, setFreeB] = useState<string | null>(null);
  const [freeRound, setFreeRound] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data: md, error: mdError } = await supabase
      .from("match_days")
      .select("id, play_date, started_at, finished_at")
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

    const { data: adminFlag } = await supabase.rpc("is_admin");

    setPlayDate(md.play_date);
    setStarted(!!md.started_at);
    setDayFinished(!!md.finished_at);
    setIsAdmin(adminFlag === true);
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

  // --- Admin: Spiele direkt anlegen/löschen ---
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

  // --- Standard mit 3 Teams (alle dürfen) ---
  // Schritt 1: erstes Spiel anlegen. Schritt 2: nach dem ersten Spiel
  // entscheiden, welches Team bleibt, dann entstehen alle restlichen Spiele.
  const isThreeTeams = teams.length === 3;

  async function createFirstGame() {
    if (!pendingPair) return;
    setErrorMessage(null);
    setBusy(true);
    const { error } = await supabase.rpc("create_first_game", {
      p_match_day_id: matchDayId,
      p_team_a: pendingPair[0],
      p_team_b: pendingPair[1],
    });
    if (error) {
      setErrorMessage(`Fehler beim Anlegen: ${error.message}`);
    } else {
      setPendingPair(null);
    }
    await load();
    setBusy(false);
  }

  async function createRemainingGames() {
    if (!stayer) return;
    setErrorMessage(null);
    setBusy(true);
    const { error } = await supabase.rpc("create_remaining_games", {
      p_match_day_id: matchDayId,
      p_stayer: stayer,
      p_rounds: STANDARD_ROUNDS,
    });
    if (error) {
      setErrorMessage(`Fehler beim Anlegen: ${error.message}`);
    } else {
      setStayer(null);
    }
    await load();
    setBusy(false);
  }

  // --- Admin: Runden anpassen ---
  function roundRows(roundNo: number, startNumber: number): NewGame[] {
    // Reihenfolge der ersten Runde wiederholen
    const pattern = games.filter((g) => g.round_number === 1).slice(0, 3);
    return pattern.map((g, i) =>
      makeGame(startNumber + i, roundNo, g.team_a_id, g.team_b_id)
    );
  }

  async function addNextRound() {
    await insertGames(roundRows(lastRound + 1, nextGameNumber));
  }

  async function removeLastRound() {
    setErrorMessage(null);
    const inLast = games.filter((g) => g.round_number === lastRound);
    const allUnplayed = inLast.every(
      (g) => !g.finished && g.goals_team_a === 0 && g.goals_team_b === 0
    );
    if (!allUnplayed) {
      setErrorMessage(
        "In der letzten Runde wurde schon gespielt. Nur unbegonnene Spiele lassen sich entfernen."
      );
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("games")
      .delete()
      .in(
        "id",
        inLast.map((g) => g.id)
      );
    if (error) {
      setErrorMessage(`Fehler beim Entfernen: ${error.message}`);
    }
    await load();
    setBusy(false);
  }

  // --- Admin: Einzelnes Spiel ---
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

  const btnBase =
    "rounded-xl border px-4 py-4 text-lg font-semibold disabled:opacity-50";

  // Spiele gibt es erst, wenn der Spieltag gestartet wurde
  if (!started && games.length === 0) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <Link
          href={`/matchdays/${matchDayId}`}
          className="text-green-800 font-medium"
        >
          ← Spieltag
        </Link>
        <h1 className="text-3xl font-bold mt-2 mb-4">
          Spieltag noch nicht gestartet
        </h1>
        <p className="bg-white rounded-xl p-5 shadow text-gray-700 mb-4">
          Spiele lassen sich erst anlegen, wenn der Spieltag gestartet wurde.
          Ordne zuerst die Spieler den Teams zu und tippe dann auf
          „▶ Spieltag starten“.
        </p>
        <Link
          href={`/matchdays/${matchDayId}`}
          className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white"
        >
          Zum Spieltag
        </Link>
      </main>
    );
  }

  // Welcher Schritt des Standards (3 Teams) ist dran?
  const firstGame = games.length === 1 ? games[0] : null;
  // Nächstes Spiel zum Zählen: das erste nicht beendete nach Spielnummer
  const nextOpenGame = [...games]
    .filter((g) => !g.finished)
    .sort((x, y) => (x.game_number ?? 0) - (y.game_number ?? 0))[0];
  const standardActive = isThreeTeams && started && !dayFinished;
  const standardStep: "first" | "wait" | "stayer" | null = !standardActive
    ? null
    : games.length === 0
    ? "first"
    : firstGame && !firstGame.finished
    ? "wait"
    : firstGame && firstGame.finished
    ? "stayer"
    : null;

  const thirdTeam =
    firstGame && isThreeTeams
      ? teams.find(
          (t) => t.id !== firstGame.team_a_id && t.id !== firstGame.team_b_id
        )
      : undefined;
  const otherTeamId =
    firstGame && stayer
      ? stayer === firstGame.team_a_id
        ? firstGame.team_b_id
        : firstGame.team_a_id
      : null;

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

      {dayFinished && (
        <p className="rounded-xl border border-green-600 bg-white p-4 mb-6 font-semibold text-green-800">
          🏁 Der Spieltag ist beendet.
        </p>
      )}

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
      )}

      {/* Nächstes Spiel zählen */}
      {nextOpenGame && !dayFinished && (
        <Link
          href={`/matchdays/${matchDayId}/games/${nextOpenGame.id}`}
          className="block text-center rounded-xl bg-green-600 px-4 py-5 text-xl font-bold text-white shadow mb-6"
        >
          ▶ Nächstes Spiel zählen: {teamLabel(nextOpenGame.team_a_id)} :{" "}
          {teamLabel(nextOpenGame.team_b_id)}
        </Link>
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
                    isAdmin &&
                    !game.finished &&
                    game.goals_team_a === 0 &&
                    game.goals_team_b === 0;
                  return (
                    <div
                      key={game.id}
                      className={
                        "bg-white rounded-xl p-4 shadow flex items-center justify-between gap-3" +
                        (nextOpenGame && game.id === nextOpenGame.id && !dayFinished
                          ? " border-2 border-green-600"
                          : "")
                      }
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
                          <ConfirmButton
                            label="Entfernen"
                            question="Spiel wirklich entfernen?"
                            disabled={busy}
                            onConfirm={() => removeGame(game.id)}
                            className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>

      {/* Standard mit 3 Teams, Schritt 1: erstes Spiel wählen */}
      {standardStep === "first" && !pendingPair && (
        <section className="bg-white rounded-xl p-5 shadow mb-6">
          <h2 className="font-semibold mb-1">Erstes Spiel wählen</h2>
          <p className="text-sm text-gray-600 mb-3">
            Welches Team bleibt, entscheidest du erst nach dem ersten Spiel.
            Danach legt die App alle {STANDARD_ROUNDS} Runden an.
          </p>
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
                onClick={() => setPendingPair([a.id, b.id])}
                className={`${btnBase} bg-green-600 border-green-600 text-white`}
              >
                Team {a.team_number} : Team {b.team_number}
              </button>
            ))}
          </div>
        </section>
      )}

      {standardStep === "first" && pendingPair && (
        <section className="bg-white rounded-xl p-5 shadow mb-6 border-2 border-green-600">
          <h2 className="font-bold text-lg mb-2">
            Erstes Spiel: {teamLabel(pendingPair[0])} :{" "}
            {teamLabel(pendingPair[1])}
          </h2>
          <p className="font-semibold mb-2">Bist du sicher?</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={createFirstGame}
              className={`${btnBase} bg-green-600 border-green-600 text-white`}
            >
              Ja, anlegen
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingPair(null)}
              className={`${btnBase} bg-white border-gray-300 text-gray-800`}
            >
              Zurück
            </button>
          </div>
        </section>
      )}

      {/* Schritt 2a: das erste Spiel läuft noch */}
      {standardStep === "wait" && (
        <p className="bg-white rounded-xl p-5 shadow mb-6 text-gray-700">
          Das erste Spiel läuft. Tippe dort auf „Spiel beenden“. Danach
          entscheidest du hier, welches Team bleibt.
        </p>
      )}

      {/* Schritt 2b: wer bleibt? */}
      {standardStep === "stayer" && firstGame && !stayer && (
        <section className="bg-white rounded-xl p-5 shadow mb-6">
          <h2 className="font-semibold mb-1">Welches Team bleibt?</h2>
          <p className="text-sm text-gray-600 mb-3">
            Erstes Spiel: {teamLabel(firstGame.team_a_id)} :{" "}
            {teamLabel(firstGame.team_b_id)} ({firstGame.goals_team_a} :{" "}
            {firstGame.goals_team_b})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[firstGame.team_a_id, firstGame.team_b_id].map((teamId) => (
              <button
                key={teamId}
                type="button"
                disabled={busy}
                onClick={() => setStayer(teamId)}
                className={`${btnBase} bg-green-600 border-green-600 text-white`}
              >
                {teamLabel(teamId)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Schritt 2c: bestätigen */}
      {standardStep === "stayer" &&
        firstGame &&
        stayer &&
        thirdTeam &&
        otherTeamId && (
          <section className="bg-white rounded-xl p-5 shadow mb-6 border-2 border-green-600">
            <h2 className="font-bold text-lg mb-2">
              Restliche Spiele anlegen?
            </h2>
            <p className="text-gray-700 mb-1">
              {teamLabel(stayer)} bleibt. So läuft jede Runde:
            </p>
            <ol className="list-decimal list-inside text-gray-800 font-semibold mb-3">
              <li>
                {teamLabel(firstGame.team_a_id)} :{" "}
                {teamLabel(firstGame.team_b_id)}
              </li>
              <li>
                {teamLabel(stayer)} : {teamLabel(thirdTeam.id)}
              </li>
              <li>
                {teamLabel(otherTeamId)} : {teamLabel(thirdTeam.id)}
              </li>
            </ol>
            <p className="text-sm text-gray-600 mb-4">
              Das gibt {STANDARD_ROUNDS} Runden mit {STANDARD_ROUNDS * 3} Spielen
              (das erste ist schon gespielt). Danach kann nur noch ein Admin
              Spiele ändern. Wenn früher Schluss ist, beendest du den Spieltag.
            </p>
            <p className="font-semibold mb-2">Bist du sicher?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={createRemainingGames}
                className={`${btnBase} bg-green-600 border-green-600 text-white`}
              >
                Ja, anlegen
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStayer(null)}
                className={`${btnBase} bg-white border-gray-300 text-gray-800`}
              >
                Zurück
              </button>
            </div>
          </section>
        )}

      {/* Hinweis, wenn kein Standard möglich ist */}
      {!isAdmin && !dayFinished && games.length === 0 && !isThreeTeams && (
        <p className="bg-white rounded-xl p-5 shadow text-gray-700">
          Bei diesem Spieltag legt ein Admin die Spiele an.
        </p>
      )}

      {/* Nur Admins: Runden und Spiele anpassen */}
      {isAdmin && (
        <section className="bg-white rounded-xl p-5 shadow mb-6 space-y-3">
          <h2 className="font-semibold">Admin: Runden anpassen</h2>

          {isThreeTeams && games.length >= 3 && (
            <div className="space-y-2">
              <ConfirmButton
                label={`➕ Runde ${lastRound + 1} anlegen`}
                question={`Runde ${lastRound + 1} wirklich anlegen?`}
                disabled={busy}
                onConfirm={addNextRound}
                className={`${btnBase} w-full bg-green-600 border-green-600 text-white`}
              />
              <ConfirmButton
                label={`➖ Runde ${lastRound} entfernen`}
                question={`Runde ${lastRound} wirklich entfernen?`}
                disabled={busy}
                onConfirm={removeLastRound}
                className={`${btnBase} w-full bg-white border-gray-300 text-gray-800`}
              />
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Einzelnes Spiel hinzufügen</h3>

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

            <ConfirmButton
              label="Spiel anlegen"
              question="Dieses Spiel wirklich anlegen?"
              disabled={busy}
              onConfirm={addFreeGame}
              className={`${btnBase} w-full bg-green-600 border-green-600 text-white`}
            />
          </div>
        </section>
      )}
    </main>
  );
}
