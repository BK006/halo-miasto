"use client";

import { Icon } from "@/components/icons";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/config/categories";

// Bottom sheet listing the closed category list (manual fallback after a weak photo).
export function CategoryPicker({ onPick, onClose }: { onPick: (c: CategoryId) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[80dvh] w-full max-w-[480px] flex-col rounded-t-3xl bg-bg pt-2 pb-[max(env(safe-area-inset-bottom),16px)]"
        style={{ boxShadow: "var(--shadow-sheet)" }}
      >
        <span className="h-1 w-9 self-center rounded-full bg-field" />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <span className="text-[22px] font-semibold leading-7">Co widać na zdjęciu?</span>
          <button onClick={onClose} aria-label="Zamknij" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-surface">
            <Icon name="x" size={22} />
          </button>
        </div>
        <ul className="overflow-y-auto px-3">
          {CATEGORY_IDS.map((id) => (
            <li key={id}>
              <button
                onClick={() => onPick(id)}
                className="flex h-14 w-full items-center gap-3.5 rounded-[14px] px-3 text-left text-base font-medium hover:bg-surface active:bg-surface-2"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface">
                  <Icon name={CATEGORIES[id].icon} />
                </span>
                {CATEGORIES[id].label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
