"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type MatchDayRow = {
  id: string;
  play_date: string;
  notes: string | null;
  season_id: string;
  teams: { id: string }[];
};

type Season = {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
};

const SEASON_KEY = "sk_season";
const ALL = "alle";

function readSavedSeason(): string | null {
  try {
    return localStorage.getItem(SEASON_KEY);
  } catch {
    return null;
  }
}

function saveSeason(value: string) {
  try {
    localStorage.setItem(SEASON_KEY, value);
  } catch {
    // ohne Speicher funktioniert die Seite trotzdem
  }
}

function formatDate(isoDate: string) {
  // isoDate = "2026-10-11" -> "So., 11.10.2026"
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Heutiges Datum in Wien als "JJJJ-MM-TT" (unabhängig vom Server-Standort)
function todayVienna() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
}

function DayCard({
  matchDay,
  size,
  seasonName,
}: {
  matchDay: MatchDayRow;
  size: "big" | "normal";
  seasonName?: string;
}) {
  return (
    <Link
      href={`/matchdays/${matchDay.id}`}
      className={
        "block bg-white rounded-xl shadow " +
        (size === "big" ? "p-6 border-2 border-green-600" : "p-4")
      }
    >
      <p className={size === "big" ? "text-2xl font-bold" : "text-lg font-bold"}>
        {formatDate(matchDay.play_date)}
      </p>
      <p className="text-green-700 font-medium mt-1">
        {matchDay.teams.length} Teams
        {seasonName && (
          <span className="text-gray-500 font-normal"> · Saison {seasonName}</span>
        )}
      </p>
      {matchDay.notes && <p className="text-gray-600 mt-1">{matchDay.notes}</p>}
    </Link>
  );
}

export default function MatchDaysPage() {
  const [matchDays, setMatchDays] = useState<MatchDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selected, setSelected] = useState<string>(ALL);

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, []);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("match_days")
        .select("id, play_date, notes, season_id, teams(id)")
        .order("play_date", { ascending: true });

      const { data: seasonRows } = await supabase
        .from("seasons")
        .select("id, season_name, start_date, end_date")
        .order("start_date", { ascending: false });
      const seasonList = (seasonRows ?? []) as Season[];
      setSeasons(seasonList);

      // Vorauswahl: gemerkte Saison, sonst die Saison von heute, sonst die neueste
      const saved = readSavedSeason();
      const todayStr = todayVienna();
      const current =
        seasonList.find((s) => s.start_date <= todayStr && todayStr <= s.end_date) ??
        seasonList[0];
      if (saved === ALL || seasonList.some((s) => s.id === saved)) {
        setSelected(saved as string);
      } else if (current) {
        setSelected(current.id);
      }

      if (error) {
        setErrorMessage(error.message);
      } else {
        setMatchDays((data ?? []) as MatchDayRow[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const today = todayVienna();

  const seasonName = (id: string) =>
    seasons.find((s) => s.id === id)?.season_name;
  const shown =
    selected === ALL ? matchDays : matchDays.filter((m) => m.season_id === selected);
  // Bei „Alle Saisons“ steht die Saison bei jedem Spieltag dabei
  const nameFor = (m: MatchDayRow) =>
    selected === ALL ? seasonName(m.season_id) : undefined;

  // Heute und Zukunft: aufsteigend (nächster zuerst). Vergangenheit: absteigend.
  const upcoming = shown.filter((m) => m.play_date >= today);
  const past = shown.filter((m) => m.play_date < today).reverse();

  const next = upcoming[0];
  const later = upcoming.slice(1);

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <h1 className="text-3xl font-bold mb-4">Spieltage</h1>

      {seasons.length > 0 && (
        <div className="mb-6">
          <label htmlFor="season" className="block font-semibold mb-1">
            Saison
          </label>
          <select
            id="season"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              saveSeason(e.target.value);
            }}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-lg"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                Saison {s.season_name}
              </option>
            ))}
            <option value={ALL}>Alle Saisons</option>
          </select>
        </div>
      )}

      {isAdmin && (
        <Link
          href="/matchdays/new"
          className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white mb-6"
        >
          ➕ Neuer Spieltag
        </Link>
      )}

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">
          Fehler beim Laden: {errorMessage}
        </p>
      )}

      {loading && <p className="text-gray-600">Lädt…</p>}

      {!loading && shown.length === 0 && !errorMessage && (
        <p className="text-gray-600">
          {matchDays.length === 0
            ? "Noch kein Spieltag angelegt."
            : "In dieser Saison gibt es keinen Spieltag."}
        </p>
      )}

      {next && (
        <section className="mb-8">
          <h2 className="font-semibold text-green-900 mb-2">
            {next.play_date === today ? "⚽ Heute" : "⚽ Nächster Spieltag"}
          </h2>
          <DayCard matchDay={next} size="big" seasonName={nameFor(next)} />
        </section>
      )}

      {later.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-green-900 mb-2">
            Kommende Spieltage
          </h2>
          <div className="space-y-3">
            {later.map((m) => (
              <DayCard
                key={m.id}
                matchDay={m}
                size="normal"
                seasonName={nameFor(m)}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-green-900 mb-2">
            Vergangene Spieltage
          </h2>
          <div className="space-y-3">
            {past.map((m) => (
              <DayCard
                key={m.id}
                matchDay={m}
                size="normal"
                seasonName={nameFor(m)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
