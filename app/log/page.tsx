"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LogRow = {
  id: number;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  table_name: string;
  action: "insert" | "update" | "delete";
  summary: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

const PAGE_SIZE = 50;

const ACTIONS = [
  { value: "", label: "Alle Aktionen" },
  { value: "insert", label: "Nur neu eingetragen" },
  { value: "update", label: "Nur geändert" },
  { value: "delete", label: "Nur gelöscht" },
];

const AREAS = [
  { value: "", label: "Alle Bereiche" },
  { value: "players", label: "Spieler" },
  { value: "seasons", label: "Saisons" },
  { value: "season_players", label: "Saison-Typen" },
  { value: "match_days", label: "Spieltage" },
  { value: "match_day_players", label: "Anwesenheit" },
  { value: "teams", label: "Teams" },
  { value: "team_players", label: "Teamzuordnung" },
  { value: "games", label: "Spiele" },
  { value: "match_day_awards", label: "Krone / Strichl" },
];

const ACCOUNTS = [
  { value: "", label: "Alle Konten" },
  { value: "admin", label: "Admin" },
  { value: "writer", label: "Eintragen" },
  { value: "reader", label: "Leser" },
  { value: "system", label: "Datenbank direkt" },
];

const RANGES = [
  { value: "all", label: "Gesamter Zeitraum" },
  { value: "today", label: "Heute" },
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "custom", label: "Von – bis" },
];

const ACTION_STYLE: Record<string, string> = {
  insert: "bg-green-100 text-green-800",
  update: "bg-amber-100 text-amber-800",
  delete: "bg-red-100 text-red-800",
};
const ACTION_LABEL: Record<string, string> = {
  insert: "neu",
  update: "geändert",
  delete: "gelöscht",
};
const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  writer: "Eintragen",
  reader: "Leser",
  system: "Datenbank",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Vienna",
  });
}

function todayVienna() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
}

function daysAgoVienna(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
}

// "JJJJ-MM-TT" in Wien -> Zeitpunkt (Anfang bzw. Ende des Tages) als ISO-Text
function viennaBoundary(day: string, end: boolean) {
  const probe = new Date(`${day}T12:00:00Z`);
  const offset = probe
    .toLocaleString("sv-SE", { timeZone: "Europe/Vienna", timeZoneName: "shortOffset" })
    .match(/GMT([+-]\d+)/);
  const hours = offset ? parseInt(offset[1], 10) : 1;
  const sign = hours >= 0 ? "+" : "-";
  const hh = String(Math.abs(hours)).padStart(2, "0");
  return new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}${sign}${hh}:00`).toISOString();
}

export default function LogPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const [action, setAction] = useState("");
  const [area, setArea] = useState("");
  const [account, setAccount] = useState("");
  const [range, setRange] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(data === true));
  }, []);

  const fetchRows = useCallback(
    async (offset: number) => {
      let q = supabase
        .from("audit_log")
        .select(
          "id, created_at, actor_email, actor_role, table_name, action, summary, old_data, new_data"
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (action) q = q.eq("action", action);
      if (area) q = q.eq("table_name", area);
      if (account) q = q.eq("actor_role", account);

      let from: string | null = null;
      let to: string | null = null;
      if (range === "today") from = todayVienna();
      else if (range === "7") from = daysAgoVienna(7);
      else if (range === "30") from = daysAgoVienna(30);
      else if (range === "custom") {
        from = fromDate || null;
        to = toDate || null;
      }
      if (from) q = q.gte("created_at", viennaBoundary(from, false));
      if (to) q = q.lte("created_at", viennaBoundary(to, true));

      return q;
    },
    [action, area, account, range, fromDate, toDate]
  );

  // Bei jeder Filteränderung neu laden
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErrorMessage(null);
      setOpen(null);
      const { data, error } = await fetchRows(0);
      if (cancelled) return;
      if (error) {
        setErrorMessage(error.message);
        setRows([]);
        setHasMore(false);
      } else {
        const list = (data ?? []) as LogRow[];
        setRows(list);
        setHasMore(list.length === PAGE_SIZE);
      }
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, fetchRows]);

  async function loadMore() {
    setLoadingMore(true);
    const { data, error } = await fetchRows(rows.length);
    setLoadingMore(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    const list = (data ?? []) as LogRow[];
    setRows((prev) => [...prev, ...list]);
    setHasMore(list.length === PAGE_SIZE);
  }

  if (isAdmin === null) {
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
          Das Änderungsprotokoll sehen nur Admins.
        </p>
        <Link href="/" className="text-green-800 font-medium">
          ← Start
        </Link>
      </main>
    );
  }

  const selectClass =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base";

  return (
    <main className="min-h-screen bg-green-100 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-green-800 font-medium">
          ← Start
        </Link>
        <h1 className="text-3xl font-bold text-green-800 mt-2 mb-1">
          📜 Änderungsprotokoll
        </h1>
        <p className="text-sm text-gray-600 mb-4">
          Wer hat wann was eingetragen, geändert oder gelöscht. Einzelne Tore
          bei laufenden Spielen werden nicht mitgeschrieben.
        </p>

        <div className="bg-white rounded-xl p-4 shadow mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className={selectClass}
            aria-label="Aktion"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={selectClass}
            aria-label="Bereich"
          >
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className={selectClass}
            aria-label="Konto"
          >
            {ACCOUNTS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className={selectClass}
            aria-label="Zeitraum"
          >
            {RANGES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          {range === "custom" && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1" htmlFor="from">
                  Von
                </label>
                <input
                  id="from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={selectClass}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1" htmlFor="to">
                  Bis
                </label>
                <input
                  id="to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className={selectClass}
                />
              </div>
            </>
          )}
        </div>

        {errorMessage && (
          <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
        )}
        {loading && <p className="text-gray-600">Lädt…</p>}
        {!loading && rows.length === 0 && !errorMessage && (
          <p className="text-gray-700">Keine Einträge für diese Auswahl.</p>
        )}

        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="bg-white rounded-xl p-4 shadow">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className={`rounded-lg px-2 py-1 text-sm font-semibold ${
                    ACTION_STYLE[r.action]
                  }`}
                >
                  {ACTION_LABEL[r.action]}
                </span>
                <span className="text-sm text-gray-600">
                  {formatDateTime(r.created_at)}
                </span>
              </div>
              <p className="font-semibold">{r.summary}</p>
              <p className="text-sm text-gray-600 mt-1">
                {ROLE_LABEL[r.actor_role ?? "system"] ?? r.actor_role}
                {r.actor_email ? ` · ${r.actor_email}` : ""}
              </p>
              <button
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="mt-2 text-sm font-semibold text-green-800"
              >
                {open === r.id ? "Details ausblenden" : "Details anzeigen"}
              </button>
              {open === r.id && (
                <div className="mt-2 space-y-2">
                  {r.old_data && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Vorher</p>
                      <pre className="text-xs bg-gray-50 rounded-lg p-2 overflow-x-auto">
                        {JSON.stringify(r.old_data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {r.new_data && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600">Nachher</p>
                      <pre className="text-xs bg-gray-50 rounded-lg p-2 overflow-x-auto">
                        {JSON.stringify(r.new_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-4 w-full rounded-xl border border-green-700 bg-white px-4 py-3 font-semibold text-green-800 disabled:opacity-50"
          >
            {loadingMore ? "Lädt…" : "Mehr laden"}
          </button>
        )}
      </div>
    </main>
  );
}
