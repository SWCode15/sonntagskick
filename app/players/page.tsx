import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function Home() {
    const { data: players, error } = await supabase
        .from("players")
        .select("*");

    return (
        <main className="min-h-screen bg-green-100 p-10">
            <h1 className="text-5xl font-bold text-center text-green-800 mb-10">
                ⚽ Sonntagskick
            </h1>

            <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-4">
                    Spieler
                </h2>
                <Link href="/players/new">
                    <button className="mb-4 rounded-xl bg-green-600 px-4 py-3 text-white font-semibold">
                        ➕ Spieler hinzufügen
                    </button>
                </Link>
                {error && (
                    <p className="text-red-600">
                        Fehler: {error.message}
                    </p>
                )}

                <div className="space-y-3">
                    {players?.map((player: any) => (
                        <div
                            key={player.id}
                            className="bg-white rounded-xl p-4 shadow"
                        >
                            <div className="font-bold text-lg">
                                {player.nickname}
                            </div>

                            <div className="text-gray-600">
                                {player.name}
                            </div>

                            <div className="text-sm text-green-700">
                                {player.player_type}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
``