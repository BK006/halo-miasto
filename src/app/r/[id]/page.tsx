"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Screen, Spinner, StatusBadge, TopBar } from "@/components/ui";
import { CATEGORIES } from "@/config/categories";
import { unitById } from "@/config/units";
import type { ReportDTO } from "@/lib/api-types";
import { fetchReports } from "@/lib/client/functions";
import { residentStatus } from "@/lib/domain";
import { supabaseBrowser } from "@/lib/supabase";

// Screen 8: report status. Updates live when the city panel changes the status.
export default function ReportStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [found] = await fetchReports([id]).catch(() => []);
    if (found) setReport(found);
    else setError("Nie znaleziono zgłoszenia.");
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
        {report.resolutionPhotoUrl ? (
          // Closed by a field worker: show the fix next to the original photo.
          <div className="grid flex-none grid-cols-2 gap-2">
            {[
              ["Twoje zdjęcie", report.photoUrl, "text-text-3"],
              ["Po naprawie", report.resolutionPhotoUrl, "text-success"],
            ].map(([label, url, tone]) => (
              <figure key={label} className="flex flex-col gap-1.5">
                <div className="hatch h-[150px] overflow-hidden rounded-2xl">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={label!} className="h-full w-full object-cover" />
                  )}
                </div>
                <figcaption className={`text-[13px] font-semibold ${tone}`}>{label}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="h-[172px] flex-none overflow-hidden rounded-2xl">
            {report.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={report.photoUrl} alt="Zdjęcie zgłoszenia" className="h-full w-full object-cover" />
            ) : (
              <div className="hatch h-full w-full" />
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={residentStatus(report.status)} />
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
