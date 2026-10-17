"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, []);

  return (
    <main className="min-h-screen bg-green-100 p-10">
      <h1 className="text-5xl font-bold text-center text-green-800 mb-10">
        ⚽ Sonntagskick
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Link href="/matchdays">
          <div className="bg-white rounded-xl p-6 shadow hover:shadow-lg transition cursor-pointer">
            <h2 className="text-2xl font-bold">⚽ Spieltage</h2>
            <p>Teams und Ergebnisse erfassen</p>
          </div>
        </Link>

        <Link href="/players">
          <div className="bg-white rounded-xl p-6 shadow hover:shadow-lg transition cursor-pointer">
            <h2 className="text-2xl font-bold">👥 Spieler</h2>
            <p>Spielerliste verwalten</p>
          </div>
        </Link>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-2xl font-bold">📊 Statistiken</h2>
          <p>Auswertungen und Rankings</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-2xl font-bold">❌ Strichl-Tabelle</h2>
          <p>Verliererwertung der Saison</p>
        </div>

        {isAdmin && (
          <Link href="/seasons">
            <div className="bg-white rounded-xl p-6 shadow hover:shadow-lg transition cursor-pointer">
              <h2 className="text-2xl font-bold">🗓 Saisons</h2>
              <p>Saisons anlegen, Spieler übernehmen</p>
            </div>
          </Link>
        )}
      </div>
    </main>
  );
}
