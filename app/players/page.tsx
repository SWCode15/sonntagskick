import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  stamm: "Stammspieler",
  springer: "Springer",
  gast: "Gast",
};

export default async function PlayersPage() {
  const { data: players, error } = await supabase
    .from("players")
    .select("id, name, nickname")
    .order("created_at", { ascending: true });

  // Aktuelle Saison = die mit dem neuesten Startdatum
  const { data: season } = await supabase
    .from("seasons")
    .select("id, season_name")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const typeByPlayer = new Map<string, string>();
  if (season) {
    const { data: seasonPlayers } = await supabase
      .from("season_players")
      .select("player_id, player_type")
      .eq("season_id", season.id);

    seasonPlayers?.forEach((sp) => {
      typeByPlayer.set(sp.player_id, sp.player_type);
    });
  }

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <h1 className="text-3xl font-bold mb-2">Spieler</h1>
      {season && (
        <p className="text-gray-600 mb-6">Saison {season.season_name}</p>
      )}

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
        {players?.map((player) => {
          const type = typeByPlayer.get(player.id);
          return (
            <div key={player.id} className="bg-white rounded-xl p-6 shadow">
              <p className="text-2xl font-bold">
                {player.nickname ?? player.name}
              </p>
              {player.nickname && (
                <p className="text-lg text-gray-600">{player.name}</p>
              )}
              <p className="text-green-700 font-medium mt-1">
                {type ? TYPE_LABELS[type] ?? type : "Kein Typ in dieser Saison"}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
