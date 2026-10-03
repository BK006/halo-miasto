// Closed list of issue categories. Keys are stable identifiers used in the DB,
// in the Claude JSON schema and in unit routing. Labels are user-facing (Polish).

export const CATEGORIES = {
  pothole: { label: "Dziura w jezdni", icon: "🕳️" },
  damaged_sidewalk: { label: "Uszkodzony chodnik", icon: "🚶" },
  broken_streetlight: { label: "Zepsute oświetlenie", icon: "💡" },
  illegal_dumping: { label: "Nielegalne wysypisko", icon: "🗑️" },
  overflowing_bin: { label: "Przepełniony kosz", icon: "🚮" },
  graffiti: { label: "Graffiti / dewastacja", icon: "🎨" },
  illegal_parking: { label: "Złe parkowanie / blokowanie wjazdu", icon: "🚗" },
  flooding: { label: "Zalanie / awaria wodna", icon: "💧" },
  greenery: { label: "Zieleń (drzewo, gałęzie)", icon: "🌳" },
  traffic_sign: { label: "Znak lub sygnalizacja", icon: "🚦" },
  other: { label: "Inne", icon: "📍" },
} as const;

export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_IDS = Object.keys(CATEGORIES) as [CategoryId, ...CategoryId[]];

// Categories where a visible licence plate is evidence, not incidental personal data.
export const PLATES_ALLOWED: ReadonlySet<CategoryId> = new Set(["illegal_parking"]);
