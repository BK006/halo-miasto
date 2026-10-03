"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Screen, Spinner, StatusBadge, TopBar, UrgencyBadge } from "@/components/ui";
import { CATEGORIES } from "@/config/categories";
import { unitById } from "@/config/units";
import type { ReportDTO } from "@/lib/api-types";
import { supabaseBrowser } from "@/lib/supabase";

// Screen 8: report status. Updates live when the city panel changes the status.
export default function ReportStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/reports/${id}`, { cache: "no-store" });
    const data = (await res.json()) as { report?: ReportDTO; error?: string };
    if (data.report) setReport(data.report);
    else setError(data.error ?? "Nie znaleziono zgłoszenia.");
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the fetch resolves
    void load();
    const channel = supabaseBrowser()
      .channel(`report-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "reports", filter: `id=eq.${id}` }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabaseBrowser().removeChannel(channel);
    };
  }, [id, load]);

  const back = () => (window.history.length > 1 ? router.back() : router.push("/moje"));

  if (!report) {
    return (
      <Screen>
        <TopBar title="Zgłoszenie" onBack={back} />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-text-2">
          {error ?? <Spinner />}
        </div>
      </Screen>
    );
  }

  const unit = unitById(report.unitId);

  return (
    <Screen>
      <TopBar title={CATEGORIES[report.category].label} subtitle={report.publicNo} onBack={back} />
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-1 pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="h-[172px] flex-none overflow-hidden rounded-2xl">
          {report.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.photoUrl} alt="Zdjęcie zgłoszenia" className="h-full w-full object-cover" />
          ) : (
            <div className="hatch h-full w-full" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={report.status} />
          <UrgencyBadge priority={report.priority} />
          {report.reportersCount > 1 && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-2.5 text-[13px] font-semibold text-text-2">
              <Icon name="users" size={14} stroke={2} />
              {report.reportersCount} zgłaszających
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 text-[15px] leading-[22px]">
          <div className="flex items-center gap-2.5">
            <span className="text-text-3">
              <Icon name="pin" size={18} />
            </span>
            {report.address}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-text-3">
              <Icon name="building" size={18} />
            </span>
            {report.unitName}
          </div>
        </div>
        <div className="h-px flex-none bg-line" />
        <StatusTimeline status={report.status} history={report.history} unitShort={unit?.short ?? report.unitName} />
      </div>
    </Screen>
  );
}
