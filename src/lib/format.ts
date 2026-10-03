// Polish formatting helpers.

const TZ = "Europe/Warsaw";

// "3 paź 2026, 9:41"
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
  const time = d.toLocaleTimeString("pl-PL", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  return `${date.replace(".", "")}, ${time}`;
}

// "3 paź", or "teraz" / "dziś" for very recent items.
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const diffMin = (Date.now() - d.getTime()) / 60_000;
  if (diffMin < 5) return "teraz";
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: TZ }).replace(".", "");
}

// Polish plural: 1 osoba, 2–4 osoby, 5+ osób (12–14 osób).
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// "dziś, 9:41" · "wczoraj, 16:20" · "29 wrz, 18:02"
export function formatDayTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pl-PL", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (day(d) === day(today)) return `dziś, ${time}`;
  if (day(d) === day(yesterday)) return `wczoraj, ${time}`;
  return `${formatShortDate(iso)}, ${time}`;
}

// "1 d 6 h" · "5 h" · "40 min"
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

export function isToday(iso: string): boolean {
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ });
  return day(new Date(iso)) === day(new Date());
}
