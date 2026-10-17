"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Player = {
  id: string;
  name: string;
  nickname: string | null;
  active: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  stamm: "Stammspieler",
  springer: "Springer",
  gast: "Gast",
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [typeByPlayer, setTypeByPlayer] = useState<Map<string, string>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canAdd, setCanAdd] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.rpc("can_write_today").then(({ data }) => setCanAdd(data === true));
    supabase.rpc("my_role").then(({ data }) => setIsAdmin(data === "admin"));
  }, []);

  useEffect(() => {
    async function load() {
      const { data: playerRows, error } = await supabase
        .from("players")
        .select("id, name, nickname, active")
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Aktuelle Saison = die mit dem neuesten Startdatum
      const { data: season } = await supabase
        .from("seasons")
        .select("id, season_name")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const types = new Map<string, string>();
      if (season) {
        const { data: seasonPlayers } = await supabase
          .from("season_players")
          .select("player_id, player_type")
          .eq("season_id", season.id);

        seasonPlayers?.forEach((sp) => {
          types.set(sp.player_id, sp.player_type);
        });
      }

      setPlayers(playerRows ?? []);
      setSeasonName(season ? season.season_name : null);
      setTypeByPlayer(types);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <h1 className="text-3xl font-bold mb-2">Spieler</h1>
      {seasonName && <p className="text-gray-600 mb-6">Saison {seasonName}</p>}

      {canAdd && (
        <Link
          href="/players/new"
          className="inline-block rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white mb-6"
        >
          ➕ Spieler hinzufügen
        </Link>
      )}

      {isAdmin && (
        <Link
          href="/players/merge"
          className="inline-block rounded-xl border border-green-700 bg-white px-6 py-4 text-lg font-semibold text-green-800 mb-6 ml-0 sm:ml-3"
        >
          🔀 Spieler zusammenführen
        </Link>
      )}

      {errorMessage && (
        <p className="text-red-600 font-medium mb-4">
          Fehler beim Laden: {errorMessage}
        </p>
      )}

      {loading && <p className="text-gray-600">Lädt…</p>}

      <div className="space-y-4">
        {players.map((player) => {
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
                {!player.active && (
                  <span className="ml-2 text-gray-500">· inaktiv</span>
                )}
              </p>
              {isAdmin && (
                <Link
                  href={`/players/${player.id}/edit`}
                  className="inline-block mt-3 rounded-xl border border-green-700 px-4 py-2 font-semibold text-green-800"
                >
                  ✏ Ändern
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
