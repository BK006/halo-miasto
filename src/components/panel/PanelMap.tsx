"use client";

import { useEffect, useRef } from "react";
import type { ReportDTO } from "@/lib/api-types";
import { urgencyOf } from "@/lib/domain";
import { L, addBaseLayer, pinIcon } from "@/components/map/leaflet-setup";

const PIN = {
  high: { bg: "#C2352A", ink: "#FFFFFF" },
  medium: { bg: "#E3A23B", ink: "#14171C" },
  low: { bg: "#23704A", ink: "#FFFFFF" },
} as const;

// City panel map: priority-coloured numbered pins, or a heatmap weighted by
// priority × number of reporters.
export default function PanelMap({
  reports,
  selectedId,
  mode,
  onSelect,
}: {
  reports: ReportDTO[];
  selectedId: string | null;
  mode: "pins" | "heat";
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const heat = useRef<L.Layer | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false }).setView([50.0595, 19.9415], 13);
    L.control.zoom({ position: "topright" }).addTo(m);
    addBaseLayer(m);
    pins.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Pins
  useEffect(() => {
    const group = pins.current;
    if (!group) return;
    group.clearLayers();
    if (mode !== "pins") return;
    // Draw low priority first so urgent pins sit on top.
    for (const r of [...reports].sort((a, b) => a.priority - b.priority)) {
      const c = PIN[urgencyOf(r.priority)];
      const selected = r.id === selectedId;
      const marker = L.marker([r.lat, r.lng], {
        icon: pinIcon(c.bg, String(r.priority), c.ink, selected ? 36 : 30),
        zIndexOffset: selected ? 1000 : r.priority * 10,
        title: `${r.publicNo} · ${r.address ?? ""}`,
      });
      marker.on("click", () => onSelectRef.current(r.id));
      group.addLayer(marker);
    }
  }, [reports, selectedId, mode]);

  // Heatmap (leaflet.heat needs the global L before it loads).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let cancelled = false;
    if (heat.current) {
      m.removeLayer(heat.current);
      heat.current = null;
    }
    if (mode !== "heat") return;
    (async () => {
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.heat");
      if (cancelled || !map.current) return;
      const points = reports.map(
        (r) => [r.lat, r.lng, (r.priority / 10) * Math.min(1 + (r.reportersCount - 1) * 0.35, 2.5)] as L.HeatLatLngTuple,
      );
      heat.current = L.heatLayer(points, {
        radius: 34,
        blur: 26,
        max: 1.4,
        minOpacity: 0.25,
        gradient: { 0.2: "#F6D7A6", 0.5: "#E3A23B", 0.8: "#C2352A", 1: "#8E1F16" },
      }).addTo(map.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [reports, mode]);

  // Bring the selected report into view.
  useEffect(() => {
    const r = reports.find((x) => x.id === selectedId);
    if (r && map.current && !map.current.getBounds().pad(-0.1).contains([r.lat, r.lng])) {
      map.current.panTo([r.lat, r.lng]);
    }
  }, [selectedId, reports]);

  return <div ref={el} className="absolute inset-0" aria-label="Mapa zgłoszeń" />;
}
