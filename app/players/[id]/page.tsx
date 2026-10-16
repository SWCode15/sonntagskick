"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const PLAYER_TYPES = [
  { value: "stamm", label: "Stammspieler" },
  { value: "springer", label: "Springer" },
  { value: "gast", label: "Gast" },
];

export default function EditPlayerPage() {
  const params = useParams<{ id: string }>();
  const playerId = params.id;
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [active, setActive] = useState(true);
  const [playerType, setPlayerType] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: role } = await supabase.rpc("my_role");
      const admin = role === "admin";
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }

      const { data: player, error } = await supabase
        .from("players")
        .select("id, name, nickname, active")
        .eq("id", playerId)
        .maybeSingle();

      if (error || !player) {
        setErrorMessage(error?.message ?? "Spieler nicht gefunden.");
        setLoading(false);
        return;
      }
      setName(player.name);
      setNickname(player.nickname ?? "");
      setActive(player.active);

      const { data: season } = await supabase
        .from("seasons")
        .select("id, season_name")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (season) {
        setSeasonId(season.id);
        setSeasonName(season.season_name);
        const { data: sp } = await supabase
          .from("season_players")
          .select("player_type")
          .eq("season_id", season.id)
          .eq("player_id", playerId)
          .maybeSingle();
        setPlayerType(sp ? sp.player_type : null);
      }
      setLoading(false);
    }
    load();
  }, [playerId]);

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

    const { error: playerError } = await supabase
      .from("players")
      .update({
        name: cleanName,
        nickname: cleanNickname === "" ? null : cleanNickname,
        active,
      })
      .eq("id", playerId);

    if (playerError) {
      setSaving(false);
      setErrorMessage(
        playerError.code === "23505"
          ? "Diesen Spitznamen gibt es schon. Bitte einen anderen wählen."
          : `Fehler beim Speichern: ${playerError.message}`
      );
      return;
    }

    if (seasonId && playerType) {
      const { data: existing } = await supabase
        .from("season_players")
        .select("player_id")
        .eq("season_id", seasonId)
        .eq("player_id", playerId)
        .maybeSingle();

      const { error: typeError } = existing
        ? await supabase
            .from("season_players")
            .update({ player_type: playerType })
            .eq("season_id", seasonId)
            .eq("player_id", playerId)
        : await supabase.from("season_players").insert({
            season_id: seasonId,
            player_id: playerId,
            player_type: playerType,
          });

      if (typeError) {
        setSaving(false);
        setErrorMessage(
          `Name gespeichert, aber der Typ nicht: ${typeError.message}`
        );
        return;
      }
    }

    router.push("/players");
    router.refresh();
  }

  if (loading || isAdmin === null) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p>Lädt…</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p className="rounded-xl border border-gray-400 bg-white p-4 mb-4 font-semibold text-gray-700">
          Spieler ändern darf nur ein Admin.
        </p>
        <Link href="/players" className="text-green-800 font-medium">
          ← Zurück
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-green-800 mb-6">
          ✏ Spieler ändern
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
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg"
              autoComplete="off"
            />
          </div>

          <div>
            <span className="block font-semibold mb-2">
              Typ in Saison {seasonName ?? ""}
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
            {playerType === null && (
              <p className="text-sm text-gray-600 mt-2">
                Noch kein Typ in dieser Saison. Auswählen, um ihn zu setzen.
              </p>
            )}
          </div>

          <div>
            <span className="block font-semibold mb-2">Status</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActive(true)}
                className={
                  "rounded-xl border px-2 py-3 font-semibold " +
                  (active
                    ? "bg-green-600 border-green-600 text-white"
                    : "bg-white border-gray-300 text-gray-800")
                }
              >
                Aktiv
              </button>
              <button
                type="button"
                onClick={() => setActive(false)}
                className={
                  "rounded-xl border px-2 py-3 font-semibold " +
                  (!active
                    ? "bg-gray-600 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-800")
                }
              >
                Inaktiv
              </button>
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
