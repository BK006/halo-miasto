"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Analyzing } from "@/components/flow/Analyzing";
import { Camera, type CapturedPhoto } from "@/components/flow/Camera";
import { CategoryPicker } from "@/components/flow/CategoryPicker";
import { Consent } from "@/components/flow/Consent";
import { Retake } from "@/components/flow/Retake";
import { Review } from "@/components/flow/Review";
import { Thanks } from "@/components/flow/Thanks";
import { Toast } from "@/components/ui";
import type { CategoryId } from "@/config/categories";
import { unitFor, type Unit } from "@/config/units";
import type { AnalyzeResponse, CreateReportRequest, CreateReportResponse } from "@/lib/api-types";
import { addMyReport, getConsent, getDeviceId, setConsent } from "@/lib/client/device";
import { preloadFaceDetector, preparePhoto, type PreparedPhoto } from "@/lib/client/image";
import {
  DEFAULT_CENTER,
  getCurrentPosition,
  getExifPosition,
  reverseGeocode,
  type Place,
} from "@/lib/client/location";
import { CONSENT_VERSION, type Analysis } from "@/lib/domain";
import { plural } from "@/lib/format";

const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), { ssr: false });

type Step =
  | { name: "loading" }
  | { name: "consent" }
  | { name: "camera" }
  | { name: "analyzing"; phase: "preparing" | "analyzing" }
  | { name: "retake"; hint: string }
  | { name: "review"; analysis: Analysis; unit: Unit }
  | { name: "done"; result: Extract<CreateReportResponse, { id: string }>; unit: Unit };

// After the location picker closes, go back to where the user came from
// (or run the analysis that was waiting for a location).
type PickerReturn = "camera" | "review" | "analyze";

export default function ReportFlow() {
  const [step, setStep] = useState<Step>({ name: "loading" });
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [picker, setPicker] = useState<PickerReturn | null>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [takenAt, setTakenAt] = useState<Date>(new Date());
  const [text, setText] = useState("");
  const [categoryPicker, setCategoryPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const flashError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 3500);
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    const pos = await getCurrentPosition();
    if (pos) setPlace({ ...pos, address: await reverseGeocode(pos.lat, pos.lng) });
    setLocating(false);
  }, []);

  // Initial step depends on localStorage, which only exists on the client.
  useEffect(() => {
    const consented = getConsent() === CONSENT_VERSION;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only bootstrap
    setStep(consented ? { name: "camera" } : { name: "consent" });
    if (consented) {
      preloadFaceDetector();
      void locate();
    }
  }, [locate]);

  function acceptConsent() {
    setConsent(CONSENT_VERSION);
    preloadFaceDetector();
    void locate();
    setStep({ name: "camera" });
  }

  async function analyze(prepared: PreparedPhoto, at: Place, category?: CategoryId) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setStep({ name: "analyzing", phase: "analyzing" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          image: prepared.dataUrl,
          lat: at.lat,
          lng: at.lng,
          address: at.address,
          takenAt: takenAt.toISOString(),
          category,
        }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if ("error" in data) throw new Error(data.error);
      if (data.status === "retake") return setStep({ name: "retake", hint: data.hint });
      setText(data.analysis.report_text_pl);
      setStep({ name: "review", analysis: data.analysis, unit: data.unit });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      flashError(err instanceof Error ? err.message : "Nie udało się przeanalizować zdjęcia.");
      setStep({ name: "camera" });
    }
  }

  async function onCapture(captured: CapturedPhoto) {
    setTakenAt(captured.takenAt);
    setStep({ name: "analyzing", phase: "preparing" });

    // A gallery photo carries its own location – prefer it over where the user is now.
    let at = place;
    if (captured.file) {
      const exif = await getExifPosition(captured.file);
      if (exif) {
        at = { ...exif, address: await reverseGeocode(exif.lat, exif.lng) };
        setPlace(at);
      }
    }

    const prepared = await preparePhoto(captured.source);
    setPhoto(prepared);

    if (!at) {
      // No GPS and no EXIF: ask for the place first, then analyse.
      setPicker("analyze");
      return;
    }
    await analyze(prepared, at);
  }

  function cancelAnalysis() {
    abort.current?.abort();
    setStep({ name: "camera" });
  }

  function confirmPlace(p: Place) {
    setPlace(p);
    const ret = picker;
    setPicker(null);
    if (ret === "analyze" && photo) void analyze(photo, p);
  }

  async function send() {
    if (step.name !== "review" || !photo || !place) return;
    setSending(true);
    const a = step.analysis;
    const body: CreateReportRequest = {
      deviceId: getDeviceId(),
      consentVersion: CONSENT_VERSION,
      image: photo.dataUrl,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      category: a.category,
      summary: a.summary_pl,
      priority: a.priority,
      priorityReason: a.priority_reason_pl,
      confidence: a.confidence,
      personalData: a.personal_data,
      reportText: text.trim(),
    };
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as CreateReportResponse;
      if ("error" in data) throw new Error(data.error);
      addMyReport(data.id);
      setStep({ name: "done", result: data, unit: unitFor(a.category) });
    } catch (err) {
      flashError(err instanceof Error ? err.message : "Nie udało się wysłać zgłoszenia.");
    } finally {
      setSending(false);
    }
  }

  function restart() {
    setPhoto(null);
    setText("");
    setStep({ name: "camera" });
    void locate();
  }

  const facesLabel = !photo
    ? "Rozmywam twarze na telefonie"
    : !photo.faceCheckDone
      ? "Przygotowano zdjęcie"
      : photo.facesBlurred > 0
        ? `Rozmyto ${photo.facesBlurred} ${plural(photo.facesBlurred, "twarz", "twarze", "twarzy")} na telefonie`
        : "Twarze sprawdzone na telefonie";

  let screen: React.ReactNode = null;
  switch (step.name) {
    case "loading":
      screen = <div className="flex-1" />;
      break;
    case "consent":
      screen = <Consent onAccept={acceptConsent} />;
      break;
    case "camera":
      screen = (
        <Camera place={place} locating={locating} onCapture={onCapture} onChangePlace={() => setPicker("camera")} />
      );
      break;
    case "analyzing":
      screen = (
        <Analyzing photo={photo?.dataUrl ?? null} phase={step.phase} facesLabel={facesLabel} onCancel={cancelAnalysis} />
      );
      break;
    case "retake":
      screen = (
        <Retake
          photo={photo?.dataUrl ?? null}
          hint={step.hint}
          onRetake={() => setStep({ name: "camera" })}
          onPickCategory={() => setCategoryPicker(true)}
        />
      );
      break;
    case "review":
      screen = (
        <Review
          photo={photo!.dataUrl}
          analysis={step.analysis}
          unit={step.unit}
          place={place!}
          facesBlurred={photo!.facesBlurred}
          faceCheckDone={photo!.faceCheckDone}
          text={text}
          onTextChange={setText}
          onChangePlace={() => setPicker("review")}
          onBack={() => setStep({ name: "camera" })}
          onSend={send}
          sending={sending}
        />
      );
      break;
    case "done":
      screen = (
        <Thanks
          id={step.result.id}
          publicNo={step.result.publicNo}
          duplicate={step.result.duplicate}
          reportersCount={step.result.reportersCount}
          firstAt={step.result.firstAt}
          unitNameGen={step.unit.nameGen}
          onAnother={restart}
        />
      );
      break;
  }

  return (
    <>
      {screen}
      {picker && (
        <LocationPicker
          initial={place ?? { ...DEFAULT_CENTER, address: "Kraków" }}
          onConfirm={confirmPlace}
          onBack={() => {
            setPicker(null);
            if (picker === "analyze") setStep({ name: "camera" });
          }}
        />
      )}
      {categoryPicker && (
        <CategoryPicker
          onClose={() => setCategoryPicker(false)}
          onPick={(c) => {
            setCategoryPicker(false);
            if (photo && place) void analyze(photo, place, c);
          }}
        />
      )}
      {error && (
        <div className="fixed inset-x-5 bottom-28 z-30 mx-auto max-w-[440px]">
          <Toast tone="error">{error}</Toast>
        </div>
      )}
    </>
  );
}
