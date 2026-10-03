"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneLogin } from "@/components/flow/PhoneLogin";
import { Icon } from "@/components/icons";
import {
  BottomActions,
  CategoryChip,
  PrimaryButton,
  Screen,
  Spinner,
  Toast,
  TopBar,
  UrgencyBadge,
} from "@/components/ui";
import { CATEGORIES, isCategoryId } from "@/config/categories";
import type { WorkerProfile, WorkerTask } from "@/lib/api-types";
import { clearWorkerSession, getWorkerSession, setWorkerSession, type Session } from "@/lib/client/device";
import { closeWorkerTask, fetchWorkerTasks } from "@/lib/client/functions";
import { preparePhoto, preloadFaceDetector } from "@/lib/client/image";
import { formatDayTime, plural } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase";

type Tab = "todo" | "done";

function greeting(): string {
  const h = new Date().getHours();
  return h < 18 ? "Dzień dobry" : "Dobry wieczór";
}

// Field worker app: assigned tasks → navigate → photo after repair → close.
export default function WorkerPage() {
  const [session, setSessionState] = useState<Session | null | undefined>(undefined);
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [tasks, setTasks] = useState<WorkerTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todo");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const knownIds = useRef<Set<string> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    const data = await fetchWorkerTasks();
    if (!data.tasks || !data.worker) {
      setError(data.error ?? "Nie udało się pobrać zadań.");
      return;
    }
    const list = data.tasks.map((t) => ({ ...t, category: isCategoryId(t.category) ? t.category : ("other" as const) }));
    // Announce tasks assigned while the app is open.
    if (knownIds.current) {
      const fresh = list.find((t) => !knownIds.current!.has(t.id) && t.status !== "resolved");
      if (fresh) flash(`Nowe zadanie: ${CATEGORIES[fresh.category].label}`);
    }
    knownIds.current = new Set(list.map((t) => t.id));
    setError(null);
    setWorker(data.worker);
    setTasks(list);
  }, [flash]);

  useEffect(() => {
    const s = getWorkerSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage read
    setSessionState(s);
    if (s) void load();
    preloadFaceDetector();
  }, [load]);

  // New assignments from the panel appear without a refresh.
  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabaseBrowser()
      .channel("worker-tasks")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void load(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabaseBrowser().removeChannel(channel);
    };
  }, [session, load]);

  function signIn(s: Session) {
    setWorkerSession(s);
    setSessionState(s);
    void load();
  }

  function signOut() {
    clearWorkerSession();
    setSessionState(null);
    setWorker(null);
    setTasks(null);
    setError(null);
  }

  if (session === undefined) return <div className="flex-1" />;

  if (!session) {
    return (
      <PhoneLogin
        onDone={signIn}
        icon="wrench"
        title="Aplikacja pracownika"
        intro="Zaloguj się numerem służbowym. Zobaczysz zgłoszenia przypisane Ci w panelu urzędu."
      />
    );
  }

  // Signed in with a number that is not on the crew list.
  if (error && !worker) {
    return (
      <Screen>
        <div className="flex flex-1 flex-col gap-4 px-6 pt-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-warning-bg text-warning">
            <Icon name="alert" size={24} />
          </div>
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em]">Brak dostępu</h1>
          <p className="text-base leading-6 text-text-2">{error}</p>
        </div>
        <BottomActions>
          <PrimaryButton onClick={signOut}>Zaloguj innym numerem</PrimaryButton>
        </BottomActions>
      </Screen>
    );
  }

  const open = tasks?.find((t) => t.id === openId) ?? null;
  if (open) {
    return (
      <TaskDetail
        task={open}
        onBack={() => setOpenId(null)}
        onClosed={() => {
          setOpenId(null);
          setTab("done");
          flash("Zadanie zamknięte. Mieszkaniec dostał informację.");
          void load();
        }}
      />
    );
  }

  const todo = (tasks ?? []).filter((t) => t.status !== "resolved");
  const done = (tasks ?? []).filter((t) => t.status === "resolved");
  const shown = tab === "todo" ? todo : done;

  return (
    <Screen>
      <div className="flex flex-1 flex-col gap-5 px-5 pt-6">
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em]">
              {worker ? `${greeting()}, ${worker.name.split(" ")[0]}` : "Zadania"}
            </h1>
            <span className="text-[15px] text-text-3">{worker?.unitName}</span>
          </div>
          <button
            onClick={signOut}
            className="h-11 flex-none rounded-xl px-3 text-[15px] font-semibold text-text-2 transition-transform active:scale-[0.97]"
          >
            Wyloguj
          </button>
        </div>

        {/* Segmented control */}
        <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-surface p-1">
          {(
            [
              ["todo", `Do zrobienia · ${todo.length}`],
              ["done", `Zrobione · ${done.length}`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="h-10 rounded-[10px] text-[15px] font-semibold transition-[background-color,box-shadow] duration-200"
              style={{
                background: tab === id ? "var(--bg)" : "transparent",
                boxShadow: tab === id ? "var(--shadow-float)" : undefined,
                color: tab === id ? "var(--text-1)" : "var(--text-2)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tasks === null ? (
          <div className="flex justify-center pt-10">
            <Spinner />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 pt-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
              <Icon name="check" size={28} stroke={2.25} />
            </span>
            <p className="text-base leading-6 text-text-2">
              {tab === "todo"
                ? "Nie masz otwartych zadań. Nowe pojawią się tu same, gdy urząd je przypisze."
                : "Brak zamkniętych zadań z ostatnich 7 dni."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5 pb-6">
            {shown.map((t, i) => (
              <li key={t.id} className="rise" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
                <button
                  onClick={() => setOpenId(t.id)}
                  className="flex w-full items-center gap-3.5 rounded-2xl border border-line p-3 text-left transition-[background-color,transform] duration-150 active:scale-[0.98] active:bg-surface"
                >
                  <div className="hatch flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[10px] text-text-3">
                    {(t.status === "resolved" ? t.resolutionPhotoUrl : t.photoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(t.status === "resolved" ? t.resolutionPhotoUrl : t.photoUrl)!}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon name={CATEGORIES[t.category].icon} size={24} />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="text-base font-semibold leading-[22px]">{CATEGORIES[t.category].label}</div>
                    <div className="truncate text-sm leading-5 text-text-3">{t.address}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {t.status === "resolved" ? (
                        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-success-bg px-2.5 text-[13px] font-semibold text-success">
                          <Icon name="check" size={14} stroke={2.5} />
                          {t.resolvedAt ? formatDayTime(t.resolvedAt) : "Zamknięte"}
                        </span>
                      ) : (
                        <UrgencyBadge priority={t.priority} />
                      )}
                      {t.reportersCount > 1 && (
                        <span className="tabular flex items-center gap-1 text-[13px] text-text-3">
                          <Icon name="users" size={14} />
                          {t.reportersCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-disabled">
                    <Icon name="chevR" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {toast && (
        <div className="fixed inset-x-5 bottom-8 z-30 mx-auto max-w-[440px]">
          <Toast>{toast}</Toast>
        </div>
      )}
    </Screen>
  );
}

// --- Task detail: navigate → photo after repair → close ------------------------

function TaskDetail({ task, onBack, onClosed }: { task: WorkerTask; onBack: () => void; onClosed: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = task.status === "resolved";

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPreparing(true);
    setError(null);
    try {
      // Same on-device pipeline as residents: downscale + pixelate faces.
      const prepared = await preparePhoto(file);
      setAfter(prepared.dataUrl);
    } catch {
      setError("Nie udało się wczytać zdjęcia. Spróbuj ponownie.");
    } finally {
      setPreparing(false);
    }
  }

  async function close() {
    if (!after) return;
    setSending(true);
    setError(null);
    const res = await closeWorkerTask(task.id, after, note);
    setSending(false);
    if (!res.ok) return setError(res.error ?? "Nie udało się zamknąć zadania.");
    onClosed();
  }

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lng}`;

  return (
    <Screen>
      <TopBar title={CATEGORIES[task.category].label} subtitle={task.publicNo} onBack={onBack} />
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-1 pb-4">
        {/* Before / after */}
        <div className={`grid gap-2 ${resolved ? "grid-cols-2" : "grid-cols-1"}`}>
          <figure className="flex flex-col gap-1.5">
            <div className={`hatch overflow-hidden rounded-2xl ${resolved ? "h-[140px]" : "h-[172px]"}`}>
              {task.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={task.photoUrl} alt="Zdjęcie od mieszkańca" className="h-full w-full object-cover" />
              )}
            </div>
            {resolved && <figcaption className="text-[13px] font-semibold text-text-3">Przed</figcaption>}
          </figure>
          {resolved && task.resolutionPhotoUrl && (
            <figure className="flex flex-col gap-1.5">
              <div className="h-[140px] overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={task.resolutionPhotoUrl} alt="Zdjęcie po naprawie" className="h-full w-full object-cover" />
              </div>
              <figcaption className="text-[13px] font-semibold text-success">Po naprawie</figcaption>
            </figure>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip category={task.category} />
          <UrgencyBadge priority={task.priority} />
        </div>

        {task.priorityReason && <p className="text-sm leading-5 text-text-2">{task.priorityReason}</p>}

        {/* Where */}
        <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface">
            <Icon name="pin" />
          </span>
          <span className="min-w-0 flex-1 text-base font-semibold leading-[22px]">{task.address}</span>
          <a
            href={navUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 flex-none items-center gap-1.5 rounded-xl bg-accent-bg px-3.5 text-[15px] font-semibold text-accent transition-transform active:scale-[0.97]"
          >
            <Icon name="navigation" size={18} />
            Nawiguj
          </a>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-text-3">Opis</span>
          <p className="text-pretty text-[15px] leading-[22px]">{task.summary}</p>
        </div>

        <div className="flex flex-col gap-2 text-sm leading-5 text-text-2">
          {task.reportersCount > 1 && (
            <div className="flex items-center gap-2.5">
              <Icon name="users" size={18} />
              Zgłosiło {task.reportersCount} {plural(task.reportersCount, "osoba", "osoby", "osób")}
            </div>
          )}
          {task.assignedAt && (
            <div className="flex items-center gap-2.5">
              <Icon name="clock" size={18} />
              Przypisano: {formatDayTime(task.assignedAt)}
            </div>
          )}
        </div>

        {resolved ? (
          task.resolutionNote && (
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-text-3">Twoja notatka</span>
              <p className="text-[15px] leading-[22px]">{task.resolutionNote}</p>
            </div>
          )
        ) : (
          <>
            <div className="h-px flex-none bg-line" />
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-3">Po naprawie</span>
              {after ? (
                <div className="relative h-[200px] overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={after} alt="Zdjęcie po naprawie" className="rise h-full w-full object-cover" />
                  <button
                    onClick={() => input.current?.click()}
                    className="absolute right-3 bottom-3 flex h-10 items-center gap-1.5 rounded-full bg-[rgba(15,17,21,.72)] px-3.5 text-sm font-semibold text-white backdrop-blur-md transition-transform active:scale-[0.97]"
                  >
                    <Icon name="camera" size={16} />
                    Zmień
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => input.current?.click()}
                  disabled={preparing}
                  className="flex h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-field text-text-2 transition-[background-color,transform] duration-150 active:scale-[0.98] active:bg-surface"
                >
                  {preparing ? (
                    <Spinner />
                  ) : (
                    <>
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-bg text-accent">
                        <Icon name="camera" size={24} />
                      </span>
                      <span className="text-[15px] font-semibold text-text-1">Zrób zdjęcie po naprawie</span>
                      <span className="text-[13px]">Wymagane, żeby zamknąć zadanie</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={input}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  void onPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-text-3">Notatka (opcjonalnie)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="np. Ubytek wypełniony masą na zimno."
                className="w-full resize-none rounded-xl border border-field bg-bg px-4 py-3 leading-6 outline-none placeholder:text-text-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)]"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
          </>
        )}
      </div>

      {!resolved && (
        <div className="sticky bottom-0 bg-bg">
          <BottomActions>
            <PrimaryButton icon={sending ? undefined : "check"} disabled={!after || sending} onClick={close}>
              {sending ? "Zamykam…" : "Oznacz jako załatwione"}
            </PrimaryButton>
          </BottomActions>
        </div>
      )}
    </Screen>
  );
}
