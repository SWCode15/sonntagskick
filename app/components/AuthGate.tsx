"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Zeigt die Seiten nur an, wenn jemand angemeldet ist.
// Ohne Anmeldung geht es zur Seite /login.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [checked, setChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session);
      setChecked(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setLoggedIn(!!session);
        setChecked(true);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const onLoginPage = pathname === "/login";

  useEffect(() => {
    if (checked && !loggedIn && !onLoginPage) {
      router.replace("/login");
    }
  }, [checked, loggedIn, onLoginPage, router]);

  // Login-Seite ist immer sichtbar
  if (onLoginPage) {
    return <>{children}</>;
  }

  if (!checked || !loggedIn) {
    return (
      <main className="min-h-screen bg-green-100 p-6">
        <p>Lädt…</p>
      </main>
    );
  }

  return <>{children}</>;
}
