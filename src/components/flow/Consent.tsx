"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { BottomActions, PrimaryButton, Screen } from "@/components/ui";

const ITEMS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "camera",
    title: "Zdjęcie problemu",
    body: "Twarze rozmywamy na Twoim telefonie, zanim zdjęcie zostanie wysłane.",
  },
  {
    icon: "pin",
    title: "Lokalizację",
    body: "Tylko w chwili zrobienia zdjęcia, żeby wskazać urzędowi miejsce.",
  },
  {
    icon: "bell",
    title: "Numer telefonu",
    body: "Zamiast konta i hasła. Służy do logowania i powiadomień o statusie zgłoszeń.",
  },
  {
    icon: "building",
    title: "Treść zgłoszenia",
    body: "Trafia wyłącznie do właściwego urzędu. Nie udostępniamy jej nikomu innemu.",
  },
];

// Screen 1: GDPR consent on first launch.
export function Consent({ onAccept }: { onAccept: () => void }) {
  const [agree, setAgree] = useState(false);
  const [details, setDetails] = useState(false);

  return (
    <Screen>
      <div className="flex flex-1 flex-col gap-7 px-6 pt-7">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-accent-bg text-accent">
          <Icon name="shield" size={28} />
        </div>
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em]">Zanim zrobisz pierwsze zdjęcie</h1>
          <p className="text-pretty text-base leading-6 text-text-2">
            Twoje zgłoszenia trafiają do urzędu miasta. Żeby to zadziałało, przetwarzamy cztery rzeczy.
          </p>
        </div>
        <div className="flex flex-col gap-5">
          {ITEMS.map((it) => (
            <div key={it.title} className="flex gap-3.5">
              <span className="pt-0.5">
                <Icon name={it.icon} size={24} />
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="text-base font-semibold leading-6">{it.title}</div>
                <div className="text-pretty text-sm leading-5 text-text-2">{it.body}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setDetails((d) => !d)} className="self-start text-[15px] font-semibold text-accent">
          Pełna informacja o danych osobowych
        </button>
        {details && (
          <div className="rise flex flex-col gap-2 rounded-2xl bg-surface p-4 text-sm leading-5 text-text-2">
            <p>
              Administrator (w prototypie): zespół projektu Zgłoś to. Cel: przekazanie zgłoszenia do właściwej
              jednostki miasta (art. 6 ust. 1 lit. a RODO – zgoda).
            </p>
            <p>
              Zdjęcie analizuje model AI (OpenAI) wyłącznie w celu rozpoznania problemu. Twarze są rozmywane na
              urządzeniu przed wysłaniem. Tablice rejestracyjne zostawiamy tylko w zgłoszeniach dotyczących
              parkowania.
            </p>
            <p>Nie zakładamy konta z hasłem – logujesz się numerem telefonu. Zgodę możesz wycofać, wylogowując się i czyszcząc dane strony w przeglądarce.</p>
          </div>
        )}
      </div>
      <BottomActions>
        <button onClick={() => setAgree((a) => !a)} className="flex items-start gap-3 py-2.5 text-left" role="checkbox" aria-checked={agree}>
          <span
            className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-white transition-colors"
            style={{
              border: `1.5px solid ${agree ? "var(--accent)" : "var(--field)"}`,
              background: agree ? "var(--accent)" : "transparent",
              color: "var(--on-accent)",
            }}
          >
            {agree && <Icon name="check" size={16} stroke={2.5} />}
          </span>
          <span className="text-[15px] leading-[22px]">
            Rozumiem i zgadzam się na przetwarzanie danych w celu wysłania zgłoszenia.
          </span>
        </button>
        <PrimaryButton disabled={!agree} onClick={onAccept}>
          Zaczynam
        </PrimaryButton>
      </BottomActions>
    </Screen>
  );
}
