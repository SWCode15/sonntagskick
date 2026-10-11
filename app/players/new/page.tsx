"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewPlayerPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
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

    const { error } = await supabase.from("players").insert({
      name: cleanName,
      nickname: cleanNickname === "" ? null : cleanNickname,
      active: true,
    });

    if (error) {
      setSaving(false);
      if (error.code === "23505") {
        setErrorMessage("Diesen Spitznamen gibt es schon. Bitte einen anderen wählen.");
      } else {
        setErrorMessage(`Fehler beim Speichern: ${error.message}`);
      }
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
