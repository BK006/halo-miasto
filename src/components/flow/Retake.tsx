"use client";

import { Icon } from "@/components/icons";
import { BottomActions, PrimaryButton, Screen, TextButton } from "@/components/ui";

// Screen 4: low confidence or not a city issue → ask for another photo instead of filing a bad report.
export function Retake({
  photo,
  hint,
  onRetake,
  onPickCategory,
}: {
  photo: string | null;
  hint: string;
  onRetake: () => void;
  onPickCategory: () => void;
}) {
  return (
    <Screen>
      <div className="mx-4 mt-2 h-[260px] flex-none overflow-hidden rounded-3xl">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Zrobione zdjęcie" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="hatch h-full w-full" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-5 px-6 pt-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-warning-bg text-warning">
          <Icon name="alert" size={24} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em]">Nie jestem pewien, co tu widać</h1>
          <p className="text-pretty text-base leading-6 text-text-2">{hint}</p>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 text-[15px] leading-[22px]">
          <div className="flex items-center gap-3">
            <Icon name="focus" />
            Podejdź bliżej, niech problem wypełni kadr
          </div>
          <div className="flex items-center gap-3">
            <Icon name="sun" />
            Szukaj światła, unikaj pod światło
          </div>
        </div>
      </div>
      <BottomActions>
        <PrimaryButton icon="camera" onClick={onRetake}>
          Zrób drugie zdjęcie
        </PrimaryButton>
        <TextButton onClick={onPickCategory}>Wybierz kategorię ręcznie</TextButton>
      </BottomActions>
    </Screen>
  );
}
