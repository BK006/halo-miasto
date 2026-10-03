"use client";

import { useEffect, useRef } from "react";
import { L, addBaseLayer, pinIcon } from "./leaflet-setup";

// Static location preview used on the review and status screens.
export default function MiniMap({ lat, lng, zoom = 16 }: { lat: number; lng: number; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
      boxZoom: false,
    });
    addBaseLayer(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.setView([lat, lng], zoom);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1E56C8";
    if (marker.current) marker.current.setLatLng([lat, lng]);
    else marker.current = L.marker([lat, lng], { icon: pinIcon(accent), interactive: false }).addTo(m);
  }, [lat, lng, zoom]);

  return <div ref={el} className="absolute inset-0" aria-label="Mapa z lokalizacją zgłoszenia" />;
}
