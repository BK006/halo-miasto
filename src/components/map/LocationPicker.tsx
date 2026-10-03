"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { PrimaryButton } from "@/components/ui";
import { reverseGeocode, searchAddress, type Place } from "@/lib/client/location";
import { L, addBaseLayer } from "./leaflet-setup";

// Screen 6: drag the map under a fixed centre pin, or search an address.
export default function LocationPicker({
  initial,
  onConfirm,
  onBack,
}: {
  initial: Place;
  onConfirm: (place: Place) => void;
  onBack: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [place, setPlace] = useState<Place>(initial);
  const [resolving, setResolving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(
      [initial.lat, initial.lng],
      17,
    );
    addBaseLayer(m);
    map.current = m;

    let seq = 0;
    const resolveCenter = async () => {
      const c = m.getCenter();
      const mine = ++seq;
      const address = await reverseGeocode(c.lat, c.lng);
      if (mine === seq) {
        setPlace({ lat: c.lat, lng: c.lng, address });
        setResolving(false);
      }
    };
    m.on("movestart", () => setResolving(true));
    m.on("moveend", resolveCenter);
    // The initial view may be a placeholder (e.g. city centre) – resolve its real address.
    void resolveCenter();
    return () => {
      m.remove();
      map.current = null;
    };
  }, [initial.lat, initial.lng]);

  async function locateMe() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.current?.setView([pos.coords.latitude, pos.coords.longitude], 18),
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setResults(await searchAddress(query));
  }

  function pickResult(r: Place) {
    setResults([]);
    setQuery("");
    (document.activeElement as HTMLElement | null)?.blur();
    map.current?.setView([r.lat, r.lng], 18);
  }

  const [street, ...rest] = place.address.split(", ");

  return (
    <div className="fixed inset-0 z-10 mx-auto max-w-[480px] overflow-hidden bg-surface">
      <div ref={el} className="absolute inset-0" />

      {/* Search bar */}
      <div className="absolute inset-x-0 top-0 z-[500] flex flex-col gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex gap-2">
          <button
            onClick={onBack}
            aria-label="Wstecz"
            className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-bg text-text-1"
            style={{ boxShadow: "var(--shadow-float)" }}
          >
            <Icon name="chevL" size={24} />
          </button>
          <form
            onSubmit={onSearch}
            className="flex h-12 flex-1 items-center gap-2.5 rounded-[14px] bg-bg px-3.5 text-text-3"
            style={{ boxShadow: "var(--shadow-float)" }}
          >
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj adresu"
              enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent text-text-1 outline-none placeholder:text-text-3"
            />
          </form>
        </div>
        {results.length > 0 && (
          <ul className="rise overflow-hidden rounded-[14px] bg-bg" style={{ boxShadow: "var(--shadow-float)" }}>
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button
                  onClick={() => pickResult(r)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px] hover:bg-surface"
                >
                  <span className="text-text-3">
                    <Icon name="pin" size={18} />
                  </span>
                  {r.address}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Fixed centre pin */}
      <div className="pointer-events-none absolute left-1/2 top-[42%] z-[400] -translate-x-1/2 -translate-y-full">
        <div
          className="flex h-10 w-10 items-center justify-center border-[3px] border-white"
          style={{
            borderRadius: "50% 50% 50% 0",
            background: "var(--accent)",
            boxShadow: "0 2px 6px rgba(20,23,28,.3)",
            transform: `rotate(-45deg) translateY(${resolving ? -6 : 0}px)`,
            transition: "transform .15s ease-out",
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[42%] z-[399] h-1.5 w-3 -translate-x-1/2 rounded-full bg-black/25" />

      {/* Bottom sheet */}
      <div
        className="absolute inset-x-0 bottom-0 z-[500] flex flex-col gap-3.5 rounded-t-3xl bg-bg px-5 pt-2 pb-[max(env(safe-area-inset-bottom),20px)]"
        style={{ boxShadow: "var(--shadow-sheet)" }}
      >
        <button
          onClick={locateMe}
          aria-label="Moja pozycja"
          className="absolute -top-16 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg text-accent"
          style={{ boxShadow: "var(--shadow-float)" }}
        >
          <Icon name="locate" size={24} />
        </button>
        <span className="h-1 w-9 self-center rounded-full bg-field" />
        <div className="mt-1 flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-text-3">Miejsce zgłoszenia</span>
          <span className="text-[22px] font-semibold leading-7" style={{ opacity: resolving ? 0.5 : 1 }}>
            {street}
          </span>
          {rest.length > 0 && <span className="text-[15px] leading-[22px] text-text-2">{rest.join(", ")}</span>}
        </div>
        <p className="text-sm leading-5 text-text-3">Przesuń mapę, aby ustawić pinezkę dokładnie w miejscu problemu.</p>
        <PrimaryButton disabled={resolving} onClick={() => onConfirm(place)}>
          Potwierdź miejsce
        </PrimaryButton>
      </div>
    </div>
  );
}
