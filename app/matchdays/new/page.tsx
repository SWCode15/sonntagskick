"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// mode: "fixed" = feste Teamanzahl, "open" = frei wählbar
const FORMATS = [
  { id: "3", teams: 3, label: "3 Teams", hint: "Standard, 4 Runden" },
  { id: "2", teams: 2, label: "2 Teams", hint: "z. B. 5 gegen 5" },
  { id: "4", teams: 4, label: "4 Teams", hint: "selten" },
  { id: "open", teams: 0, label: "Offen", hint: "Teams frei wählen" },
];

const MIN_TEAMS = 2;
const MAX_TEAMS = 8;

function today() {
  // Format JJJJ-MM-TT in lokaler Zeit
  return new Date().toLocaleDateString("sv-SE");
}

export default function NewMatchDayPage() {
  const router = useRouter();
  const [playDate, setPlayDate] = useState(today());
  const [formatId, setFormatId] = useState("3");
  const [openTeamCount, setOpenTeamCount] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOpen = formatId === "open";
  const teamCount = isOpen
    ? openTeamCount
    : FORMATS.find((f) => f.id === formatId)?.teams ?? 3;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (playDate === "") {
      setErrorMessage("Bitte ein Datum wählen.");
      return;
    }

    setSaving(true);

    // 1. Passende Saison zum Datum suchen (neueste Saison, die bis dahin begonnen hat)
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id")
      .lte("start_date", playDate)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (seasonError || !season) {
      setSaving(false);
      setErrorMessage(
        "Für dieses Datum gibt es keine Saison. Bitte ein anderes Datum wählen."
      );
      return;
    }

    // 2. Spieltag anlegen
    const cleanNotes = notes.trim();
    const { data: matchDay, error: matchDayError } = await supabase
      .from("match_days")
      .insert({
        season_id: season.id,
        play_date: playDate,
        match_format: isOpen ? "open" : `${teamCount}_teams`,
        notes: cleanNotes === "" ? null : cleanNotes,
      })
      .select("id")
      .single();

    if (matchDayError || !matchDay) {
      setSaving(false);
      setErrorMessage(
        `Fehler beim Speichern: ${matchDayError?.message ?? "unbekannt"}`
      );
      return;
    }

    // 3. Teams 1..n für diesen Spieltag anlegen
    const teams = Array.from({ length: teamCount }, (_, i) => ({
      match_day_id: matchDay.id,
      team_number: i + 1,
    }));

    const { error: teamsError } = await supabase.from("teams").insert(teams);

    if (teamsError) {
      setSaving(false);
      setErrorMessage(
        `Spieltag wurde angelegt, aber die Teams nicht: ${teamsError.message}`
      );
      return;
    }

    router.push("/matchdays");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-green-800 mb-6">
          📅 Neuer Spieltag
        </h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl p-6 shadow space-y-5"
        >
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
          </div>

          <div>
            <span className="block font-semibold mb-2">Spielmodus</span>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((format) => (
                <button
                  key={format.id}
                  type="button"
                  onClick={() => setFormatId(format.id)}
                  className={
                    "rounded-xl border px-2 py-3 " +
                    (formatId === format.id
                      ? "bg-green-600 border-green-600 text-white"
                      : "bg-white border-gray-300 text-gray-800")
                  }
                >
                  <span className="block font-semibold">{format.label}</span>
                  <span className="block text-xs">{format.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {isOpen && (
            <div>
              <span className="block font-semibold mb-2">Anzahl Teams</span>
              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={() =>
                    setOpenTeamCount((n) => Math.max(MIN_TEAMS, n - 1))
                  }
                  disabled={openTeamCount <= MIN_TEAMS}
                  className="h-14 w-14 rounded-xl border border-gray-300 text-3xl font-bold disabled:opacity-40"
                >
                  −
                </button>
                <span className="text-4xl font-bold w-12 text-center">
                  {openTeamCount}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setOpenTeamCount((n) => Math.min(MAX_TEAMS, n + 1))
                  }
                  disabled={openTeamCount >= MAX_TEAMS}
                  className="h-14 w-14 rounded-xl border border-gray-300 text-3xl font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
              <p className="text-sm text-gray-600 text-center mt-2">
                Runden und Spiele legst du später frei an.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="notes" className="block font-semibold mb-2">
              Kommentar (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="z. B. Harry früher gegangen"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
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
            {saving ? "Speichert…" : "Spieltag anlegen"}
          </button>

          <Link
            href="/matchdays"
            className="block text-center text-green-800 font-medium py-2"
          >
            Abbrechen
          </Link>
        </form>
      </div>
    </main>
  );
}
