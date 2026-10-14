"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Auf der Anmeldeseite braucht es keine Leiste
  if (pathname === "/login") {
    return null;
  }

  async function logout() {
    // scope "local": meldet nur dieses Gerät ab, nicht alle anderen Handys
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
  }

  const buttonClass =
    "rounded-xl border border-green-700 bg-white px-4 py-2 font-semibold text-green-800";

  // Auf dem Dashboard nur "Abmelden"
  if (pathname === "/") {
    return (
      <nav className="sticky top-0 z-10 bg-green-100 px-6 pt-4 pb-2 flex items-center justify-end">
        <button type="button" onClick={logout} className={buttonClass}>
          Abmelden
        </button>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-10 bg-green-100 px-6 pt-4 pb-2 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => router.back()}
        className={buttonClass}
      >
        ← Zurück
      </button>
      <div className="flex gap-2">
        <Link href="/" className={buttonClass}>
          🏠 Start
        </Link>
        <button type="button" onClick={logout} className={buttonClass}>
          Abmelden
        </button>
      </div>
    </nav>
  );
}
