import type { CategoryId } from "./categories";

// Category → city unit routing for the Kraków demo.
// Unit assignments are a prototype assumption and must be verified with the city.
// Addresses are fake: in demo mode every e-mail goes to DEMO_EMAIL_TO instead.

export type Unit = {
  id: string;
  name: string;
  // Genitive form for "Trafiło do …".
  nameGen: string;
  short: string;
  email: string;
};

export const UNITS = {
  zdmk: {
    id: "zdmk",
    name: "Zarząd Dróg Miasta Krakowa",
    nameGen: "Zarządu Dróg Miasta Krakowa",
    short: "ZDMK",
    email: "zdmk@demo.halomiasto.pl",
  },
  sm: {
    id: "sm",
    name: "Straż Miejska Miasta Krakowa",
    nameGen: "Straży Miejskiej Miasta Krakowa",
    short: "Straży Miejskiej",
    email: "straz@demo.halomiasto.pl",
  },
  zzm: {
    id: "zzm",
    name: "Zarząd Zieleni Miejskiej w Krakowie",
    nameGen: "Zarządu Zieleni Miejskiej w Krakowie",
    short: "ZZM",
    email: "zielen@demo.halomiasto.pl",
  },
  mpwik: {
    id: "mpwik",
    name: "MPWiK w Krakowie",
    nameGen: "MPWiK w Krakowie",
    short: "MPWiK",
    email: "mpwik@demo.halomiasto.pl",
  },
  mpo: {
    id: "mpo",
    name: "MPO w Krakowie",
    nameGen: "MPO w Krakowie",
    short: "MPO",
    email: "mpo@demo.halomiasto.pl",
  },
  um: {
    id: "um",
    name: "Urząd Miasta Krakowa – Biuro Interwencji",
    nameGen: "Urzędu Miasta Krakowa – Biura Interwencji",
    short: "UMK",
    email: "interwencje@demo.halomiasto.pl",
  },
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

export function unitById(id: string): Unit | undefined {
  return (UNITS as Record<string, Unit>)[id];
}
