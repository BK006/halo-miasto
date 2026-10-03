"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { Place } from "@/lib/client/location";

export type CapturedPhoto = { source: Blob | HTMLCanvasElement; file?: File; takenAt: Date };

// Screen 2: live camera with shutter; falls back to the OS camera/file picker
// when getUserMedia is unavailable (no HTTPS, permission denied, desktop).
export function Camera({
  place,
  locating,
  onCapture,
  onChangePlace,
}: {
  place: Place | null;
  locating: boolean;
  onCapture: (photo: CapturedPhoto) => void;
  onChangePlace: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const shootInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        setLive(true);
      })
      .catch(() => setLive(false));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    const v = video.current;
    if (!live || !v || !v.videoWidth) return shootInput.current?.click();
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")!.drawImage(v, 0, 0);
    onCapture({ source: canvas, takenAt: new Date() });
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    onCapture({ source: file, file, takenAt: new Date(file.lastModified || Date.now()) });
  }

  return (
    <div className="fixed inset-0 mx-auto flex max-w-[480px] flex-col overflow-hidden bg-[#1B1E23] text-white">
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,#23272D_0_14px,#262A31_14px_28px)]">
          <span className="max-w-[240px] text-center text-sm text-white/60">
            Dotknij migawki, aby otworzyć aparat
          </span>
        </div>
      )}

      {/* Location pill */}
      <div className="relative flex flex-col items-center gap-1 pt-[max(env(safe-area-inset-top),16px)]">
        <button
          onClick={onChangePlace}
          className="flex h-11 max-w-[90%] items-center gap-2 rounded-full bg-[rgba(15,17,21,.72)] pl-3 pr-3.5 text-[15px] font-semibold backdrop-blur-md"
        >
          <Icon name="pin" size={18} />
          <span className="truncate">{place ? place.address : locating ? "Ustalam lokalizację…" : "Wskaż miejsce"}</span>
          <Icon name="chevD" size={16} stroke={2} />
        </button>
        <span className="text-[13px] text-white/80">Dotknij, aby zmienić miejsce</span>
      </div>

      {live && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/75">
          <Icon name="focus" size={240} stroke={0.6} />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-6 px-7 pb-[max(env(safe-area-inset-bottom),28px)]">
        <span className="rounded-full bg-[rgba(15,17,21,.6)] px-3.5 py-2 text-[15px]">Skieruj aparat na problem</span>
        <div className="flex w-full items-center justify-between">
          <button onClick={() => galleryInput.current?.click()} className="flex w-[88px] flex-col items-center gap-1.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <Icon name="image" size={24} />
            </span>
            <span className="text-center text-[13px] leading-4">
              Wybierz
              <br />z galerii
            </span>
          </button>
          <button
            onClick={shoot}
            aria-label="Zrób zdjęcie"
            className="-mt-[22px] h-[84px] w-[84px] rounded-full border-4 border-white p-1 transition-transform active:scale-95"
          >
            <span className="block h-full w-full rounded-full bg-white" />
          </button>
          <Link href="/moje" className="flex w-[88px] flex-col items-center gap-1.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <Icon name="list" size={24} />
            </span>
            <span className="text-center text-[13px] leading-4">
              Moje
              <br />
              zgłoszenia
            </span>
          </Link>
        </div>
      </div>

      <input
        ref={shootInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
