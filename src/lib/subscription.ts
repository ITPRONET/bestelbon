// Abonnementsfacturen per verjaardag van de startdatum: wie start op de 20e, betaalt elke 20e (of elk jaar op die dag).
import { adminDb } from "./supabase";
import { today } from "./panel";
import { PLAN } from "./admin";
import { discountLine, YEAR_DISCOUNT } from "./pricing";
import { MONTHS, seller } from "./invoice";
import { sendMail } from "./mail";
import { eur } from "./money";
import { CHARGE_AFTER_DAYS } from "./billing";

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // m = 0..11
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
/** Datum in maand (y, m) op de ankerdag, afgekapt op het einde van korte maanden (31 → 30/28). */
const onAnchor = (y: number, m: number, anchor: number) => { const n = new Date(Date.UTC(y, m, 1)); return iso(n.getUTCFullYear(), n.getUTCMonth(), Math.min(anchor, lastDay(n.getUTCFullYear(), n.getUTCMonth()))); };
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
export const longDate = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/** Start van de lopende periode op dag `on` (of null vóór de start). */
export function cycleStart(startedOn: string, billing: string, on = today()) {
  if (on < startedOn) return null;
  const anchor = Number(startedOn.slice(8, 10));
  const y = Number(on.slice(0, 4)), m = Number(on.slice(5, 7)) - 1;
  if (billing === "jaar") {
    const sm = Number(startedOn.slice(5, 7)) - 1;
    const c = onAnchor(y, sm, anchor);
    return c <= on ? c : onAnchor(y - 1, sm, anchor);
  }
  const c = onAnchor(y, m, anchor);
  return c <= on ? c : onAnchor(y, m - 1, anchor);
}

/** Laatste dag van de periode die op `start` begint. */
export function cycleEnd(start: string, startedOn: string, billing: string) {
  const anchor = Number(startedOn.slice(8, 10));
  const y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7)) - 1;
  return addDays(onAnchor(y, m + (billing === "jaar" ? 12 : 1), anchor), -1);
}

type Co = { id: string; plan: string; billing: string; started_on: string; ended_on: string | null; free_until: string | null; discount_pct: number; discount_until: string | null; discount_note: string | null; email: string; legal_name: string; mandate_status: string | null; mandate_label: string | null };

/** Maakt de betaalverzoeken voor alle abonnementen waarvan vandaag (of eerder, nog niet gefactureerd) een nieuwe periode begint. */
export async function createDueInvoices(on = today()) {
  const db = adminDb();
  const [{ data: cos }, { data: prices }] = await Promise.all([
    db.from("companies").select("id, plan, billing, started_on, ended_on, free_until, discount_pct, discount_until, discount_note, email, legal_name, mandate_status, mandate_label").in("status", ["actief", "achterstallig"]).lte("started_on", on),
    db.from("prices").select("key, cents"),
  ]);
  let n = 0;
  for (const c of (cos ?? []) as Co[]) {
    try {
      const start = cycleStart(c.started_on, c.billing, on);
      if (!start || (c.ended_on && c.ended_on < start)) continue;
      const period = start.slice(0, 7);
      const { count } = await db.from("invoices").select("id", { count: "exact", head: true }).eq("company_id", c.id).eq("period", period);
      if (count) continue;
      const end = cycleEnd(start, c.started_on, c.billing);
      const cents = prices?.find((p) => p.key === c.plan)?.cents ?? 0;
      const discountOn = c.discount_pct > 0 && (!c.discount_until || start <= c.discount_until);
      let lines: { description: string; qty: number; unit_cents: number }[];
      if (c.billing === "jaar") {
        lines = [
          { description: `Abonnement BestelBon ${PLAN[c.plan]} – 12 maanden (${longDate(start)} t/m ${longDate(end)})`, qty: 12, unit_cents: cents },
          { description: `Korting jaarlijkse betaling vooraf (${Math.round(YEAR_DISCOUNT * 100)}%)`, qty: -1, unit_cents: Math.round(cents * 12 * YEAR_DISCOUNT) },
        ];
        let free = 0;
        for (let k = 0; k < 12; k++) if (c.free_until && onAnchor(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1 + k, Number(c.started_on.slice(8, 10))) <= c.free_until) free++;
        if (free) lines.push({ description: `${free} maand${free > 1 ? "en" : ""} gratis abonnement`, qty: -free, unit_cents: cents });
        if (discountOn) lines.push(...discountLine(c.discount_pct, cents * (12 - free), c.discount_note));
      } else {
        if (c.free_until && start <= c.free_until) continue; // gratis periode: geen betaalverzoek
        lines = [{ description: `Abonnement BestelBon ${PLAN[c.plan]} – ${longDate(start)} t/m ${longDate(end)}`, qty: 1, unit_cents: cents }];
        if (discountOn) lines.push(...discountLine(c.discount_pct, cents, c.discount_note));
      }
      const { data: id, error } = await db.rpc("create_invoice", { p_company: c.id, p_period: period, p_lines: lines });
      if (error || !id) { console.error("abonnement factuur", c.id, error); continue; }
      n++;
      await mailInvoice(String(id), c, start, end).catch((e) => console.error("mail betaalverzoek", c.id, e));
    } catch (e) { console.error("abonnement", c.id, e); }
  }
  return n;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Mail naar de zaak: nieuw betaalverzoek, met betaalknop of aankondiging van de domiciliëring. */
async function mailInvoice(id: string, c: Co, start: string, end: string) {
  const db = adminDb();
  const { data: inv } = await db.from("invoices").select("number, issued_on, due_on, total_cents, ogm").eq("id", id).single();
  if (!inv || !c.email || inv.total_cents <= 0) return;
  const s = await seller();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.bestelbon.eu";
  const link = `${site}/beheer/facturen`;
  const mandate = c.mandate_status === "valid";
  const amount = eur(inv.total_cents);
  const period = `${longDate(start)} t/m ${longDate(end)}`;
  const chargeOn = longDate(addDays(inv.issued_on, CHARGE_AFTER_DAYS));
  const body = mandate
    ? [`Je nieuwe betaalverzoek voor BestelBon staat klaar: ${amount} (incl. btw) voor de periode ${period}.`,
       `Je hoeft niets te doen. We schrijven het bedrag ten vroegste op ${chargeOn} automatisch af via je domiciliëring${c.mandate_label ? ` (${c.mandate_label})` : ""}.`]
    : [`Je nieuwe betaalverzoek voor BestelBon staat klaar: ${amount} (incl. btw) voor de periode ${period}.`,
       `Betaal online met Bancontact of kaart in je beheerpagina, uiterlijk op ${longDate(inv.due_on)}.`,
       `Liever overschrijven? Gebruik ${s.iban || "ons rekeningnummer"} met de gestructureerde mededeling ${inv.ogm ?? inv.number}.`];
  const text = [`Beste ${c.legal_name},`, "", ...body, "", mandate ? `Je betaalverzoeken vind je in je beheerpagina: ${link}` : `Nu online betalen: ${link}`, "", "Na betaling krijg je de factuur via Peppol of per e-mail.", "", "Groeten,", "BestelBon", s.email].join("\n");
  const btn = mandate ? "Bekijk je betaalverzoeken" : "Nu online betalen";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#141a3a;max-width:560px">
<p>Beste ${esc(c.legal_name)},</p>${body.map((p) => `<p>${esc(p)}</p>`).join("")}
<p style="margin:24px 0"><a href="${link}" style="background:#ff4b2b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px;display:inline-block">${btn}</a></p>
<p style="color:#596088;font-size:13px">Betaalverzoek ${esc(inv.number)} · ${amount} · periode ${esc(period)}<br>Na betaling krijg je de factuur via Peppol of per e-mail.</p>
<p>Groeten,<br>BestelBon<br><a href="mailto:${esc(s.email)}" style="color:#141a3a">${esc(s.email)}</a></p></div>`;
  await sendMail({ to: c.email, subject: `Betaalverzoek BestelBon: ${amount} voor ${period}`, text, html, replyTo: s.email });
}
