import type { IconName } from "@/components/icons";

// Closed list of issue categories. Keys are stable identifiers used in the DB,
// in the AI JSON schema and in unit routing. Labels are user-facing (Polish).

export const CATEGORIES = {
  pothole: { label: "Dziura w jezdni", icon: "cone" },
  damaged_sidewalk: { label: "Uszkodzony chodnik", icon: "cone" },
  broken_streetlight: { label: "Zepsuta latarnia", icon: "bulb" },
  illegal_dumping: { label: "Nielegalne wysypisko", icon: "trash" },
  overflowing_bin: { label: "Przepełniony kosz", icon: "trash" },
  graffiti: { label: "Graffiti", icon: "brush" },
  illegal_parking: { label: "Auto blokujące wjazd", icon: "car" },
  flooding: { label: "Zalanie / awaria wodna", icon: "droplet" },
  greenery: { label: "Drzewo / zieleń", icon: "tree" },
  traffic_sign: { label: "Znak lub sygnalizacja", icon: "sign" },
  other: { label: "Inny problem", icon: "pin" },
} as const satisfies Record<string, { label: string; icon: IconName }>;

export type CategoryId = keyof typeof CATEGORIES;

export const CATEGORY_IDS = Object.keys(CATEGORIES) as [CategoryId, ...CategoryId[]];

export function isCategoryId(value: string): value is CategoryId {
  return value in CATEGORIES;
}

// Categories where a visible licence plate is evidence, not incidental personal data.
export const PLATES_ALLOWED: ReadonlySet<CategoryId> = new Set(["illegal_parking"]);
