"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Season = {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function SeasonsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  // Neue Saison
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  // Spieler übernehmen
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [copyCount, setCopyCount] = useState<number | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState<string | null>(null);

  const loadSeasons = useCallback(async () => {
    const { data } = await supabase
      .from("seasons")
      .select("id, season_name, start_date, end_date")
      .order("start_date", { ascending: false });
    setSeasons((data ?? []) as Season[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: role } = await supabase.rpc("my_role");
      const admin = role === "admin";
      setIsAdmin(admin);
      if (admin) await loadSeasons();
      else setLoading(false);
    }
    init();
  }, [loadSeasons]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setOkMessage(null);

    const cleanName = name.trim();
    if (cleanName === "") {
      setErrorMessage("Bitte einen Namen eingeben, z. B. 2025/2026.");
      return;
    }
    if (startDate === "" || endDate === "") {
      setErrorMessage("Bitte Start und Ende wählen.");
      return;
    }
    if (endDate < startDate) {
      setErrorMessage("Das Ende darf nicht vor dem Start liegen.");
      return;
    }
    const overlap = seasons.find(
      (s) => startDate <= s.end_date && endDate >= s.start_date
    );
    if (overlap) {
      setErrorMessage(
        `Der Zeitraum überschneidet sich mit Saison ${overlap.season_name} (${formatDate(
          overlap.start_date
        )} bis ${formatDate(overlap.end_date)}).`
      );
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("seasons").insert({
      season_name: cleanName,
      start_date: startDate,
      end_date: endDate,
      active: false,
    });
    setSaving(false);

    if (error) {
      setErrorMessage(
        error.code === "23505"
          ? "Diesen Namen gibt es schon. Bitte einen anderen wählen."
          : `Fehler beim Speichern: ${error.message}`
      );
      return;
    }
    setOkMessage(`Saison ${cleanName} wurde angelegt.`);
    setName("");
    setStartDate("");
    setEndDate("");
    await loadSeasons();
  }

  // Wie viele Spieler würden übernommen?
  async function loadCopyPreview() {
    setCopyError(null);
    setCopyOk(null);
    setCopyConfirm(false);
    setCopyBusy(true);
    const { data: src, error } = await supabase
      .from("season_players")
      .select("player_id")
      .eq("season_id", fromId);
    const { data: dst } = await supabase
      .from("season_players")
      .select("player_id")
      .eq("season_id", toId);
    setCopyBusy(false);
    if (error) {
      setCopyError(error.message);
      return;
    }
    const have = new Set((dst ?? []).map((r) => r.player_id));
    setCopyCount((src ?? []).filter((r) => !have.has(r.player_id)).length);
  }

  async function doCopy() {
    setCopyBusy(true);
    setCopyError(null);
    const { data: src, error } = await supabase
      .from("season_players")
      .select("player_id, player_type")
      .eq("season_id", fromId);
    const { data: dst } = await supabase
      .from("season_players")
      .select("player_id")
      .eq("season_id", toId);
    if (error) {
      setCopyBusy(false);
      setCopyError(error.message);
      return;
    }
    const have = new Set((dst ?? []).map((r) => r.player_id));
    const rows = (src ?? [])
      .filter((r) => !have.has(r.player_id))
      .map((r) => ({
        season_id: toId,
        player_id: r.player_id,
        player_type: r.player_type,
      }));
    if (rows.length > 0) {
      const { error: insError } = await supabase
        .from("season_players")
        .insert(rows);
      if (insError) {
        setCopyBusy(false);
        setCopyError(`Fehler beim Übernehmen: ${insError.message}`);
        return;
      }
    }
    setCopyBusy(false);
    setCopyConfirm(false);
    setCopyCount(null);
    setCopyOk(`${rows.length} Spieler wurden übernommen.`);
  }

  if (isAdmin === null) {
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
          Saisons verwaltet nur ein Admin.
        </p>
        <Link href="/players" className="text-green-800 font-medium">
          ← Zurück
        </Link>
      </main>
    );
  }

  const seasonName = (id: string) =>
    seasons.find((s) => s.id === id)?.season_name ?? "";
  const canCopy = fromId !== "" && toId !== "" && fromId !== toId;

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <Link href="/players" className="text-green-800 font-medium">
          ← Spieler
        </Link>
        <h1 className="text-3xl font-bold text-green-800">🗓 Saisons</h1>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="font-bold text-lg mb-2">Vorhandene Saisons</h2>
          {loading && <p className="text-gray-600">Lädt…</p>}
          {!loading && seasons.length === 0 && (
            <p className="text-gray-600">Noch keine Saison angelegt.</p>
          )}
          <ul className="space-y-1">
            {seasons.map((s) => (
              <li key={s.id}>
                <span className="font-bold">{s.season_name}</span>{" "}
                <span className="text-gray-600">
                  {formatDate(s.start_date)} bis {formatDate(s.end_date)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl p-6 shadow space-y-4"
        >
          <h2 className="font-bold text-lg">Neue Saison anlegen</h2>
          <div>
            <label htmlFor="sname" className="block font-semibold mb-1">
              Name
            </label>
            <input
              id="sname"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. 2025/2026"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="sstart" className="block font-semibold mb-1">
              Start
            </label>
            <input
              id="sstart"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
            />
          </div>
          <div>
            <label htmlFor="send" className="block font-semibold mb-1">
              Ende
            </label>
            <input
              id="send"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
            />
          </div>
          {errorMessage && (
            <p className="text-red-600 font-medium">{errorMessage}</p>
          )}
          {okMessage && <p className="text-green-700 font-medium">{okMessage}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-green-600 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Saison anlegen"}
          </button>
        </form>

        {seasons.length >= 2 && (
          <div className="bg-white rounded-xl p-6 shadow space-y-4">
            <h2 className="font-bold text-lg">Spieler aus einer Saison übernehmen</h2>
            <p className="text-sm text-gray-600">
              Kopiert Spieler samt Typ in eine andere Saison. Wer dort schon
              einen Typ hat, bleibt unverändert.
            </p>
            <div>
              <label htmlFor="from" className="block font-semibold mb-1">
                Von Saison
              </label>
              <select
                id="from"
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value);
                  setCopyCount(null);
                  setCopyConfirm(false);
                  setCopyOk(null);
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-lg"
              >
                <option value="">– bitte wählen –</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    Saison {s.season_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="to" className="block font-semibold mb-1">
                In Saison
              </label>
              <select
                id="to"
                value={toId}
                onChange={(e) => {
                  setToId(e.target.value);
                  setCopyCount(null);
                  setCopyConfirm(false);
                  setCopyOk(null);
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-lg"
              >
                <option value="">– bitte wählen –</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    Saison {s.season_name}
                  </option>
                ))}
              </select>
            </div>
            {fromId !== "" && fromId === toId && (
              <p className="text-red-600 font-medium">
                Bitte zwei verschiedene Saisons wählen.
              </p>
            )}
            {copyError && (
              <p className="text-red-600 font-medium">{copyError}</p>
            )}
            {copyOk && <p className="text-green-700 font-medium">{copyOk}</p>}
            <button
              type="button"
              onClick={loadCopyPreview}
              disabled={!canCopy || copyBusy}
              className="w-full rounded-xl border border-green-700 px-4 py-3 font-semibold text-green-800 disabled:opacity-50"
            >
              Vorschau anzeigen
            </button>
            {copyCount !== null && (
              <div className="rounded-xl border-2 border-yellow-500 bg-yellow-50 p-4 space-y-3 text-yellow-900">
                <p className="font-semibold">
                  {copyCount === 0
                    ? "Es gibt nichts zu übernehmen. Alle Spieler haben in dieser Saison schon einen Typ."
                    : `${copyCount} Spieler werden von Saison ${seasonName(
                        fromId
                      )} in Saison ${seasonName(toId)} übernommen.`}
                </p>
                {copyCount > 0 &&
                  (!copyConfirm ? (
                    <button
                      type="button"
                      onClick={() => setCopyConfirm(true)}
                      className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-semibold text-white"
                    >
                      Übernehmen…
                    </button>
                  ) : (
                    <div className="rounded-xl bg-white border border-gray-300 p-3 space-y-2">
                      <p className="font-bold">Bist du sicher?</p>
                      <button
                        type="button"
                        onClick={doCopy}
                        disabled={copyBusy}
                        className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                      >
                        {copyBusy ? "Übernimmt…" : "Ja, übernehmen"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCopyConfirm(false)}
                        className="w-full text-center text-gray-700 font-medium py-1"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
