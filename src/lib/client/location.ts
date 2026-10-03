// Location sources, in order of preference: live GPS → photo EXIF → manual pick on the map.

export type Place = { lat: number; lng: number; address: string };

// Kraków, Rynek Główny – start point for the manual picker when nothing else is known.
export const DEFAULT_CENTER = { lat: 50.0617, lng: 19.9373 };

export function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

export async function getExifPosition(file: Blob): Promise<{ lat: number; lng: number } | null> {
  try {
    const exifr = (await import("exifr")).default;
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
  } catch {
    // No EXIF or unreadable format – fall through to other sources.
  }
  return null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    const data = (await res.json()) as { address?: string };
    return data.address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export async function searchAddress(query: string): Promise<Place[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: Place[] };
  return data.results ?? [];
}
