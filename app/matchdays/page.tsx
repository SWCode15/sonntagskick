import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

export default async function MatchDaysPage() {
  const { data: matchDays, error } = await supabase
    .from("match_days")
    .select("id, play_date, notes, teams(id)")
    .order("play_date", { ascending: false });

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Spieltage</h1>

      <Link
        href="/matchdays/new"
        className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white mb-6"
      >
        ➕ Neuer Spieltag
      </Link>

      {error && (
        <p className="text-red-600 font-medium mb-4">
          Fehler beim Laden: {error.message}
        </p>
      )}

      {matchDays && matchDays.length === 0 && (
        <p className="text-gray-600">Noch kein Spieltag angelegt.</p>
      )}

      <div className="space-y-4">
        {matchDays?.map((matchDay) => (
          <Link
            key={matchDay.id}
            href={`/matchdays/${matchDay.id}`}
            className="block bg-white rounded-xl p-6 shadow"
          >
            <p className="text-2xl font-bold">{formatDate(matchDay.play_date)}</p>
            <p className="text-green-700 font-medium mt-1">
              {matchDay.teams.length} Teams
            </p>
            {matchDay.notes && (
              <p className="text-gray-600 mt-1">{matchDay.notes}</p>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
