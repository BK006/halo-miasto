// Per-device state kept in localStorage. Prototype stand-in for user accounts:
// a random device id drives rate limiting and "Moje zgłoszenia".

const KEYS = {
  device: "zt.device",
  consent: "zt.consent",
  reports: "zt.reports",
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / storage disabled: the flow still works for this session.
  }
}

export function getDeviceId(): string {
  let id = read(KEYS.device);
  if (!id) {
    id = crypto.randomUUID();
    write(KEYS.device, id);
  }
  return id;
}

export function getConsent(): string | null {
  return read(KEYS.consent);
}

export function setConsent(version: string) {
  write(KEYS.consent, version);
}

export function getMyReportIds(): string[] {
  try {
    return JSON.parse(read(KEYS.reports) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function addMyReport(id: string) {
  const ids = getMyReportIds().filter((x) => x !== id);
  write(KEYS.reports, JSON.stringify([id, ...ids].slice(0, 50)));
}
