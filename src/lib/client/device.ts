// Per-device state kept in localStorage: device id (fallback identity for rate
// limiting), consent, the resident's phone session and recently sent report ids.

const KEYS = {
  device: "zt.device",
  consent: "zt.consent",
  reports: "zt.reports",
  session: "zt.session",
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

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
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

// --- Phone session (from the `auth` Edge Function) --------------------------

export type Session = { token: string; phone: string };

export function getSession(): Session | null {
  try {
    const s = JSON.parse(read(KEYS.session) ?? "null") as Session | null;
    return s?.token && s.phone ? s : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  write(KEYS.session, JSON.stringify(session));
}

export function clearSession() {
  remove(KEYS.session);
  remove(KEYS.reports);
}

// --- Recently sent reports (fallback when not signed in) ---------------------

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
