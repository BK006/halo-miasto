"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { BottomActions, CategoryChip, PrimaryButton, Screen, TopBar, UrgencyBadge } from "@/components/ui";
import { PLATES_ALLOWED } from "@/config/categories";
import type { Unit } from "@/config/units";
import type { Place } from "@/lib/client/location";
import type { Analysis } from "@/lib/domain";
import { plural } from "@/lib/format";

const MiniMap = dynamic(() => import("@/components/map/MiniMap"), { ssr: false });

type Privacy = { tone: "ok" | "warn"; title: string; body: string };

// What we tell the user about personal data on the photo (GDPR is part of the pitch).
function privacyNotice(analysis: Analysis, facesBlurred: number, faceCheckDone: boolean): Privacy {
  const pd = analysis.personal_data;
  const facesLine =
    facesBlurred > 0
      ? `Na zdjęciu ${facesBlurred === 1 ? "była" : "były"} ${facesBlurred} ${plural(facesBlurred, "osoba", "osoby", "osób")}. Rozmyliśmy ${facesBlurred === 1 ? "ją" : "je"} na Twoim telefonie.`
      : null;

  if (pd.license_plates && pd.plates_needed && PLATES_ALLOWED.has(analysis.category)) {
    return {
      tone: "ok",
      title: "Widoczna tablica rejestracyjna: zostawiamy, bo dotyczy parkowania",
      body: facesBlurred > 0 ? "Twarze przechodniów zostały rozmyte." : "Na zdjęciu nie wykryliśmy twarzy.",
    };
  }
  if (pd.license_plates) {
    return {
      tone: "warn",
      title: "Widoczna tablica rejestracyjna",
      body: "Nie jest potrzebna w tym zgłoszeniu. Jeśli możesz, zrób zdjęcie bez niej.",
    };
  }
  if (facesBlurred > 0) return { tone: "ok", title: "Twarze zostały rozmyte", body: facesLine! };
  if (pd.faces) {
    return {
      tone: "warn",
      title: "Na zdjęciu może być widoczna osoba",
      body: "Nie rozpoznaliśmy twarzy automatycznie. Jeśli ktoś jest rozpoznawalny, zrób zdjęcie bez osób.",
    };
  }
  if (!faceCheckDone) {
    return {
      tone: "warn",
      title: "Nie sprawdziliśmy twarzy",
      body: "Wykrywanie twarzy nie uruchomiło się. Upewnij się, że nikt nie jest rozpoznawalny.",
    };
  }
  return { tone: "ok", title: "Brak danych osobowych", body: "Nie wykryliśmy twarzy ani tablic rejestracyjnych." };
}

// Screen 5: review the AI draft, edit if needed, send (second and last tap).
export function Review({
  photo,
  analysis,
  unit,
  place,
  facesBlurred,
  faceCheckDone,
  text,
  onTextChange,
  onChangePlace,
  onBack,
  onSend,
  sending,
}: {
  photo: string;
  analysis: Analysis;
  unit: Unit;
  place: Place;
  facesBlurred: number;
  faceCheckDone: boolean;
  text: string;
  onTextChange: (t: string) => void;
  onChangePlace: () => void;
  onBack: () => void;
  onSend: () => void;
  sending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const privacy = privacyNotice(analysis, facesBlurred, faceCheckDone);
  const [street] = place.address.split(", ");

  return (
    <Screen>
      <TopBar title="Sprawdź zgłoszenie" onBack={onBack} />
      <div className="flex flex-1 flex-col gap-3.5 px-5 pt-2 pb-2">
        <div className="flex gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Zdjęcie zgłoszenia" className="h-24 w-24 flex-none rounded-[14px] object-cover" />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <CategoryChip category={analysis.category} />
            <UrgencyBadge priority={analysis.priority} />
            <span className="text-sm leading-5 text-text-2">{analysis.priority_reason_pl}</span>
          </div>
        </div>

        <div className="h-px flex-none bg-line" />

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-text-3">Miejsce</span>
          <div className="relative h-24 overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_var(--line)]">
            <MiniMap lat={place.lat} lng={place.lng} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-base font-semibold leading-[22px]">{street}</span>
            <button onClick={onChangePlace} className="h-11 flex-none px-1 text-[15px] font-semibold text-accent">
              Zmień
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface">
            <Icon name="building" />
          </span>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold leading-[18px] text-text-3">Adresat</span>
            <span className="text-base font-semibold leading-[22px]">{unit.name}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text-3">Treść zgłoszenia · przygotowana przez AI</span>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex h-8 items-center gap-1.5 text-[15px] font-semibold text-accent"
              >
                <Icon name="pencil" size={16} stroke={2} />
                Edytuj
              </button>
            )}
          </div>
          {editing ? (
            <>
              <textarea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                rows={8}
                autoFocus
                className="w-full resize-none rounded-xl border border-field bg-bg px-4 py-3.5 leading-6 text-text-1 outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)]"
              />
              <span className="text-[13px] leading-[18px] text-text-3">
                Tekst przygotowało AI. Możesz go poprawić przed wysłaniem.
              </span>
            </>
          ) : (
            <>
              <div
                className="whitespace-pre-line text-[15px] leading-[22px]"
                style={open ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}
              >
                {text}
              </div>
              <button onClick={() => setOpen((o) => !o)} className="h-8 self-start text-[15px] font-semibold text-accent">
                {open ? "Zwiń" : "Rozwiń"}
              </button>
            </>
          )}
        </div>

        <div className="flex gap-3 rounded-[14px] bg-surface px-3.5 py-3">
          <span className={`pt-px ${privacy.tone === "ok" ? "text-success" : "text-warning"}`}>
            <Icon name={privacy.tone === "ok" ? "shield" : "alert"} />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold leading-5">{privacy.title}</span>
            <span className="text-[13px] leading-[18px] text-text-2">{privacy.body}</span>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 bg-bg">
        <BottomActions>
          <PrimaryButton icon={sending ? undefined : "send"} disabled={sending || text.trim().length === 0} onClick={onSend}>
            {sending ? "Wysyłam…" : "Wyślij zgłoszenie"}
          </PrimaryButton>
        </BottomActions>
      </div>
    </Screen>
  );
}
