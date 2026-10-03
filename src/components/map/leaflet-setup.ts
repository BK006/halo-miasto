// Shared Leaflet bits. Only import from client components loaded with ssr: false.

import L from "leaflet";
import "leaflet/dist/leaflet.css";

export { L };

// OSM standard tiles (no key needed), muted with a CSS filter to match the design;
// see .zt-tiles in globals.css. Fine for demo traffic under the OSM tile policy.
export function addBaseLayer(map: L.Map) {
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    className: "zt-tiles",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
}

// Teardrop pin from the design system, optional number inside.
export function pinIcon(color: string, label = "", ink = "#FFFFFF", size = 28) {
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size * 1.2],
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      <div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(20,23,28,.3)"></div>
      <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 ${Math.round(size * 0.4)}px/1 var(--font-public-sans),sans-serif;color:${ink};font-variant-numeric:tabular-nums">${label}</span>
    </div>`,
  });
}
