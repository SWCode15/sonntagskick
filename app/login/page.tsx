"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Festes Konto der Runde. Die Runde gibt nur das Passwort ein.
// (Die E-Mail ist nur ein Kontoname und kein Geheimnis.)
const RUNDE_EMAIL = "login@sonntagskick.app";

export default function LoginPage() {
  const router = useRouter();

  const [adminMode, setAdminMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Wer schon angemeldet ist, geht direkt zum Dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/");
      }
    });
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);

    if (!password) {
      setErrorMessage("Bitte das Passwort eingeben.");
      return;
    }
    if (adminMode && !email.trim()) {
      setErrorMessage("Bitte die E-Mail eingeben.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: adminMode ? email.trim() : RUNDE_EMAIL,
      password,
    });
    setBusy(false);

    if (error) {
      setErrorMessage(
        adminMode
          ? "E-Mail oder Passwort stimmt nicht."
          : "Das Passwort stimmt nicht."
      );
      return;
    }

    router.replace("/");
  }

  return (
    <main className="min-h-screen bg-green-100 p-6 flex flex-col items-center">
      <h1 className="text-4xl font-bold text-green-800 mt-10 mb-2">
        ⚽ Sonntagskick
      </h1>
      <p className="text-gray-600 mb-8">
        {adminMode ? "Admin-Anmeldung" : "Bitte anmelden"}
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl p-6 shadow space-y-4"
      >
        {adminMode && (
          <div>
            <label className="block font-semibold mb-1" htmlFor="email">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-14 rounded-xl border border-gray-300 px-4 text-lg"
            />
          </div>
        )}

        <div>
          <label className="block font-semibold mb-1" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-14 rounded-xl border border-gray-300 px-4 text-lg"
          />
        </div>

        {errorMessage && (
          <p className="text-red-600 font-medium">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full h-14 rounded-xl bg-green-600 text-lg font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Anmelden…" : "Anmelden"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setAdminMode(!adminMode);
          setErrorMessage(null);
          setPassword("");
        }}
        className="mt-6 text-green-800 font-medium underline"
      >
        {adminMode ? "← Zurück zur Runden-Anmeldung" : "Admin-Anmeldung"}
      </button>
    </main>
  );
}
