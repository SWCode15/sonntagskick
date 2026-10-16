"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Feste Konten. Die E-Mail ist nur ein Kontoname und kein Geheimnis.
// Leser und Eintragen melden sich mit Benutzername und Passwort an,
// Admins mit ihrer eigenen E-Mail.
type Role = "leser" | "eintragen" | "admin";

const ROLES: { id: Role; label: string; email: string; username: string }[] = [
  {
    id: "leser",
    label: "Leser",
    email: "login@sonntagskick.app",
    username: "leser",
  },
  {
    id: "eintragen",
    label: "Eintragen",
    email: "eintragen@sonntagskick.app",
    username: "eintragen",
  },
  { id: "admin", label: "Admin", email: "", username: "" },
];

export default function LoginPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>("leser");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const current = ROLES.find((r) => r.id === role) ?? ROLES[0];

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

    if (role === "admin" && !adminEmail.trim()) {
      setErrorMessage("Bitte die E-Mail eingeben.");
      return;
    }
    if (!password) {
      setErrorMessage("Bitte das Passwort eingeben.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: role === "admin" ? adminEmail.trim() : current.email,
      password,
    });
    setBusy(false);

    if (error) {
      setErrorMessage(
        role === "admin"
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
      <p className="text-gray-600 mb-6">Bitte anmelden</p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl p-6 shadow space-y-4"
      >
        <div>
          <p className="block font-semibold mb-1">Zugang</p>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRole(r.id);
                  setErrorMessage(null);
                  setPassword("");
                }}
                className={
                  "h-12 rounded-xl border font-semibold " +
                  (role === r.id
                    ? "bg-green-600 border-green-600 text-white"
                    : "bg-white border-gray-300 text-gray-800")
                }
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {role === "leser" && "Nur ansehen."}
            {role === "eintragen" && "Ergebnisse eintragen, nur am Spieltag."}
            {role === "admin" && "Alles verwalten."}
          </p>
        </div>

        <div>
          <label className="block font-semibold mb-1" htmlFor="username">
            {role === "admin" ? "E-Mail" : "Benutzername"}
          </label>
          {role === "admin" ? (
            <input
              id="username"
              name="username"
              type="email"
              autoComplete="username"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full h-14 rounded-xl border border-gray-300 px-4 text-lg"
            />
          ) : (
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={current.username}
              readOnly
              className="w-full h-14 rounded-xl border border-gray-300 bg-gray-100 px-4 text-lg text-gray-700"
            />
          )}
        </div>

        <div>
          <label className="block font-semibold mb-1" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            name="password"
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
    </main>
  );
}
