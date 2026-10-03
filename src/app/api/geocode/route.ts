// Geocoding via OpenStreetMap Nominatim (1 req/s policy – fine for a demo).
// Proxied server-side so we can set a proper User-Agent and cache results.
//   GET ?lat=&lng=  → { address }            (reverse)
//   GET ?q=         → { results: Place[] }   (forward search, biased to Kraków)

const NOMINATIM = "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "ZglosTo-HackYeah2026/0.1 (prototype)" };
// Kraków bounding box: left, top, right, bottom.
const KRAKOW_VIEWBOX = "19.79,50.13,20.22,49.97";

type NominatimAddress = Record<string, string | undefined>;

const reverseCache = new Map<string, string>();

function formatAddress(a: NominatimAddress, fallback: string): string {
  const street = [a.road ?? a.pedestrian ?? a.square ?? a.footway ?? a.place ?? a.amenity, a.house_number]
    .filter(Boolean)
    .join(" ");
  const city = a.city ?? a.town ?? a.village ?? "";
  return [street, city].filter(Boolean).join(", ") || fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (q) return search(q);

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "Brak współrzędnych." }, { status: 400 });
  }
  return reverse(lat, lng);
}

async function reverse(lat: number, lng: number) {
  // ~10 m grid so nearby lookups reuse the same result.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = reverseCache.get(key);
  if (cached) return Response.json({ address: cached });

  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&accept-language=pl&zoom=18&lat=${lat}&lon=${lng}`, {
      headers: HEADERS,
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = (await res.json()) as { display_name?: string; address?: NominatimAddress };
    const address = formatAddress(data.address ?? {}, data.display_name ?? key);
    reverseCache.set(key, address);
    return Response.json({ address });
  } catch (err) {
    console.error("reverse geocode failed", err);
    return Response.json({ address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  }
}

async function search(q: string) {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      "accept-language": "pl",
      addressdetails: "1",
      limit: "5",
      viewbox: KRAKOW_VIEWBOX,
      bounded: "1",
      q,
    });
    const res = await fetch(`${NOMINATIM}/search?${params}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = (await res.json()) as { lat: string; lon: string; display_name: string; address?: NominatimAddress }[];
    const results = data.map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      address: formatAddress(r.address ?? {}, r.display_name),
    }));
    return Response.json({ results });
  } catch (err) {
    console.error("search geocode failed", err);
    return Response.json({ results: [] });
  }
}
