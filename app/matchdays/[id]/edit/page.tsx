"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MatchDay = {
  id: string;
  play_date: string;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  excluded_type: "not_played" | "not_rated" | null;
  excluded_reason: string | null;
  excluded_at: string | null;
};

type Team = { id: string; team_number: number };

const MIN_TEAMS = 2;
const MAX_TEAMS = 8;

const EXCLUDE_LABELS: Record<string, string> = {
  not_played: "Spieltag nicht stattgefunden",
  not_rated: "Spieltag nicht gewertet",
};

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function EditMatchDayPage() {
  const params = useParams<{ id: string }>();
  const matchDayId = params.id;
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [matchDay, setMatchDay] = useState<MatchDay | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameCount, setGameCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Bearbeiten
  const [playDate, setPlayDate] = useState("");
  const [notes, setNotes] = useState("");
  const [teamCount, setTeamCount] = useState(3);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editOk, setEditOk] = useState<string | null>(null);

  // Wertung
  const [excludeType, setExcludeType] = useState<"not_played" | "not_rated" | null>(
    null
  );
  const [reason, setReason] = useState("");
  const [excludeConfirm, setExcludeConfirm] = useState(false);
  const [excludeBusy, setExcludeBusy] = useState(false);
  const [excludeError, setExcludeError] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Löschen
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: role } = await supabase.rpc("my_role");
    const admin = role === "admin";
    setIsAdmin(admin);
    if (!admin) {
      setLoading(false);
      return;
    }

    const { data: md } = await supabase
      .from("match_days")
      .select(
        "id, play_date, notes, started_at, finished_at, excluded_type, excluded_reason, excluded_at"
      )
      .eq("id", matchDayId)
      .maybeSingle();

    if (!md) {
      setLoading(false);
      return;
    }

    const { data: teamRows } = await supabase
      .from("teams")
      .select("id, team_number")
      .eq("match_day_id", matchDayId)
      .order("team_number", { ascending: true });

    const { count } = await supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("match_day_id", matchDayId);

    setMatchDay(md as MatchDay);
    setPlayDate(md.play_date);
    setNotes(md.notes ?? "");
    setTeams((teamRows ?? []) as Team[]);
    setTeamCount((teamRows ?? []).length);
    setGameCount(count ?? 0);
    setLoading(false);
  }, [matchDayId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matchDay) return;
    setEditError(null);
    setEditOk(null);

    if (playDate === "") {
      setEditError("Bitte ein Datum wählen.");
      return;
    }

    const started = matchDay.started_at !== null;
    const newCount = started ? teams.length : teamCount;

    // Teams, die wegfallen würden, müssen leer sein
    const removing = teams.filter((t) => t.team_number > newCount);
    if (removing.length > 0) {
      const { count } = await supabase
        .from("team_players")
        .select("player_id", { count: "exact", head: true })
        .in(
          "team_id",
          removing.map((t) => t.id)
        );
      if ((count ?? 0) > 0) {
        setEditError(
          "Die wegfallenden Teams sind noch Spielern zugeordnet. Bitte zuerst die Zuordnung am Spieltag entfernen."
        );
        return;
      }
    }

    setSaving(true);

    // Saison passend zum Datum
    const { data: season } = await supabase
      .from("seasons")
      .select("id")
      .lte("start_date", playDate)
      .gte("end_date", playDate)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!season) {
      setSaving(false);
      setEditError(
        "Für dieses Datum gibt es keine Saison. Bitte ein anderes Datum wählen oder zuerst die Saison anlegen."
      );
      return;
    }

    const cleanNotes = notes.trim();
    const changed = newCount !== teams.length;
    const update: Record<string, unknown> = {
      play_date: playDate,
      season_id: season.id,
      notes: cleanNotes === "" ? null : cleanNotes,
    };
    if (changed) {
      update.match_format =
        newCount >= 2 && newCount <= 4 ? `${newCount}_teams` : "open";
    }

    const { error } = await supabase
      .from("match_days")
      .update(update)
      .eq("id", matchDayId);

    if (error) {
      setSaving(false);
      setEditError(
        error.code === "23505"
          ? "An diesem Datum gibt es schon einen Spieltag."
          : `Fehler beim Speichern: ${error.message}`
      );
      return;
    }

    if (newCount > teams.length) {
      const add = Array.from({ length: newCount - teams.length }, (_, i) => ({
        match_day_id: matchDayId,
        team_number: teams.length + i + 1,
      }));
      const { error: addError } = await supabase.from("teams").insert(add);
      if (addError) {
        setSaving(false);
        setEditError(`Teams konnten nicht ergänzt werden: ${addError.message}`);
        return;
      }
    } else if (removing.length > 0) {
      const { error: delError } = await supabase
        .from("teams")
        .delete()
        .in(
          "id",
          removing.map((t) => t.id)
        );
      if (delError) {
        setSaving(false);
        setEditError(`Teams konnten nicht entfernt werden: ${delError.message}`);
        return;
      }
    }

    setSaving(false);
    setEditOk("Gespeichert.");
    await load();
  }

  async function setExcluded() {
    if (!excludeType) return;
    setExcludeBusy(true);
    setExcludeError(null);
    const { error } = await supabase
      .from("match_days")
      .update({
        excluded_type: excludeType,
        excluded_reason: reason.trim(),
        excluded_at: new Date().toISOString(),
      })
      .eq("id", matchDayId);
    setExcludeBusy(false);
    if (error) {
      setExcludeError(`Fehler: ${error.message}`);
      return;
    }
    setExcludeConfirm(false);
    setExcludeType(null);
    setReason("");
    await load();
  }

  async function clearExcluded() {
    setExcludeBusy(true);
    setExcludeError(null);
    const { error } = await supabase
      .from("match_days")
      .update({
        excluded_type: null,
        excluded_reason: null,
        excluded_at: null,
      })
      .eq("id", matchDayId);
    setExcludeBusy(false);
    if (error) {
      setExcludeError(`Fehler: ${error.message}`);
      return;
    }
    setClearConfirm(false);
    await load();
  }

  async function doDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    const { error } = await supabase.rpc("delete_match_day", {
      p_match_day_id: matchDayId,
    });
    setDeleteBusy(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    router.push("/matchdays");
    router.refresh();
  }

  if (loading || isAdmin === null) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p>Lädt…</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p className="rounded-xl border border-gray-400 bg-white p-4 mb-4 font-semibold text-gray-700">
          Spieltage verwalten darf nur ein Admin.
        </p>
        <Link href={`/matchdays/${matchDayId}`} className="text-green-800 font-medium">
          ← Zurück
        </Link>
      </main>
    );
  }

  if (!matchDay) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p className="mb-4">Spieltag nicht gefunden.</p>
        <Link href="/matchdays" className="text-green-800 font-medium">
          ← Spieltage
        </Link>
      </main>
    );
  }

  const started = matchDay.started_at !== null;
  const canDelete = !started && gameCount === 0;
  const reasonOk = reason.trim().length >= 3;

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <Link href={`/matchdays/${matchDayId}`} className="text-green-800 font-medium">
          ← Zum Spieltag
        </Link>
        <h1 className="text-3xl font-bold text-green-800">
          ⚙ Spieltag verwalten
        </h1>
        <p className="text-gray-700 -mt-4">{formatDate(matchDay.play_date)}</p>

        {/* Bearbeiten */}
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl p-6 shadow space-y-5"
        >
          <h2 className="font-bold text-lg">Bearbeiten</h2>

          <div>
            <label htmlFor="play_date" className="block font-semibold mb-2">
              Datum
            </label>
            <input
              id="play_date"
              type="date"
              value={playDate}
              onChange={(e) => setPlayDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
            />
            <p className="text-sm text-gray-600 mt-1">
              Die Saison ergibt sich aus dem Datum.
            </p>
          </div>

          <div>
            <span className="block font-semibold mb-2">Anzahl Teams</span>
            {started ? (
              <p className="text-gray-700">
                {teams.length} Teams. Nach dem Start lässt sich die Anzahl nicht
                mehr ändern.
              </p>
            ) : (
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() => setTeamCount((n) => Math.max(MIN_TEAMS, n - 1))}
                  disabled={teamCount <= MIN_TEAMS}
                  className="h-14 w-14 rounded-xl border border-gray-300 text-3xl font-bold disabled:opacity-40"
                >
                  −
                </button>
                <span className="text-4xl font-bold w-12 text-center">
                  {teamCount}
                </span>
                <button
                  type="button"
                  onClick={() => setTeamCount((n) => Math.min(MAX_TEAMS, n + 1))}
                  disabled={teamCount >= MAX_TEAMS}
                  className="h-14 w-14 rounded-xl border border-gray-300 text-3xl font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="block font-semibold mb-2">
              Kommentar
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
            />
          </div>

          {editError && <p className="text-red-600 font-medium">{editError}</p>}
          {editOk && <p className="text-green-700 font-medium">{editOk}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-green-600 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </form>

        {/* Wertung */}
        <div className="bg-white rounded-xl p-6 shadow space-y-4">
          <h2 className="font-bold text-lg">Wertung</h2>

          {matchDay.excluded_type ? (
            <>
              <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 text-red-900">
                <p className="font-bold">
                  🚫 {EXCLUDE_LABELS[matchDay.excluded_type]}
                </p>
                <p className="mt-1">
                  Begründung: {matchDay.excluded_reason}
                </p>
              </div>
              {excludeError && (
                <p className="text-red-600 font-medium">{excludeError}</p>
              )}
              {!clearConfirm ? (
                <button
                  type="button"
                  onClick={() => setClearConfirm(true)}
                  className="w-full rounded-xl border border-gray-400 bg-white px-4 py-3 font-semibold text-gray-700"
                >
                  Status aufheben…
                </button>
              ) : (
                <div className="rounded-xl border border-gray-300 p-3 space-y-2">
                  <p className="font-bold">
                    Bist du sicher? Der Spieltag zählt danach wieder normal.
                  </p>
                  <button
                    type="button"
                    onClick={clearExcluded}
                    disabled={excludeBusy}
                    className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {excludeBusy ? "Hebt auf…" : "Ja, Status aufheben"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearConfirm(false)}
                    className="w-full text-center text-gray-700 font-medium py-1"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Spieltag aus der Wertung nehmen. Eine Begründung ist Pflicht und
                wird bei dem Spieltag immer angezeigt.
              </p>
              <div className="grid grid-cols-1 gap-2">
                {(["not_played", "not_rated"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setExcludeType(t);
                      setExcludeConfirm(false);
                    }}
                    className={
                      "rounded-xl border px-3 py-3 text-left " +
                      (excludeType === t
                        ? "bg-red-600 border-red-600 text-white"
                        : "bg-white border-gray-300 text-gray-800")
                    }
                  >
                    <span className="block font-semibold">
                      {EXCLUDE_LABELS[t]}
                    </span>
                    <span className="block text-xs">
                      {t === "not_played"
                        ? "z. B. abgesagt, zu wenig Anmeldungen"
                        : "wurde gespielt, zählt aber nicht, z. B. nur zum Spaß"}
                    </span>
                  </button>
                ))}
              </div>

              {excludeType && (
                <div>
                  <label htmlFor="reason" className="block font-semibold mb-2">
                    Begründung (Pflicht)
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setExcludeConfirm(false);
                    }}
                    rows={3}
                    placeholder="z. B. zu wenig Spieleranmeldungen"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
                  />
                </div>
              )}

              {excludeError && (
                <p className="text-red-600 font-medium">{excludeError}</p>
              )}

              {excludeType && !excludeConfirm && (
                <button
                  type="button"
                  onClick={() => setExcludeConfirm(true)}
                  disabled={!reasonOk}
                  className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                >
                  Speichern…
                </button>
              )}
              {excludeType && !reasonOk && (
                <p className="text-sm text-gray-600">
                  Bitte eine Begründung eingeben (mindestens 3 Zeichen).
                </p>
              )}

              {excludeType && excludeConfirm && (
                <div className="rounded-xl border border-red-400 p-3 space-y-2">
                  <p className="font-bold text-red-700">
                    Bist du sicher? „{EXCLUDE_LABELS[excludeType]}“ mit der
                    Begründung „{reason.trim()}“.
                  </p>
                  <button
                    type="button"
                    onClick={setExcluded}
                    disabled={excludeBusy}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {excludeBusy ? "Speichert…" : "Ja, so festlegen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcludeConfirm(false)}
                    className="w-full text-center text-gray-700 font-medium py-1"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Löschen */}
        <div className="bg-white rounded-xl p-6 shadow space-y-4">
          <h2 className="font-bold text-lg">Spieltag löschen</h2>
          {canDelete ? (
            <>
              <p className="text-sm text-gray-600">
                Der Spieltag wird samt Teams und Anwesenheit gelöscht. Das lässt
                sich nicht rückgängig machen.
              </p>
              {deleteError && (
                <p className="text-red-600 font-medium">{deleteError}</p>
              )}
              {!deleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="w-full rounded-xl border border-red-500 bg-white px-4 py-3 font-semibold text-red-700"
                >
                  🗑 Spieltag löschen…
                </button>
              ) : (
                <div className="rounded-xl border border-red-400 p-3 space-y-2">
                  <p className="font-bold text-red-700">
                    Bist du sicher? Der Spieltag {formatDate(matchDay.play_date)}{" "}
                    wird endgültig gelöscht.
                  </p>
                  <button
                    type="button"
                    onClick={doDelete}
                    disabled={deleteBusy}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {deleteBusy ? "Löscht…" : "Ja, endgültig löschen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    className="w-full text-center text-gray-700 font-medium py-1"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-600">
              Löschen ist nur möglich, solange der Spieltag nicht gestartet ist
              und es keine Spiele gibt. Dieser Spieltag{" "}
              {started ? "wurde gestartet" : "hat Spiele"}. Nutze stattdessen
              „nicht gewertet“ oder „nicht stattgefunden“ mit Begründung.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
