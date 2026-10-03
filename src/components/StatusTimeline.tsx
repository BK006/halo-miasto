import { Icon } from "@/components/icons";
import { RESIDENT_STATUS_LABELS, residentSteps, type ReportStatus } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";

const PENDING_TEXT: Record<ReportStatus, string> = {
  new: "Oczekuje",
  sent: "Oczekuje na wysłanie",
  accepted: "Oczekuje na przyjęcie",
  resolved: "Oczekuje na naprawę",
};

// Resident timeline: Nowe → Wysłane → Przyjęte, plus "Rozwiązane" once closed.
export function StatusTimeline({
  status,
  history,
  unitShort,
}: {
  status: ReportStatus;
  history: { status: ReportStatus; changedAt: string }[];
  unitShort: string;
}) {
  const steps = residentSteps(status);
  const current = steps.indexOf(status);
  const when = new Map(history.map((h) => [h.status, h.changedAt]));

  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const done = i < current || (i === current && s === "resolved");
        const isCurrent = i === current && !done;
        const last = i === steps.length - 1;
        const at = when.get(s);
        return (
          <li key={s} className="flex gap-3.5">
            <div className="flex w-6 flex-col items-center">
              {done ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Icon name="check" size={14} stroke={2.5} />
                </span>
              ) : isCurrent ? (
                <span className="h-6 w-6 rounded-full border-[6px] border-accent bg-bg" />
              ) : (
                <span className="h-6 w-6 rounded-full border-2 border-field bg-bg" />
              )}
              {!last &&
                (done ? (
                  <span className="w-0.5 flex-1 bg-accent" />
                ) : (
                  <span className="w-0 flex-1 border-l-2 border-dashed border-field" />
                ))}
            </div>
            <div className={last ? "pt-px" : "pt-px pb-4"}>
              <div className={`text-base font-semibold leading-[22px] ${done || isCurrent ? "" : "text-text-3"}`}>
                {RESIDENT_STATUS_LABELS[s]}
                {isCurrent && <span className="ml-2 text-[13px] font-semibold text-accent">obecny etap</span>}
              </div>
              <div className="text-sm leading-5 text-text-3">
                {at ? `${formatDateTime(at)}${s === "sent" ? ` · do ${unitShort}` : ""}` : PENDING_TEXT[s]}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
