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

type Season = {
  id: string;
  season_name: string;
  start_date: string;
  end_date: string;
};

const SEASON_KEY = "sk_season";

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

const TYPE_LABELS: Record<string, string> = {
  stamm: "Stammspieler",
  springer: "Springer",
  gast: "Gast",
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
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

      const { data: seasonRows } = await supabase
        .from("seasons")
        .select("id, season_name, start_date, end_date")
        .order("start_date", { ascending: false });
      const list = (seasonRows ?? []) as Season[];

      // Vorauswahl: gemerkte Saison, sonst die Saison von heute, sonst die neueste
      const saved = readSavedSeason();
      const todayStr = new Date().toLocaleDateString("sv-SE", {
        timeZone: "Europe/Vienna",
      });
      const current =
        list.find((s) => s.start_date <= todayStr && todayStr <= s.end_date) ??
        list[0];
      const chosen = list.some((s) => s.id === saved)
        ? (saved as string)
        : current?.id ?? null;

      setPlayers((playerRows ?? []) as Player[]);
      setSeasons(list);
      setSeasonId(chosen);
      setLoading(false);
    }
    load();
  }, []);

  // Typen der gewählten Saison laden
  useEffect(() => {
    async function loadTypes() {
      const types = new Map<string, string>();
      if (seasonId) {
        const { data: seasonPlayers } = await supabase
          .from("season_players")
          .select("player_id, player_type")
          .eq("season_id", seasonId);
        seasonPlayers?.forEach((sp) => {
          types.set(sp.player_id, sp.player_type);
        });
      }
      setTypeByPlayer(types);
    }
    loadTypes();
  }, [seasonId]);

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <h1 className="text-3xl font-bold mb-2">Spieler</h1>
      {seasons.length > 0 && (
        <div className="mb-6">
          <label htmlFor="season" className="block font-semibold mb-1">
            Saison (für den Typ)
          </label>
          <select
            id="season"
            value={seasonId ?? ""}
            onChange={(e) => {
              setSeasonId(e.target.value);
              saveSeason(e.target.value);
            }}
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
