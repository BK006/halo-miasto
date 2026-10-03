"use client";

import { Icon } from "@/components/icons";
import { BottomActions, Screen, Spinner, TextButton } from "@/components/ui";

type StepState = "done" | "active" | "todo";

function Step({ state, children }: { state: StepState; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2.5 ${state === "done" ? "" : state === "active" ? "text-text-2" : "text-text-3"}`}>
      <span className="flex w-[18px] justify-center">
        {state === "done" ? (
          <span className="text-success">
            <Icon name="check" size={18} stroke={2.25} />
          </span>
        ) : state === "active" ? (
          <span className="block h-2 w-2 rounded-full bg-accent" style={{ animation: "zt-pulse 1.2s ease-in-out infinite" }} />
        ) : (
          <span className="block h-2 w-2 rounded-full border-[1.5px] border-field" />
        )}
      </span>
      {children}
    </div>
  );
}

// Screen 3: automatic analysis, no tap needed.
export function Analyzing({
  photo,
  phase,
  facesLabel,
  onCancel,
}: {
  photo: string | null;
  phase: "preparing" | "analyzing";
  facesLabel: string;
  onCancel: () => void;
}) {
  return (
    <Screen>
      <div className="mx-4 mt-2 h-[52dvh] max-h-[440px] flex-none overflow-hidden rounded-3xl">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Zrobione zdjęcie" className="h-full w-full object-cover" />
        ) : (
          <div className="hatch h-full w-full" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3.5 px-6 pt-8">
        <div className="flex items-center gap-3">
          <Spinner />
          <span className="text-[22px] font-semibold leading-7">Analizuję zdjęcie…</span>
        </div>
        <p className="text-[15px] leading-[22px] text-text-2">
          Rozpoznaję problem i przygotowuję zgłoszenie. Zwykle trwa to kilka sekund.
        </p>
        <div className="mt-2 flex flex-col gap-2.5 text-[15px] leading-[22px]">
          <Step state={phase === "preparing" ? "active" : "done"}>{facesLabel}</Step>
          <Step state={phase === "analyzing" ? "active" : "todo"}>Rozpoznaję problem</Step>
          <Step state="todo">Dobieram właściwy urząd</Step>
        </div>
      </div>
      <BottomActions>
        <TextButton onClick={onCancel}>Anuluj</TextButton>
      </BottomActions>
    </Screen>
  );
}
