// Reverse geocoding via OpenStreetMap Nominatim (1 req/s policy – fine for a demo).
// Proxied server-side so we can set a proper User-Agent and cache results.

const cache = new Map<string, string>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Brak współrzędnych." }, { status: 400 });
  }

  // ~10 m grid so nearby taps reuse the same lookup.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached) return Response.json({ address: cached });

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pl&zoom=18&lat=${lat}&lon=${lng}`,
      { headers: { "User-Agent": "ZglosTo-HackYeah2026/0.1 (prototype)" } },
    );
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const street = [a.road ?? a.pedestrian ?? a.square ?? a.footway ?? a.place ?? a.amenity, a.house_number].filter(Boolean).join(" ");
    const city = a.city ?? a.town ?? a.village ?? "";
    const address = [street, city].filter(Boolean).join(", ") || data.display_name || key;
    cache.set(key, address);
    return Response.json({ address });
  } catch (err) {
    console.error("geocode failed", err);
    return Response.json({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  }
}
