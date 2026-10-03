import type { CategoryId } from "./categories";

// Category → city unit routing for the Kraków demo.
// Unit assignments are a prototype assumption and must be verified with the city.
// Addresses are fake: in demo mode every e-mail goes to DEMO_EMAIL_TO instead.

export type Unit = { id: string; name: string; email: string };

export const UNITS = {
  zdmk: { id: "zdmk", name: "Zarząd Dróg Miasta Krakowa", email: "zdmk@demo.zglos.to" },
  sm: { id: "sm", name: "Straż Miejska Miasta Krakowa", email: "straz@demo.zglos.to" },
  zzm: { id: "zzm", name: "Zarząd Zieleni Miejskiej w Krakowie", email: "zielen@demo.zglos.to" },
  mpwik: { id: "mpwik", name: "MPWiK w Krakowie", email: "mpwik@demo.zglos.to" },
  mpo: { id: "mpo", name: "MPO Kraków", email: "mpo@demo.zglos.to" },
  um: { id: "um", name: "Urząd Miasta Krakowa – Biuro Interwencji", email: "interwencje@demo.zglos.to" },
} as const satisfies Record<string, Unit>;

export type UnitId = keyof typeof UNITS;

export const ROUTING: Record<CategoryId, UnitId> = {
  pothole: "zdmk",
  damaged_sidewalk: "zdmk",
  broken_streetlight: "zdmk",
  traffic_sign: "zdmk",
  illegal_dumping: "sm",
  illegal_parking: "sm",
  graffiti: "sm",
  overflowing_bin: "mpo",
  flooding: "mpwik",
  greenery: "zzm",
  other: "um",
};

export function unitFor(category: CategoryId): Unit {
  return UNITS[ROUTING[category]];
}
