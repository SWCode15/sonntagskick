"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PLAYER_TYPES = [
  { value: "stamm", label: "Stammspieler" },
  { value: "springer", label: "Springer" },
  { value: "gast", label: "Gast" },
];

export default function NewPlayerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [playerType, setPlayerType] = useState("stamm");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    const cleanNickname = nickname.trim();

    if (cleanName === "") {
      setErrorMessage("Bitte einen Namen eingeben.");
      return;
    }

    setSaving(true);

    // 1. Aktuelle Saison suchen (die mit dem neuesten Startdatum)
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (seasonError || !season) {
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
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setNickname(e.target.value)}
              placeholder="z. B. Maxi"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
              autoComplete="off"
            />
          </div>

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
