"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CATEGORIES, type CategoryId } from "@/config/categories";
import { STATUS_LABELS, URGENCY_LABELS, urgencyOf, type ReportStatus } from "@/lib/domain";
import { Icon, type IconName } from "./icons";

// --- Buttons ---------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName };

export function PrimaryButton({ icon, children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-accent text-[17px] font-semibold leading-6 text-on-accent transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.98] active:bg-accent-active disabled:bg-surface-2 disabled:text-disabled disabled:active:scale-100 ${className}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function SecondaryButton({ icon, children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] border border-field bg-bg text-[17px] font-semibold leading-6 text-text-1 transition-[background-color,transform] duration-150 hover:bg-surface active:scale-[0.98] active:bg-surface-2 ${className}`}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function TextButton({ icon, children, className = "", ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[17px] font-semibold leading-6 text-accent transition-colors hover:bg-accent-bg ${className}`}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, className = "", ...rest }: ButtonProps & { icon: IconName; label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-xl text-text-1 transition-colors hover:bg-surface ${className}`}
    >
      <Icon name={icon} size={24} />
    </button>
  );
}

// --- Badges ----------------------------------------------------------------

const URGENCY_STYLE = {
  low: { fg: "var(--success)", bg: "var(--success-bg)", bars: 1 },
  medium: { fg: "var(--warning)", bg: "var(--warning-bg)", bars: 2 },
  high: { fg: "var(--danger)", bg: "var(--danger-bg)", bars: 3 },
} as const;

// Colour + number + label + bars, so urgency reads without colour vision.
export function UrgencyBadge({ priority }: { priority: number }) {
  const level = urgencyOf(priority);
  const s = URGENCY_STYLE[level];
  return (
    <span
      className="tabular inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold"
      style={{ color: s.fg, background: s.bg }}
    >
      <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
        {[6, 9, 12].map((h, i) => (
          <span
            key={h}
            className="w-[3px] rounded-[1px] bg-current"
            style={{ height: h, opacity: i < s.bars ? 1 : 0.25 }}
          />
        ))}
      </span>
      {priority}/10 · {URGENCY_LABELS[level]}
    </span>
  );
}

export const STATUS_STYLE: Record<ReportStatus, { fg: string; bg: string; dot: string }> = {
  new: { fg: "var(--st-new)", bg: "var(--st-new-bg)", dot: "var(--st-new-dot)" },
  sent: { fg: "var(--st-sent)", bg: "var(--st-sent-bg)", dot: "var(--st-sent-dot)" },
  accepted: { fg: "var(--st-accepted)", bg: "var(--st-accepted-bg)", dot: "var(--st-accepted-dot)" },
  resolved: { fg: "var(--st-resolved)", bg: "var(--st-resolved-bg)", dot: "var(--st-resolved-dot)" },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold"
      style={{ color: s.fg, background: s.bg }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function CategoryChip({ category }: { category: CategoryId }) {
  const c = CATEGORIES[category];
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface pl-2.5 pr-3 text-sm font-semibold">
      <Icon name={c.icon} size={16} stroke={2} />
      {c.label}
    </span>
  );
}

// --- Feedback --------------------------------------------------------------

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      className="block flex-none rounded-full border-[2.5px] border-line"
      style={{ width: size, height: size, borderTopColor: "var(--accent)", animation: "zt-spin .9s linear infinite" }}
      role="status"
      aria-label="Ładowanie"
    />
  );
}

export function Toast({ tone = "success", children }: { tone?: "success" | "error"; children: ReactNode }) {
  return (
    <div
      role="status"
      className="rise flex items-center gap-3 rounded-[14px] px-4 py-3.5 text-[15px] leading-[22px] text-white shadow-[0_8px_24px_rgba(20,23,28,.18)]"
      style={{ background: "var(--toast)" }}
    >
      <span style={{ color: tone === "success" ? "#6CCB98" : "#FF8A7E" }}>
        <Icon name={tone === "success" ? "check" : "alert"} />
      </span>
      <span className="flex-1">{children}</span>
    </div>
  );
}

// Fixed bottom action area in the thumb zone, respecting the home indicator.
export function BottomActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-none flex-col gap-2 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),20px)]">{children}</div>
  );
}

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pt-[env(safe-area-inset-top)] ${className}`}
    >
      {children}
    </div>
  );
}

export function TopBar({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <div className="flex h-14 flex-none items-center gap-0.5 px-2">
      {onBack && <IconButton icon="chevL" label="Wstecz" onClick={onBack} />}
      <div className="flex flex-col">
        <span className="text-[17px] font-semibold leading-[22px]">{title}</span>
        {subtitle && <span className="tabular text-[13px] leading-[18px] text-text-3">{subtitle}</span>}
      </div>
    </div>
  );
}
