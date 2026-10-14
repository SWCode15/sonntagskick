"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type MatchDayRow = {
  id: string;
  play_date: string;
  notes: string | null;
  teams: { id: string }[];
};

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
}: {
  matchDay: MatchDayRow;
  size: "big" | "normal";
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
      </p>
      {matchDay.notes && <p className="text-gray-600 mt-1">{matchDay.notes}</p>}
    </Link>
  );
}

export default function MatchDaysPage() {
  const [matchDays, setMatchDays] = useState<MatchDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("match_days")
        .select("id, play_date, notes, teams(id)")
        .order("play_date", { ascending: true });

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

  // Heute und Zukunft: aufsteigend (nächster zuerst). Vergangenheit: absteigend.
  const upcoming = matchDays.filter((m) => m.play_date >= today);
  const past = matchDays.filter((m) => m.play_date < today).reverse();

  const next = upcoming[0];
  const later = upcoming.slice(1);

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Spieltage</h1>

      <Link
        href="/matchdays/new"
        className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white mb-6"
      >
        ➕ Neuer Spieltag
      </Link>

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">
          Fehler beim Laden: {errorMessage}
        </p>
      )}

      {loading && <p className="text-gray-600">Lädt…</p>}

      {!loading && matchDays.length === 0 && !errorMessage && (
        <p className="text-gray-600">Noch kein Spieltag angelegt.</p>
      )}

      {next && (
        <section className="mb-8">
          <h2 className="font-semibold text-green-900 mb-2">
            {next.play_date === today ? "⚽ Heute" : "⚽ Nächster Spieltag"}
          </h2>
          <DayCard matchDay={next} size="big" />
        </section>
      )}

      {later.length > 0 && (
        <section className="mb-8">
          <h2 className="font-semibold text-green-900 mb-2">
            Kommende Spieltage
          </h2>
          <div className="space-y-3">
            {later.map((m) => (
              <DayCard key={m.id} matchDay={m} size="normal" />
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
              <DayCard key={m.id} matchDay={m} size="normal" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
