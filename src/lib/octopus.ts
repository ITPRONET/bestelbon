// Octopus (boekhouding ITPRONET): een betaalde BestelBon-factuur wordt automatisch
//  1) als klant (relatie) aangemaakt of bijgewerkt in Octopus,
//  2) als verkoopfactuur geboekt in het verkoopdagboek,
//  3) verstuurd via Peppol (Belgisch btw-nummer) of anders per e-mail, door Octopus zelf.
// Zelfde werkwijze als in Hotelize. Instellingen via env (geheimen enkel in Vercel):
//   OCTOPUS_SOFTWARE_HOUSE_UUID, OCTOPUS_USER, OCTOPUS_PASSWORD (sensitive), OCTOPUS_DOSSIER_ID
//   optioneel: OCTOPUS_JOURNAL (V), OCTOPUS_VAT_CODE (21), OCTOPUS_ACCOUNT_ID, OCTOPUS_FROM_EMAIL,
//   OCTOPUS_ENV=production (anders testmodus: factuur wordt aangemaakt maar niet verstuurd)
import { adminDb } from "./supabase";
import { normVat } from "./vat";

const BASE = (process.env.OCTOPUS_API_URL || "https://service.inaras.be/octopus-rest-api/v1").replace(/\/+$/, "");
const env = (k: string) => (process.env[k] ?? "").trim();
export const octopusEnabled = () => !!(env("OCTOPUS_SOFTWARE_HOUSE_UUID") && env("OCTOPUS_USER") && env("OCTOPUS_PASSWORD") && env("OCTOPUS_DOSSIER_ID"));
export const octopusLive = () => env("OCTOPUS_ENV") === "production";
const dossier = () => Number(env("OCTOPUS_DOSSIER_ID"));
const MAX_ATTEMPTS = 5;
const RETRY_MIN = [30, 120, 360, 1440];

class OctoError extends Error { constructor(msg: string, public status = 0, public retryAfter = 0) { super(msg); } }

async function req<T = unknown>(path: string, o: { method?: string; headers?: Record<string, string>; body?: unknown; query?: Record<string, string | number> } = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(o.query ?? {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: o.method ?? "GET", cache: "no-store",
    headers: { accept: "application/json", ...(o.body !== undefined ? { "content-type": "application/json" } : {}), ...(o.headers ?? {}) },
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const d = data as { message?: string; error?: string; title?: string } | null;
    const msg = (d && typeof d === "object" && (d.message || d.error || d.title)) || (typeof data === "string" && data) || `HTTP ${res.status}`;
    throw new OctoError(`Octopus ${path.split("?")[0]}: ${String(msg).slice(0, 300)}`, res.status, Number(res.headers.get("retry-after")) || 0);
  }
  return data as T;
}

async function session() {
  const auth = await req<{ token?: string }>("/authentication", {
    method: "POST", headers: { softwareHouseUuid: env("OCTOPUS_SOFTWARE_HOUSE_UUID") },
    body: { user: env("OCTOPUS_USER"), password: env("OCTOPUS_PASSWORD") },
  });
  if (!auth?.token) throw new OctoError("Octopus gaf geen token terug");
  const d = await req<{ Dossiertoken?: string; dossierToken?: string; token?: string }>("/dossiers", {
    method: "POST", headers: { Token: auth.token }, query: { dossierId: dossier(), localeId: 1 },
  });
  const dossierToken = d?.Dossiertoken || d?.dossierToken || d?.token;
  if (!dossierToken) throw new OctoError("Octopus gaf geen dossiertoken terug");
  return { token: auth.token, dossierToken };
}

type Period = { nr: number | null; start: string; end: string; closed: boolean };
type Bookyear = { id: number; start: string; end: string; closed: boolean; periods: Period[] };
function cleanBookyear(b: Record<string, unknown>): Bookyear {
  const key = b.bookyearKey as { id?: number } | undefined;
  return {
    id: Number(key?.id ?? b.id), start: String(b.startDate ?? ""), end: String(b.endDate ?? ""), closed: !!b.closed,
    periods: ((b.periods as Record<string, unknown>[]) ?? []).map((p) => ({ nr: Number(p.bookyearPeriod ?? p.periodNr ?? p.bookyearPeriodNr ?? 0) || null, start: String(p.startDate ?? ""), end: String(p.endDate ?? ""), closed: !!p.closed })),
  };
}
const journalOf = (j: Record<string, unknown>) => ({ key: String(j.journalKey ?? ""), name: String(j.name ?? ""), closed: !!j.closed, last: j.lastBookedDocumentNr == null ? null : Number(j.lastBookedDocumentNr), type: Number(j.insertionType ?? 0) });

/** Setup info for the admin page: dossiers, book years, journals, VAT codes and the suggested settings. */
export async function octopusSetup() {
  const { token, dossierToken } = await session();
  const h = { dossierToken };
  const today = new Date().toISOString().slice(0, 10);
  const [dossiers, yearsRaw, vat] = await Promise.all([
    req<Record<string, unknown>[]>("/dossiers", { headers: { Token: token } }),
    req<Record<string, unknown>[]>(`/dossiers/${dossier()}/bookyears`, { headers: h }),
    req<Record<string, unknown>[]>(`/dossiers/${dossier()}/vatcodes`, { headers: h }),
  ]);
  const years = (yearsRaw ?? []).map(cleanBookyear);
  const year = years.find((y) => !y.closed && y.start <= today && y.end >= today) ?? years.find((y) => !y.closed) ?? years[0];
  const journals = year ? ((await req<Record<string, unknown>[]>(`/dossiers/${dossier()}/bookyears/${year.id}/journals`, { headers: h })) ?? []).map(journalOf) : [];
  const vatCodes = (vat ?? []).map((v) => ({ code: String(v.code ?? ""), description: String(v.description ?? ""), pct: v.basePercentage == null ? null : Number(v.basePercentage), type: Number(v.type ?? 0), account: v.defaultSellBookingAccountNr == null ? null : Number(v.defaultSellBookingAccountNr) }));
  const sugVat = vatCodes.find((v) => v.pct === 21 && v.type === 2) ?? vatCodes.find((v) => v.pct === 21);
  const sugJournal = journals.find((j) => j.key.startsWith("V") && [2, 3].includes(j.type) && !j.closed) ?? journals.find((j) => j.key.startsWith("V") && !j.closed);
  return {
    dossiers: (dossiers ?? []).map((d) => ({ id: (d.dossierKey as { id?: number })?.id ?? null, name: String(d.dossierDescription ?? ""), vat: String(d.vatNr ?? "") })),
    dossierName: String((dossiers ?? []).find((d) => Number((d.dossierKey as { id?: number })?.id) === dossier())?.dossierDescription ?? dossier()),
    bookyear: year ?? null, journals, vatCodes,
    suggestion: { journal: sugJournal?.key ?? "V", vatCode: sugVat?.code ?? "21", accountId: sugVat?.account ?? null },
    config: { journal: journalKey(), vatCode: vatCode(), accountId: env("OCTOPUS_ACCOUNT_ID") || null, live: octopusLive() },
  };
}

const journalKey = () => env("OCTOPUS_JOURNAL") || "V";
const vatCode = () => env("OCTOPUS_VAT_CODE") || "21";

/** FNV-1a: stable numeric id for the company in Octopus (same scheme as Hotelize). */
function externalId(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (Math.abs(h) % 2000000000) + 1;
}

type Inv = {
  id: string; number: string; issued_on: string; due_on: string; status: string; total_cents: number; paid_at: string | null; period: string | null;
  octopus_status: string | null; octopus_doc: string | null; octopus_attempts: number; octopus_next_try: string | null; octopus_request: { bookyearId?: number; journal?: string; docNr?: number } | null;
  invoice_lines: { description: string; qty: number; unit_cents: number; position: number }[];
  companies: { id: string; legal_name: string; vat_number: string | null; street: string | null; postcode: string | null; city: string | null; email: string | null };
};

const FINAL = new Set(["peppol_ok", "peppol_bezig", "email_ok", "test_niet_verstuurd"]);

/**
 * Sync one paid invoice to Octopus. Safe to call many times: finished invoices are skipped, and an invoice that
 * already exists in Octopus is only re-sent, never booked twice.
 */
export async function syncInvoiceToOctopus(invoiceId: string, opts: { force?: boolean } = {}) {
  if (!octopusEnabled()) return { skipped: "octopus_uit" };
  const db = adminDb();
  const { data } = await db.from("invoices")
    .select("id, number, issued_on, due_on, status, total_cents, paid_at, period, octopus_status, octopus_doc, octopus_attempts, octopus_next_try, octopus_request, invoice_lines ( description, qty, unit_cents, position ), companies ( id, legal_name, vat_number, street, postcode, city, email )")
    .eq("id", invoiceId).maybeSingle();
  const inv = data as unknown as Inv | null;
  if (!inv || inv.status !== "betaald") return { skipped: "niet_betaald" };
  if (inv.octopus_status && FINAL.has(inv.octopus_status) && !opts.force) return { skipped: "al_klaar" };
  if (!opts.force && inv.octopus_attempts >= MAX_ATTEMPTS) return { skipped: "max_pogingen" };
  if (!opts.force && inv.octopus_next_try && new Date(inv.octopus_next_try) > new Date()) return { skipped: "wacht" };
  if (inv.total_cents <= 0) { await db.from("invoices").update({ octopus_status: "nul_bedrag" }).eq("id", inv.id); return { skipped: "nul_bedrag" }; }

  // Claim (no double booking when the webhook and the cron run at the same moment).
  const attempts = inv.octopus_attempts + 1;
  const { data: claimed } = await db.from("invoices").update({ octopus_status: "bezig", octopus_attempts: attempts, octopus_next_try: new Date(Date.now() + 10 * 60_000).toISOString() })
    .eq("id", inv.id).eq("octopus_attempts", inv.octopus_attempts).select("id");
  if (!claimed?.length) return { skipped: "bezig" };

  const co = inv.companies;
  const v = normVat(co.vat_number ?? "");
  const hasVat = !!(co.vat_number ?? "").trim() && v.digits.length > 0;
  const country = hasVat ? v.compact.slice(0, 2) : "BE";
  const peppol = hasVat && country === "BE" && v.ok;
  let request: Record<string, unknown> | null = null;
  try {
    const { dossierToken } = await session();
    const h = { dossierToken };
    let doc = inv.octopus_request?.docNr && inv.octopus_doc ? { bookyearId: inv.octopus_request.bookyearId!, journal: inv.octopus_request.journal!, docNr: inv.octopus_request.docNr } : null;

    if (!doc) {
      // 1) Relatie (klant): aanmaken of bijwerken op ons vaste extern id.
      const relation = {
        relationIdentificationServiceData: { externalRelationId: externalId(co.id) },
        name: co.legal_name, client: true,
        streetAndNr: co.street ?? "", postalCode: co.postcode ?? "", city: co.city ?? "", country,
        email: co.email ?? "", currencyCode: "EUR",
        ...(hasVat ? { vatNr: v.compact } : {}),
        vatType: hasVat ? (country === "BE" ? 1 : 4) : country === "BE" ? 7 : 8,
        factLanguage: country === "FR" ? 1 : country === "DE" ? 3 : 0,
        invoiceDeliveryMethod: peppol ? 3 : 1,
        ...(peppol ? { participantId: `0208:${v.digits}` } : {}),
        active: true,
      };
      const rel = await req<{ relationIdentificationServiceData?: unknown }>(`/dossiers/${dossier()}/relations`, { method: "PUT", headers: h, body: relation });

      // 2) Boekjaar, periode en volgend documentnummer in het verkoopdagboek.
      const date = (inv.paid_at ?? inv.issued_on).slice(0, 10);
      const years = ((await req<Record<string, unknown>[]>(`/dossiers/${dossier()}/bookyears`, { headers: h })) ?? []).map(cleanBookyear);
      const year = years.find((y) => y.start <= date && y.end >= date && !y.closed) ?? years.find((y) => y.start <= date && y.end >= date);
      if (!year) throw new OctoError(`Geen open boekjaar in Octopus voor ${date}`);
      const period = year.periods.find((p) => p.start <= date && p.end >= date)?.nr ?? Number(date.slice(5, 7));
      const journals = ((await req<Record<string, unknown>[]>(`/dossiers/${dossier()}/bookyears/${year.id}/journals`, { headers: h })) ?? []).map(journalOf);
      const j = journals.find((x) => x.key === journalKey());
      if (!j) throw new OctoError(`Dagboek ${journalKey()} niet gevonden in Octopus`);
      const docNr = (j.last ?? 0) + 1;

      // 3) Verkoopfactuur (lijnen excl. btw, zoals op onze factuur).
      const lines = [...inv.invoice_lines].sort((a, b) => a.position - b.position).map((l) => ({
        description: l.description.slice(0, 250), count: Number(l.qty) || 1, unit: "pcs",
        unitPrice: Math.round(l.unit_cents) / 100, discountPercentage: 0, vatCodeKey: vatCode(),
        ...(env("OCTOPUS_ACCOUNT_ID") ? { bookingAccountNr: Number(env("OCTOPUS_ACCOUNT_ID")) } : {}),
      }));
      request = {
        bookyearKey: { id: year.id }, journalKey: journalKey(), documentSequenceNr: docNr, bookyearPeriodeNr: period,
        documentDate: date, expiryDate: date, currencyCode: "EUR", exchangeRate: 1,
        relationIdentificationServiceData: rel?.relationIdentificationServiceData ?? relation.relationIdentificationServiceData,
        comment: `BestelBon ${inv.number}`, reference: inv.number, invoiceLines: lines,
      };
      const created = await req<{ documentSequenceNr?: number }>(`/dossiers/${dossier()}/invoices`, { method: "POST", headers: h, body: request });
      doc = { bookyearId: year.id, journal: journalKey(), docNr: created?.documentSequenceNr ?? docNr };
      await db.from("invoices").update({ octopus_status: "aangemaakt", octopus_doc: `${doc.journal}/${doc.docNr}`, octopus_request: doc, octopus_error: null }).eq("id", inv.id);
    }

    // 4) Versturen via Peppol of e-mail (alleen in productie; in testmodus blijft de factuur in Octopus staan).
    if (!octopusLive()) {
      await db.from("invoices").update({ octopus_status: "test_niet_verstuurd", octopus_synced_at: new Date().toISOString(), octopus_next_try: null }).eq("id", inv.id);
      return { ok: true, status: "test_niet_verstuurd", doc };
    }
    const send = { bookyearKey: { id: doc.bookyearId }, journal: doc.journal, documentSequenceNr: doc.docNr, toDocumentSequenceNr: doc.docNr, fromMailAddress: env("OCTOPUS_FROM_EMAIL") || "info@bestelbon.eu", forceUseEmail: !peppol };
    const res = await req<{ success?: boolean; sendInvoiceStatusList?: { sendMethod?: string; success?: boolean; comment?: string }[] }>(`/dossiers/${dossier()}/invoices/send`, { method: "POST", headers: h, body: send });
    let report: { deliveryState?: string; comment?: string }[] | null = null;
    try {
      report = await req(`/dossiers/${dossier()}/invoices/send/report/deliverystate`, { method: "POST", headers: h, body: { bookyearKey: send.bookyearKey, journal: send.journal, documentSequenceNr: send.documentSequenceNr, toDocumentSequenceNr: send.toDocumentSequenceNr } });
    } catch { /* status volgt later */ }
    const state = String(report?.[0]?.deliveryState ?? "").toUpperCase();
    const st = res?.sendInvoiceStatusList?.[0] ?? {};
    const method = String(st.sendMethod ?? "").toUpperCase();
    const ok = res?.success !== false && st.success !== false;
    const status = state === "PEPPOL_SEND_OK" ? "peppol_ok" : state === "PEPPOL_SENDING_IN_PROGRESS" ? "peppol_bezig" : state === "PEPPOL_SEND_FAILED" ? "fout"
      : ["EMAILED", "PRINTED_AND_EMAILED"].includes(state) ? "email_ok" : method === "PEPPOL" && ok ? "peppol_bezig" : method === "MAIL" && ok ? "email_ok" : ok ? "email_ok" : "fout";
    const comment = report?.[0]?.comment || st.comment || null;
    await db.from("invoices").update({
      octopus_status: status, octopus_error: status === "fout" ? comment ?? "Octopus verstuurde de factuur niet" : null,
      octopus_synced_at: new Date().toISOString(), octopus_next_try: status === "fout" ? retryAt(attempts) : null,
      peppol_status: status === "peppol_ok" ? "afgeleverd" : status === "peppol_bezig" ? "verstuurd" : status === "email_ok" ? "per_mail" : undefined,
    }).eq("id", inv.id);
    return { ok: status !== "fout", status, doc };
  } catch (e) {
    const err = e as OctoError;
    console.error("octopus", inv.number, err.message);
    await db.from("invoices").update({
      octopus_status: inv.octopus_doc ? "aangemaakt" : "fout", octopus_error: err.message.slice(0, 500),
      octopus_next_try: retryAt(attempts, err.retryAfter),
    }).eq("id", inv.id);
    return { ok: false, error: err.message };
  }
}

function retryAt(attempts: number, retryAfterSec = 0) {
  if (attempts >= MAX_ATTEMPTS) return null;
  const min = Math.max(RETRY_MIN[Math.min(attempts - 1, RETRY_MIN.length - 1)], Math.ceil(retryAfterSec / 60));
  return new Date(Date.now() + min * 60_000).toISOString();
}

/** Cron: retry paid invoices that are not yet in Octopus (or failed to send). */
export async function syncPendingToOctopus() {
  if (!octopusEnabled()) return 0;
  const { data } = await adminDb().from("invoices").select("id")
    .eq("status", "betaald").or("octopus_status.is.null,octopus_status.in.(fout,aangemaakt,bezig)")
    .lt("octopus_attempts", MAX_ATTEMPTS).or(`octopus_next_try.is.null,octopus_next_try.lte.${new Date().toISOString()}`).limit(20);
  let n = 0;
  for (const i of data ?? []) { const r = await syncInvoiceToOctopus(i.id); if ("ok" in r && r.ok) n++; }
  return n;
}
