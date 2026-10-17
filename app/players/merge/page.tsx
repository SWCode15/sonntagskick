"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type P = { id: string; name: string; nickname: string | null };

type Preview = {
  keep: string;
  remove: string;
  seasons_moved: { season: string; type: string }[];
  seasons_both: { season: string; keep_type: string; remove_type: string }[];
  days_moved: string[];
  days_both: string[];
  teams_moved: number;
  teams_dropped: number;
};

const TYPE_LABELS: Record<string, string> = {
  stamm: "Stammspieler",
  springer: "Springer",
  gast: "Gast",
};

function typeLabel(t: string) {
  return TYPE_LABELS[t] ?? t;
}

function label(p: P) {
  return p.nickname ? `${p.nickname} (${p.name})` : p.name;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export default function MergePlayersPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [players, setPlayers] = useState<P[]>([]);
  const [keepId, setKeepId] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: role } = await supabase.rpc("my_role");
      const admin = role === "admin";
      setIsAdmin(admin);
      if (!admin) return;
      const { data } = await supabase
        .from("players")
        .select("id, name, nickname")
        .order("name", { ascending: true });
      setPlayers((data ?? []) as P[]);
    }
    load();
  }, []);

  function resetPreview() {
    setPreview(null);
    setConfirming(false);
    setErrorMessage(null);
  }

  async function showPreview() {
    setErrorMessage(null);
    setConfirming(false);
    setBusy(true);
    const { data, error } = await supabase.rpc("merge_players_preview", {
      p_keep: keepId,
      p_remove: removeId,
    });
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setPreview(data as Preview);
  }

  async function doMerge() {
    setBusy(true);
    setErrorMessage(null);
    const { error } = await supabase.rpc("merge_players", {
      p_keep: keepId,
      p_remove: removeId,
    });
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    router.push("/players");
    router.refresh();
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
          Spieler zusammenführen darf nur ein Admin.
        </p>
        <Link href="/players" className="text-green-800 font-medium">
          ← Zurück
        </Link>
      </main>
    );
  }

  const canPreview = keepId !== "" && removeId !== "" && keepId !== removeId;
  const conflicts = preview?.seasons_both.filter(
    (s) => s.keep_type !== s.remove_type
  );

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-green-800 mb-2">
          🔀 Spieler zusammenführen
        </h1>
        <p className="text-gray-700 mb-6">
          Für doppelt angelegte Spieler: Alles vom falschen Eintrag wird auf den
          richtigen übertragen, danach wird der falsche gelöscht.
        </p>

        <div className="bg-white rounded-xl p-6 shadow space-y-5">
          <div>
            <label htmlFor="keep" className="block font-semibold mb-2">
              Richtiger Spieler (bleibt)
            </label>
            <select
              id="keep"
              value={keepId}
              onChange={(e) => {
                setKeepId(e.target.value);
                resetPreview();
              }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg bg-white"
            >
              <option value="">– bitte wählen –</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="remove" className="block font-semibold mb-2">
              Falscher Doppelter (wird gelöscht)
            </label>
            <select
              id="remove"
              value={removeId}
              onChange={(e) => {
                setRemoveId(e.target.value);
                resetPreview();
              }}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg bg-white"
            >
              <option value="">– bitte wählen –</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p)}
                </option>
              ))}
            </select>
          </div>

          {keepId !== "" && keepId === removeId && (
            <p className="text-red-600 font-medium">
              Bitte zwei verschiedene Spieler wählen.
            </p>
          )}

          {errorMessage && (
            <p className="text-red-600 font-medium">{errorMessage}</p>
          )}

          <button
            type="button"
            onClick={showPreview}
            disabled={!canPreview || busy}
            className="w-full rounded-xl bg-green-600 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50"
          >
            Vorschau anzeigen
          </button>

          {preview && (
            <div className="rounded-xl border-2 border-yellow-500 bg-yellow-50 p-4 space-y-3 text-yellow-900">
              <p className="font-bold">
                „{preview.remove}“ wird in „{preview.keep}“ zusammengeführt:
              </p>

              <div>
                <p className="font-semibold">Saison-Typen</p>
                {preview.seasons_moved.length === 0 &&
                  preview.seasons_both.length === 0 && (
                    <p className="text-sm">Keine vorhanden.</p>
                  )}
                {preview.seasons_moved.map((s, i) => (
                  <p key={i} className="text-sm">
                    Saison {s.season}: {typeLabel(s.type)} wird übernommen
                  </p>
                ))}
                {preview.seasons_both.map((s, i) => (
                  <p key={i} className="text-sm">
                    Saison {s.season}:{" "}
                    {s.keep_type === s.remove_type
                      ? `beide ${typeLabel(s.keep_type)}, bleibt so`
                      : `„${preview.keep}“ ist ${typeLabel(
                          s.keep_type
                        )}, „${preview.remove}“ ist ${typeLabel(
                          s.remove_type
                        )}. Es gilt ${typeLabel(s.keep_type)}.`}
                  </p>
                ))}
              </div>

              <div>
                <p className="font-semibold">Anwesenheit</p>
                {preview.days_moved.length === 0 &&
                  preview.days_both.length === 0 && (
                    <p className="text-sm">Keine vorhanden.</p>
                  )}
                {preview.days_moved.length > 0 && (
                  <p className="text-sm">
                    Wird übernommen:{" "}
                    {preview.days_moved.map(formatDate).join(", ")}
                  </p>
                )}
                {preview.days_both.length > 0 && (
                  <p className="text-sm">
                    Beide waren da (es bleibt ein Eintrag):{" "}
                    {preview.days_both.map(formatDate).join(", ")}
                  </p>
                )}
              </div>

              <div>
                <p className="font-semibold">Teamzuordnung</p>
                <p className="text-sm">
                  {preview.teams_moved} werden übernommen
                  {preview.teams_dropped > 0
                    ? `, ${preview.teams_dropped} entfallen, weil „${preview.keep}“ an dem Spieltag schon eingetragen ist`
                    : ""}
                  .
                </p>
              </div>

              {conflicts && conflicts.length > 0 && (
                <p className="text-sm font-semibold">
                  ⚠ Bei unterschiedlichen Typen gilt der Typ von „
                  {preview.keep}“.
                </p>
              )}

              {!confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-semibold text-white"
                >
                  Zusammenführen…
                </button>
              ) : (
                <div className="rounded-xl bg-white border border-red-400 p-3 space-y-3">
                  <p className="font-bold text-red-700">
                    Bist du sicher? „{preview.remove}“ wird gelöscht. Das lässt
                    sich nicht rückgängig machen.
                  </p>
                  <button
                    type="button"
                    onClick={doMerge}
                    disabled={busy}
                    className="w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? "Führt zusammen…" : "Ja, zusammenführen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="w-full text-center text-gray-700 font-medium py-1"
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </div>
          )}

          <Link
            href="/players"
            className="block text-center text-green-800 font-medium py-2"
          >
            ← Zurück zu den Spielern
          </Link>
        </div>
      </div>
    </main>
  );
}
