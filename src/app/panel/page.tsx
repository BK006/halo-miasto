"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { StatusBadge, Toast, UrgencyBadge } from "@/components/ui";
import { CATEGORIES, CATEGORY_IDS, isCategoryId, type CategoryId } from "@/config/categories";
import { UNITS, unitById, type UnitId } from "@/config/units";
import type { ReportDTO } from "@/lib/api-types";
import { callFunction } from "@/lib/client/functions";
import { urgencyOf, type ReportStatus, type UrgencyLevel } from "@/lib/domain";
import { formatDayTime, formatDuration, isToday, plural } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase";

const PanelMap = dynamic(() => import("@/components/panel/PanelMap"), { ssr: false });

const PASS_KEY = "zt.panel";

type StatusFilter = "all" | "open" | "accepted" | "resolved";
const STATUS_FILTERS: { id: StatusFilter; label: string; match: (s: ReportStatus) => boolean }[] = [
  { id: "all", label: "Wszystkie", match: () => true },
  { id: "open", label: "Do przyjęcia", match: (s) => s === "new" || s === "sent" },
  { id: "accepted", label: "Przyjęte", match: (s) => s === "accepted" },
  { id: "resolved", label: "Zrealizowane", match: (s) => s === "resolved" },
];

const URGENCY_FILTERS: { id: UrgencyLevel; label: string; dot: string }[] = [
  { id: "high", label: "Wysoka 7–10", dot: "#C2352A" },
  { id: "medium", label: "Średnia 4–6", dot: "#E3A23B" },
  { id: "low", label: "Niska 1–3", dot: "#23704A" },
];

// Next actions per status, as in the design.
const ACTIONS: Record<ReportStatus, { primary?: [string, ReportStatus]; secondary?: [string, ReportStatus | "handover"] }> = {
  new: { primary: ["Przyjmij do realizacji", "accepted"], secondary: ["Przekaż innej jednostce", "handover"] },
  sent: { primary: ["Przyjmij do realizacji", "accepted"], secondary: ["Przekaż innej jednostce", "handover"] },
  accepted: { primary: ["Oznacz jako zrealizowane", "resolved"], secondary: ["Cofnij do nowych", "sent"] },
  resolved: { secondary: ["Otwórz ponownie", "accepted"] },
};

const STATUS_TOAST: Record<ReportStatus, string> = {
  new: "Nowe",
  sent: "Do przyjęcia",
  accepted: "Przyjęte",
  resolved: "Zrealizowane",
};

function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors"
      style={{
        background: on ? "var(--text-1)" : "var(--bg)",
        color: on ? "var(--bg)" : "var(--text-1)",
        borderColor: on ? "var(--text-1)" : "var(--field)",
      }}
    >
      {children}
    </button>
  );
}

function Kpi({ label, sub, value }: { label: string; sub: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-[14px] border border-line px-[18px] py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-text-3">{label}</span>
        <span className="truncate text-[13px] text-text-3">{sub}</span>
      </div>
      <span className="tabular flex-none text-[32px] font-bold leading-[38px]">{value}</span>
    </div>
  );
}

// --- Passcode gate ------------------------------------------------------------

function Login({ onLogin, error }: { onLogin: (code: string) => void; error: string | null }) {
  const [code, setCode] = useState("");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code) onLogin(code);
        }}
        className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-line bg-bg p-7"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
            <Icon name="pin" size={18} />
          </span>
          <span className="text-lg font-bold">Zgłoś to · Panel urzędu</span>
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Hasło dostępu</span>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            className="h-12 rounded-xl border border-field bg-bg px-4 outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)]"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="h-12 rounded-xl bg-accent font-semibold text-on-accent hover:bg-accent-hover">Zaloguj</button>
      </form>
    </main>
  );
}

// --- Panel ------------------------------------------------------------------------

export default function PanelPage() {
  const [pass, setPass] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportDTO[] | null>(null);
  // Time of the last load; "this week" KPIs are relative to it (keeps render pure).
  const [loadedAt, setLoadedAt] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"pins" | "heat">("pins");
  const [fStatus, setFStatus] = useState<StatusFilter>("open");
  const [fUrg, setFUrg] = useState<UrgencyLevel[]>([]);
  const [fCat, setFCat] = useState<CategoryId | null>(null);
  const [fUnit, setFUnit] = useState<UnitId | "all">("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [handover, setHandover] = useState(false);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const knownIds = useRef<Set<string>>(new Set());

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(
    async (code: string, announce = false) => {
      const data = await callFunction<{ reports?: ReportDTO[]; error?: string }>("panel", {
        headers: { "x-panel-passcode": code },
      });
      if (!data.reports) {
        setAuthError(data.error ?? "Nie udało się zalogować.");
        setPass(null);
        try {
          sessionStorage.removeItem(PASS_KEY);
        } catch {}
        return;
      }
      const list = data.reports.map((r) => ({
        ...r,
        category: isCategoryId(r.category) ? r.category : ("other" as CategoryId),
        unitName: unitById(r.unitId)?.name ?? r.unitId,
      }));
      if (announce) {
        const fresh = list.find((r) => !knownIds.current.has(r.id));
        if (fresh) flash(`Nowe zgłoszenie ${fresh.publicNo}: ${CATEGORIES[fresh.category].label}`);
      }
      knownIds.current = new Set(list.map((r) => r.id));
      setReports(list);
      setLoadedAt(Date.now());
    },
    [flash],
  );

  function login(code: string) {
    setAuthError(null);
    setPass(code);
    try {
      sessionStorage.setItem(PASS_KEY, code);
    } catch {}
    void load(code);
  }

  // Restore session; then keep the list live via Realtime.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(PASS_KEY);
    } catch {}
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a client-only session
      setPass(saved);
      void load(saved);
    }
  }, [load]);

  useEffect(() => {
    if (!pass) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(pass, true), 400);
    };
    const channel = supabaseBrowser()
      .channel("panel-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabaseBrowser().removeChannel(channel);
    };
  }, [pass, load]);

  const unitScoped = useMemo(
    () => (reports ?? []).filter((r) => fUnit === "all" || r.unitId === fUnit),
    [reports, fUnit],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const statusMatch = STATUS_FILTERS.find((f) => f.id === fStatus)!.match;
    return unitScoped
      .filter((r) => statusMatch(r.status))
      .filter((r) => fUrg.length === 0 || fUrg.includes(urgencyOf(r.priority)))
      .filter((r) => !fCat || r.category === fCat)
      .filter((r) => !q || r.publicNo.toLowerCase().includes(q) || (r.address ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.priority - a.priority || b.reportersCount - a.reportersCount || b.createdAt.localeCompare(a.createdAt));
  }, [unitScoped, fStatus, fUrg, fCat, query]);

  const kpis = useMemo(() => {
    const newToday = unitScoped.filter((r) => isToday(r.createdAt)).length;
    const inProgress = unitScoped.filter((r) => r.status === "accepted").length;
    const reactions = unitScoped
      .map((r) => {
        const sent = r.history.find((h) => h.status === "sent");
        const acc = r.history.find((h) => h.status === "accepted");
        return sent && acc ? new Date(acc.changedAt).getTime() - new Date(sent.changedAt).getTime() : null;
      })
      .filter((x): x is number => x !== null && x >= 0);
    const avg = reactions.length ? reactions.reduce((a, b) => a + b, 0) / reactions.length : null;
    const weekAgo = loadedAt - 7 * 86_400_000;
    const week = unitScoped.filter((r) => new Date(r.createdAt).getTime() >= weekAgo);
    const counts = new Map<CategoryId, number>();
    for (const r of week) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      newToday,
      inProgress,
      avg: avg === null ? "—" : formatDuration(avg),
      top: top ? { cat: top[0], share: Math.round((top[1] / week.length) * 100) } : null,
    };
  }, [unitScoped, loadedAt]);

  const selected = (reports ?? []).find((r) => r.id === selectedId) ?? null;

  async function patch(body: { status?: ReportStatus; unitId?: UnitId }, message: string) {
    if (!selected || !pass) return;
    setBusy(true);
    const res = await callFunction<{ ok?: boolean; error?: string }>("panel", {
      method: "POST",
      headers: { "x-panel-passcode": pass },
      body: JSON.stringify({ id: selected.id, ...body }),
    });
    setBusy(false);
    setHandover(false);
    if (!res.ok) return flash(res.error ?? "Nie udało się zapisać zmiany.");
    flash(message);
    void load(pass);
  }

  if (!pass) return <Login onLogin={login} error={authError} />;

  const unitLabel = fUnit === "all" ? "Wszystkie jednostki" : UNITS[fUnit].name;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      {/* Header */}
      <header className="flex h-14 flex-none items-center gap-4 border-b border-line px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-on-accent">
            <Icon name="pin" size={16} />
          </span>
          <span className="text-[17px] font-bold">Zgłoś to</span>
        </div>
        <span className="h-5 w-px bg-line" />
        <label className="flex items-center gap-1 text-[15px] text-text-2">
          <span className="hidden sm:inline">Panel urzędu ·</span>
          <select
            value={fUnit}
            onChange={(e) => setFUnit(e.target.value as UnitId | "all")}
            className="cursor-pointer rounded-lg bg-transparent py-1 pr-1 font-semibold text-text-1 outline-none hover:bg-surface"
            style={{ fontSize: 15 }}
            aria-label="Jednostka"
          >
            <option value="all">Wszystkie jednostki</option>
            {Object.values(UNITS).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto hidden h-9 w-80 items-center gap-2 rounded-[10px] border border-field px-3 text-text-3 md:flex">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po numerze lub adresie"
            className="min-w-0 flex-1 bg-transparent text-text-1 outline-none placeholder:text-text-3"
            style={{ fontSize: 14 }}
          />
        </div>
      </header>

      {/* KPIs */}
      <div className="grid flex-none grid-cols-2 gap-3 border-b border-line px-6 py-4 xl:grid-cols-4">
        <Kpi label="Nowe dziś" sub="od 0:00" value={kpis.newToday} />
        <Kpi label="W realizacji" sub="przyjęte, niezamknięte" value={kpis.inProgress} />
        <Kpi label="Średni czas reakcji" sub="wysłane → przyjęte" value={kpis.avg} />
        <div className="flex items-baseline justify-between gap-3 rounded-[14px] border border-line px-[18px] py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-text-3">Najczęstsza kategoria</span>
            <span className="text-[13px] text-text-3">{kpis.top ? `${kpis.top.share}% w tym tygodniu` : "brak danych"}</span>
          </div>
          {kpis.top && (
            <span className="flex items-center gap-2 text-xl font-bold leading-[38px]">
              <Icon name={CATEGORIES[kpis.top.cat].icon} />
              <span className="truncate">{CATEGORIES[kpis.top.cat].label}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Map */}
        <div className="relative h-[40vh] flex-none overflow-hidden bg-surface lg:h-auto lg:flex-1">
          <PanelMap reports={visible} selectedId={selectedId} mode={mode} onSelect={setSelectedId} />
          <div
            className="absolute left-4 top-4 z-[500] flex gap-1 rounded-xl bg-bg p-1"
            style={{ boxShadow: "var(--shadow-float)" }}
          >
            {(
              [
                ["pins", "pin", "Pinezki"],
                ["heat", "flame", "Mapa cieplna"],
              ] as const
            ).map(([id, icon, label]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className="flex h-9 items-center gap-1.5 rounded-[9px] px-3 text-sm font-semibold"
                style={{ background: mode === id ? "var(--text-1)" : "transparent", color: mode === id ? "var(--bg)" : "var(--text-1)" }}
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>
          <div
            className="absolute bottom-4 left-4 z-[500] rounded-xl bg-bg px-3.5 py-2.5 text-[13px] font-semibold text-text-2"
            style={{ boxShadow: "var(--shadow-float)" }}
          >
            {mode === "pins" ? (
              <div className="flex items-center gap-4">
                {URGENCY_FILTERS.map((u) => (
                  <span key={u.id} className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: u.dot }} />
                    {u.label}
                  </span>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                Mniej
                <span className="h-2 w-[120px] rounded" style={{ background: "linear-gradient(90deg,rgba(194,53,42,.08),rgba(194,53,42,.7))" }} />
                Więcej zgłoszeń × pilność
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex min-h-0 flex-1 flex-col border-line lg:w-[420px] lg:flex-none lg:border-l">
          <div className="flex flex-col gap-3 border-b border-line px-5 pt-4 pb-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold">Zgłoszenia</span>
                <span className="tabular text-sm text-text-3">{visible.length}</span>
              </div>
              <span className="text-[13px] font-semibold text-text-2">Sortuj: pilność ↓</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <Chip key={f.id} on={fStatus === f.id} onClick={() => setFStatus(f.id)}>
                  {f.label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {URGENCY_FILTERS.map((u) => {
                const on = fUrg.includes(u.id);
                return (
                  <Chip key={u.id} on={on} onClick={() => setFUrg((s) => (on ? s.filter((x) => x !== u.id) : [...s, u.id]))}>
                    <span className="h-2 w-2 rounded-full" style={{ background: u.dot }} />
                    {u.label}
                  </Chip>
                );
              })}
            </div>
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
              <Chip on={fCat === null} onClick={() => setFCat(null)}>
                Wszystkie
              </Chip>
              {CATEGORY_IDS.map((c) => (
                <Chip key={c} on={fCat === c} onClick={() => setFCat(fCat === c ? null : c)} title={CATEGORIES[c].label}>
                  <Icon name={CATEGORIES[c].icon} size={16} />
                  {CATEGORIES[c].label}
                </Chip>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {reports === null ? (
              <li className="px-5 py-10 text-center text-[15px] text-text-3">Wczytuję zgłoszenia…</li>
            ) : visible.length === 0 ? (
              <li className="px-5 py-10 text-center text-[15px] text-text-3">Brak zgłoszeń dla wybranych filtrów.</li>
            ) : (
              visible.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className="flex w-full gap-3 border-b border-surface-2 px-5 py-3.5 text-left transition-colors hover:bg-surface"
                    style={{ background: r.id === selectedId ? "var(--accent-bg)" : undefined }}
                  >
                    <div className="hatch flex h-[52px] w-[52px] flex-none items-center justify-center overflow-hidden rounded-[10px] text-text-2">
                      {r.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon name={CATEGORIES[r.category].icon} />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-semibold leading-5">{CATEGORIES[r.category].label}</span>
                        <span className="ml-auto whitespace-nowrap text-[13px] text-text-3">{formatDayTime(r.createdAt)}</span>
                      </div>
                      <div className="truncate text-sm leading-5 text-text-2">{r.address}</div>
                      <div className="mt-[3px] flex items-center gap-1.5">
                        <UrgencyBadge priority={r.priority} />
                        <StatusBadge status={r.status} />
                        <span className="tabular ml-auto flex items-center gap-1 text-[13px] text-text-3">
                          <Icon name="users" size={14} />
                          {r.reportersCount}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Detail */}
        <aside
          className={`${selected ? "fixed inset-0 z-[600] flex" : "hidden"} min-h-0 flex-col border-line bg-bg lg:static lg:z-auto lg:flex lg:w-[380px] lg:flex-none lg:border-l`}
        >
          {selected ? (
            <>
              <div className="flex h-[52px] flex-none items-center justify-between border-b border-line pr-3 pl-5">
                <span className="tabular text-sm font-semibold">{selected.publicNo}</span>
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Zamknij"
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-2 hover:bg-surface"
                >
                  <Icon name="x" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
                <div className="hatch flex h-[168px] flex-none items-center justify-center overflow-hidden rounded-[14px] text-text-3">
                  {selected.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.photoUrl} alt="Zdjęcie zgłoszenia" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-[13px]">
                      <Icon name={CATEGORIES[selected.category].icon} size={32} />
                      zdjęcie · dane przykładowe
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <span className="inline-flex h-7 items-center gap-1.5 self-start rounded-lg bg-surface pr-2.5 pl-2 text-[13px] font-semibold">
                    <Icon name={CATEGORIES[selected.category].icon} size={16} />
                    {CATEGORIES[selected.category].label}
                  </span>
                  <span className="text-xl font-semibold leading-[26px]">{selected.address}</span>
                  <span className="text-sm text-text-3">{selected.unitName}</span>
                </div>
                <div className="flex flex-col gap-2 rounded-[14px] bg-surface px-3.5 py-3">
                  <span className="self-start">
                    <UrgencyBadge priority={selected.priority} />
                  </span>
                  <span className="text-sm leading-5">{selected.priorityReason}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold text-text-3">Opis AI</span>
                  <p className="text-pretty text-[15px] leading-[22px]">{selected.summary}</p>
                </div>
                <div className="flex flex-col gap-2.5 text-sm leading-5 text-text-2">
                  <div className="flex items-center gap-2.5 font-semibold text-text-1">
                    <Icon name="users" size={18} />
                    {selected.reportersCount === 1
                      ? "Zgłosiła 1 osoba"
                      : `${plural(selected.reportersCount, "Zgłosiła", "Zgłosiły", "Zgłosiło")} ${selected.reportersCount} ${plural(selected.reportersCount, "osoba", "osoby", "osób")}`}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Icon name="clock" size={18} />
                    Pierwsze zgłoszenie: {formatDayTime(selected.createdAt)}
                  </div>
                </div>
                <details className="group">
                  <summary className="cursor-pointer text-[13px] font-semibold text-accent">Treść pisma do urzędu</summary>
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-surface p-3 text-sm leading-5 text-text-2">
                    {selected.reportText}
                  </p>
                </details>
              </div>
              <div className="flex flex-none flex-col gap-2.5 border-t border-line px-5 pt-3.5 pb-[max(env(safe-area-inset-bottom),18px)]">
                <div className="flex items-center justify-between text-[13px] font-semibold text-text-3">
                  Status
                  <StatusBadge status={selected.status} />
                </div>
                {handover ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-text-3">Przekaż do</span>
                    {Object.values(UNITS)
                      .filter((u) => u.id !== selected.unitId)
                      .map((u) => (
                        <button
                          key={u.id}
                          disabled={busy}
                          onClick={() => patch({ unitId: u.id as UnitId }, `Przekazano do: ${u.name}`)}
                          className="h-10 rounded-[10px] border border-field px-3 text-left text-sm font-medium hover:bg-surface"
                        >
                          {u.name}
                        </button>
                      ))}
                    <button onClick={() => setHandover(false)} className="h-9 text-sm font-semibold text-accent">
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <>
                    {ACTIONS[selected.status].primary && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          const [, to] = ACTIONS[selected.status].primary!;
                          void patch({ status: to }, `Status zmieniony: ${STATUS_TOAST[to]}`);
                        }}
                        className="h-12 w-full rounded-xl bg-accent text-base font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-60"
                      >
                        {ACTIONS[selected.status].primary![0]}
                      </button>
                    )}
                    {ACTIONS[selected.status].secondary && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          const [, to] = ACTIONS[selected.status].secondary!;
                          if (to === "handover") setHandover(true);
                          else void patch({ status: to }, `Status zmieniony: ${STATUS_TOAST[to]}`);
                        }}
                        className="h-11 w-full rounded-xl border border-field bg-bg text-[15px] font-semibold hover:bg-surface disabled:opacity-60"
                      >
                        {ACTIONS[selected.status].secondary![0]}
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-8 text-center text-text-3">
              <Icon name="pin" size={24} />
              <span className="text-[15px] leading-[22px]">Wybierz zgłoszenie z listy lub z mapy.</span>
              <span className="text-[13px]">{unitLabel}</span>
            </div>
          )}
        </aside>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[700] -translate-x-1/2">
          <Toast>{toast}</Toast>
        </div>
      )}
    </div>
  );
}
