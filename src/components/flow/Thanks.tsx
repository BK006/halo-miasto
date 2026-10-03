"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { BottomActions, Screen, TextButton, Toast } from "@/components/ui";
import { formatShortDate, plural } from "@/lib/format";

// Screen 7 / 7b: confirmation with a copyable number, or the merged-duplicate variant.
export function Thanks({
  id,
  publicNo,
  duplicate,
  reportersCount,
  firstAt,
  unitNameGen,
  onAnother,
}: {
  id: string;
  publicNo: string;
  duplicate: boolean;
  reportersCount: number;
  firstAt: string;
  unitNameGen: string;
  onAnother: () => void;
}) {
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicNo);
    } catch {
      // Clipboard can be blocked; the number is also selectable.
    }
    setToast(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), 2200);
  }

  const others = reportersCount - 1;

  return (
    <Screen>
      <div className="rise flex flex-1 flex-col gap-6 px-6 pt-16">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full ${duplicate ? "bg-accent-bg text-accent" : "bg-success-bg text-success"}`}
        >
          <Icon name={duplicate ? "users" : "check"} size={32} stroke={2.25} />
        </div>
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[32px] font-bold leading-[38px] tracking-[-0.01em]">
            Dziękujemy!
            <br />
            Zgłoszenie wysłane
          </h1>
          {duplicate ? (
            <>
              <p className="text-pretty text-[17px] font-semibold leading-[26px]">
                To miejsce {plural(others, "zgłosiła już 1 osoba", `zgłosiły już ${others} osoby`, `zgłosiło już ${others} osób`)}, dopisaliśmy Twój głos.
              </p>
              <p className="text-pretty text-base leading-6 text-text-2">
                Zgłoszenia tego samego problemu łączymy w jedno. Urząd widzi, ile osób go zgłosiło.
              </p>
            </>
          ) : (
            <p className="text-pretty text-base leading-6 text-text-2">
              Trafiło do {unitNameGen}. Damy znać, gdy urząd je przyjmie.
            </p>
          )}
        </div>

        {duplicate ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-text-3">Wspólne zgłoszenie</span>
              <span className="tabular text-[28px] font-bold leading-[34px] tracking-[.01em]">{publicNo}</span>
            </div>
            <div className="flex items-center gap-2 text-[15px] text-text-2">
              <Icon name="users" size={18} />
              {reportersCount} {plural(reportersCount, "zgłaszający", "zgłaszających", "zgłaszających")} · pierwsze{" "}
              {formatShortDate(firstAt)}
            </div>
          </div>
        ) : (
          <button
            onClick={copy}
            className="flex items-center gap-3 rounded-2xl border border-line py-4 pr-4 pl-5 text-left transition-colors hover:bg-surface"
          >
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-text-3">Numer zgłoszenia</span>
              <span className="tabular select-all text-[28px] font-bold leading-[34px] tracking-[.01em]">{publicNo}</span>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface">
              <Icon name="copy" />
            </span>
          </button>
        )}
      </div>

      {toast && (
        <div className="fixed inset-x-5 bottom-44 mx-auto max-w-[440px]">
          <Toast>Skopiowano numer zgłoszenia</Toast>
        </div>
      )}

      <BottomActions>
        <Link
          href={`/r/${id}`}
          className="flex h-14 w-full items-center justify-center rounded-[14px] bg-accent text-[17px] font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-active"
        >
          Śledź status
        </Link>
        <TextButton onClick={onAnother}>Zgłoś kolejny problem</TextButton>
      </BottomActions>
    </Screen>
  );
}
