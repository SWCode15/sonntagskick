"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PLAYER_TYPES = [
  { value: "stamm", label: "Stammspieler" },
  { value: "springer", label: "Springer" },
  { value: "gast", label: "Gast" },
];

// Schreibweise vereinheitlichen: klein, ohne Umlaut-Zeichen/Leerzeichen/Satzzeichen
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Anzahl der Änderungen (Einfügen, Löschen, Ersetzen) zwischen zwei Wörtern
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      last = tmp;
    }
  }
  return prev[b.length];
}

// Sind zwei Namen so ähnlich, dass es dieselbe Person sein könnte?
function isSimilar(x: string, y: string): boolean {
  const a = norm(x);
  const b = norm(y);
  if (a === "" || b === "") return false;
  if (a === b) return true;
  const shorter = Math.min(a.length, b.length);
  if (shorter >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
  const limit = Math.max(1, Math.floor(Math.max(a.length, b.length) / 3));
  return distance(a, b) <= limit;
}

type ExistingPlayer = { name: string; nickname: string | null };
type Season = {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
};

const SEASON_KEY = "sk_season";

export default function NewPlayerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [playerType, setPlayerType] = useState("stamm");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Ähnliche Spieler, die vor dem Speichern bestätigt werden müssen
  const [similar, setSimilar] = useState<ExistingPlayer[] | null>(null);
  // Darf dieses Konto hier eintragen? (null = wird noch geprüft)
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");
  useEffect(() => {
    supabase.rpc("can_write_today").then(({ data }) => setAllowed(data === true));
    async function loadSeasons() {
      const { data: role } = await supabase.rpc("my_role");
      setIsAdmin(role === "admin");
      const { data } = await supabase
        .from("seasons")
        .select("id, season_name, start_date, end_date")
        .order("start_date", { ascending: false });
      const list = (data ?? []) as Season[];
      setSeasons(list);
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(SEASON_KEY);
      } catch {
        saved = null;
      }
      const todayStr = new Date().toLocaleDateString("sv-SE", {
        timeZone: "Europe/Vienna",
      });
      const current =
        list.find((s) => s.start_date <= todayStr && todayStr <= s.end_date) ??
        list[0];
      // Gemerkte Saison nur für Admins; alle anderen: aktuelle Saison
      const useSaved = role === "admin" && list.some((s) => s.id === saved);
      setSeasonId(useSaved ? (saved as string) : current?.id ?? "");
    }
    loadSeasons();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await checkAndSave(false);
  }

  async function checkAndSave(skipSimilarCheck: boolean) {
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanNickname = nickname.trim();

    if (cleanName === "") {
      setErrorMessage("Bitte einen Namen eingeben.");
      return;
    }

    // Ähnliche Namen prüfen
    const { data: existing } = await supabase
      .from("players")
      .select("name, nickname");
    const others = (existing ?? []) as ExistingPlayer[];

    // Gleicher Name oder Spitzname (egal ob groß/klein): nicht erlaubt
    const same = others.find(
      (o) =>
        norm(o.name) === norm(cleanName) ||
        (cleanNickname !== "" &&
          o.nickname !== null &&
          norm(o.nickname) === norm(cleanNickname)) ||
        (cleanNickname !== "" && norm(o.name) === norm(cleanNickname)) ||
        (o.nickname !== null && norm(o.nickname) === norm(cleanName))
    );
    if (same) {
      setSimilar(null);
      setErrorMessage(
        `Diesen Spieler gibt es schon: ${same.nickname ?? same.name}` +
          (same.nickname ? ` (${same.name})` : "") +
          ".");
      return;
    }

    if (!skipSimilarCheck) {
      const found = others.filter(
        (o) =>
          isSimilar(cleanName, o.name) ||
          (o.nickname !== null && isSimilar(cleanName, o.nickname)) ||
          (cleanNickname !== "" &&
            (isSimilar(cleanNickname, o.name) ||
              (o.nickname !== null && isSimilar(cleanNickname, o.nickname))))
      );
      if (found.length > 0) {
        setSimilar(found);
        return;
      }
    }
    setSimilar(null);

    setSaving(true);

    // 1. Gewählte (oder aktuelle) Saison
    const season = seasons.find((s) => s.id === seasonId);
    if (!season) {
      setSaving(false);
      setErrorMessage(
        "Keine Saison gefunden. Bitte zuerst eine Saison anlegen."
      );
      return;
    }

    // 2. Spieler anlegen
    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({
        name: cleanName,
        nickname: cleanNickname === "" ? null : cleanNickname,
        active: true,
      })
      .select("id")
      .single();

    if (playerError || !player) {
      setSaving(false);
      if (playerError?.code === "23505") {
        setErrorMessage(
          "Diesen Spitznamen gibt es schon. Bitte einen anderen wählen."
        );
      } else {
        setErrorMessage(
          `Fehler beim Speichern: ${playerError?.message ?? "unbekannt"}`
        );
      }
      return;
    }

    // 3. Typ für die aktuelle Saison eintragen
    const { error: typeError } = await supabase.from("season_players").insert({
      season_id: season.id,
      player_id: player.id,
      player_type: playerType,
    });

    if (typeError) {
      setSaving(false);
      setErrorMessage(
        `Spieler wurde angelegt, aber der Typ konnte nicht gespeichert werden: ${typeError.message}`
      );
      return;
    }

    router.push("/players");
    router.refresh();
  }

  if (allowed === null) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p>Lädt…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p className="rounded-xl border border-gray-400 bg-white p-4 mb-4 font-semibold text-gray-700">
          Neue Spieler legt ein Admin an oder das Konto „Eintragen“ am Tag eines Spieltags.
        </p>
        <Link href="/players" className="text-green-800 font-medium">
          ← Zurück
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-green-800 mb-6">
          ➕ Spieler anlegen
        </h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl p-6 shadow space-y-5"
        >
          <div>
            <label htmlFor="name" className="block font-semibold mb-2">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSimilar(null);
              }}
              placeholder="z. B. Max M."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="nickname" className="block font-semibold mb-2">
              Spitzname (optional)
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setSimilar(null);
              }}
              placeholder="z. B. Maxi"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
              autoComplete="off"
            />
          </div>

          {isAdmin && seasons.length > 1 && (
            <div>
              <label htmlFor="season" className="block font-semibold mb-2">
                Saison
              </label>
              <select
                id="season"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-lg"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    Saison {s.season_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <span className="block font-semibold mb-2">
              Typ in dieser Saison
            </span>
            <div className="grid grid-cols-3 gap-2">
              {PLAYER_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setPlayerType(type.value)}
                  className={
                    "rounded-xl border px-2 py-3 font-semibold " +
                    (playerType === type.value
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-white border-gray-300 text-gray-800")
                  }
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <p className="text-red-600 font-medium">{errorMessage}</p>
          )}

          {similar && (
            <div className="rounded-xl border-2 border-yellow-500 bg-yellow-50 p-4">
              <p className="font-semibold text-yellow-900 mb-2">
                ⚠ Ähnlich wie schon vorhandene Spieler:
              </p>
              <ul className="mb-3 space-y-1">
                {similar.map((o, i) => (
                  <li key={i} className="text-yellow-900">
                    <span className="font-bold">{o.nickname ?? o.name}</span>
                    {o.nickname && ` (${o.name})`}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-yellow-900 mb-3">
                Ist es dieselbe Person, bitte nicht neu anlegen. Ist es eine
                andere Person, mit „Trotzdem anlegen“ speichern.
              </p>
              <button
                type="button"
                onClick={() => checkAndSave(true)}
                disabled={saving}
                className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-semibold text-white disabled:opacity-50"
              >
                Trotzdem anlegen
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-green-600 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Speichert…" : "Speichern"}
          </button>

          <Link
            href="/players"
            className="block text-center text-green-800 font-medium py-2"
          >
            Abbrechen
          </Link>
        </form>
      </div>
    </main>
  );
}
