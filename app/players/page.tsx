import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, nickname")
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <h1 className="text-3xl font-bold mb-6">Spieler</h1>

      <Link
        href="/players/new"
        className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white mb-6"
      >
        ➕ Spieler hinzufügen
      </Link>

      {error && (
        <p className="text-red-600 font-medium mb-4">
          Fehler beim Laden: {error.message}
        </p>
      )}

      <div className="space-y-4">
        {players?.map((player) => (
          <div key={player.id} className="bg-white rounded-xl p-6 shadow">
            <p className="text-2xl font-bold">
              {player.nickname ?? player.name}
            </p>
            {player.nickname && (
              <p className="text-lg text-gray-600">{player.name}</p>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
