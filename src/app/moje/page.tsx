"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { BottomActions, Screen, Spinner, StatusBadge } from "@/components/ui";
import { CATEGORIES } from "@/config/categories";
import type { ReportDTO } from "@/lib/api-types";
import { clearSession, getMyReportIds, getSession } from "@/lib/client/device";
import { fetchMyReports, fetchReports } from "@/lib/client/functions";
import { RESIDENT_STATUS_LABELS } from "@/lib/domain";
import { formatShortDate, plural } from "@/lib/format";

// Screen 9: reports sent from this device.
export default function MyReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportDTO[] | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage read
      setPhone(session.phone);
      fetchMyReports()
        .then(setReports)
        .catch(() => setReports([]));
      return;
    }
    // Not signed in: fall back to reports sent from this device.
    const ids = getMyReportIds();
    if (ids.length === 0) {
      setReports([]);
      return;
    }
    fetchReports(ids)
      .then(setReports)
      .catch(() => setReports([]));
  }, []);

  return (
    <Screen>
      <div className="flex flex-1 flex-col gap-5 px-5 pt-6">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.01em]">Moje zgłoszenia</h1>
          {reports && (
            <span className="text-[15px] text-text-3">
              {reports.length} {plural(reports.length, "zgłoszenie", "zgłoszenia", "zgłoszeń")}
              {phone && <span className="tabular"> · {phone.replace(/^\+48(\d{3})(\d{3})(\d{3})$/, "+48 $1 $2 $3")}</span>}
            </span>
          )}
        </div>

        {!reports ? (
          <div className="flex justify-center pt-10">
            <Spinner />
          </div>
        ) : reports.length === 0 ? (
          <p className="px-1 text-base leading-6 text-text-2">
            Nie masz jeszcze zgłoszeń. Zrób zdjęcie problemu w mieście, a my przygotujemy zgłoszenie do urzędu.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/r/${r.id}`}
                  className="flex items-center gap-3.5 rounded-2xl border border-line p-3 transition-colors hover:bg-surface"
                >
                  <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[10px] text-text-3">
                    {r.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.photoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="hatch flex h-full w-full items-center justify-center">
                        <Icon name={CATEGORIES[r.category].icon} size={24} />
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="text-base font-semibold leading-[22px]">{CATEGORIES[r.category].label}</div>
                    <div className="truncate text-sm leading-5 text-text-3">
                      {r.address} · {formatShortDate(r.createdAt)}
                    </div>
                    <div className="mt-1 flex gap-1.5">
                      <StatusBadge status={r.status} label={RESIDENT_STATUS_LABELS[r.status]} />
                    </div>
                  </div>
                  <span className="text-disabled">
                    <Icon name="chevR" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomActions>
        {phone && (
          <button
            onClick={() => {
              clearSession();
              router.push("/");
            }}
            className="h-11 text-[15px] font-semibold text-text-2"
          >
            Wyloguj
          </button>
        )}
        <Link
          href="/"
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-accent text-[17px] font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Icon name="camera" />
          Zgłoś nowy problem
        </Link>
      </BottomActions>
    </Screen>
  );
}
