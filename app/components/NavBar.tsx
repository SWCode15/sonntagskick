"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Auf dem Dashboard braucht es keine Leiste
  if (pathname === "/") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-10 bg-green-100 px-6 pt-4 pb-2 flex items-center justify-between">
      <button
        type="button"
        onClick={() => router.back()}
        className="rounded-xl border border-green-700 bg-white px-4 py-2 font-semibold text-green-800"
      >
        ← Zurück
      </button>
      <Link
        href="/"
        className="rounded-xl border border-green-700 bg-white px-4 py-2 font-semibold text-green-800"
      >
        🏠 Start
      </Link>
    </nav>
  );
}
