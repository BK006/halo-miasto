import { Resend } from "resend";
import { CATEGORIES, type CategoryId } from "@/config/categories";
import type { Unit } from "@/config/units";
import { URGENCY_LABELS, urgencyOf } from "@/lib/domain";

export type ReportEmail = {
  publicNo: string;
  unit: Unit;
  category: CategoryId;
  priority: number;
  address: string;
  lat: number;
  lng: number;
  reportText: string;
  photo: Buffer;
};

export type EmailResult = { delivered: boolean; note: string };

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Demo mode: every report goes to DEMO_EMAIL_TO, never to a real city unit.
export async function sendReportEmail(r: ReportEmail): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.DEMO_EMAIL_TO;
  if (!key || !to) {
    console.warn(`[email] skipped for ${r.publicNo}: RESEND_API_KEY or DEMO_EMAIL_TO not set`);
    return { delivered: false, note: "demo: e-mail pominięty (brak konfiguracji)" };
  }

  const mapsUrl = `https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=19/${r.lat}/${r.lng}`;
  const urgency = `${r.priority}/10 (${URGENCY_LABELS[urgencyOf(r.priority)]})`;
  const subject = `[${r.publicNo}] ${CATEGORIES[r.category].label} – ${r.address}`;

  const text = [
    `Do: ${r.unit.name} <${r.unit.email}>  (wersja demonstracyjna – przekierowano)`,
    `Numer zgłoszenia: ${r.publicNo}`,
    `Kategoria: ${CATEGORIES[r.category].label}`,
    `Pilność: ${urgency}`,
    `Miejsce: ${r.address} (${r.lat.toFixed(6)}, ${r.lng.toFixed(6)})`,
    `Mapa: ${mapsUrl}`,
    "",
    r.reportText,
  ].join("\n");

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#14171C;max-width:600px">
<p style="color:#636A75;font-size:13px">Do: ${escape(r.unit.name)} &lt;${escape(r.unit.email)}&gt; · wersja demonstracyjna, przekierowano</p>
<table style="border-collapse:collapse;margin:12px 0">
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Numer</td><td><b>${escape(r.publicNo)}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Kategoria</td><td>${escape(CATEGORIES[r.category].label)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Pilność</td><td>${escape(urgency)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#636A75">Miejsce</td><td>${escape(r.address)}<br><a href="${mapsUrl}">${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}</a></td></tr>
</table>
<p style="white-space:pre-line">${escape(r.reportText)}</p>
<p style="color:#636A75;font-size:13px">Zdjęcie w załączniku. Twarze zostały rozmyte na urządzeniu zgłaszającego.</p>
</div>`;

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Zglos to <onboarding@resend.dev>",
      to,
      subject,
      text,
      html,
      attachments: [{ filename: `${r.publicNo}.jpg`, content: r.photo }],
    });
    if (error) throw new Error(error.message);
    return { delivered: true, note: `e-mail do ${r.unit.name}` };
  } catch (err) {
    console.error(`[email] failed for ${r.publicNo}`, err);
    return { delivered: false, note: "błąd wysyłki e-mail" };
  }
}
