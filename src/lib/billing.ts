// Subscription billing for BestelBon itself, through ITPRONET's own Mollie account (MOLLIE_API_KEY_2).
// Our invoices stay leading: each invoice becomes one Mollie payment. The first payment is made online
// (Bancontact, card, ...) and creates a mandate; later invoices are collected automatically with it.
import { adminDb } from "./supabase";
import { siteUrl } from "./mollie";

const API = "https://api.mollie.com/v2";
const key = () => (process.env.MOLLIE_API_KEY_2 ?? "").trim();
export const billingEnabled = () => /^(live|test)_/.test(key());
/** Days between invoice date and automatic collection (SEPA pre-notification via the invoice). */
export const CHARGE_AFTER_DAYS = 2;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mollie ${path} ${res.status}: ${(data as { detail?: string }).detail ?? ""}`);
  return data as T;
}

type Payment = { id: string; status: string; sequenceType: string; customerId?: string; mandateId?: string; method?: string | null; metadata?: { invoice_id?: string }; _links: { checkout?: { href: string } } };
type Mandate = { id: string; status: string; method: string; details?: { consumerAccount?: string; cardNumber?: string; cardLabel?: string } };

const amount = (c: number) => ({ currency: "EUR", value: (c / 100).toFixed(2) });

async function invoiceRow(id: string) {
  const { data } = await adminDb().from("invoices").select("id, number, total_cents, status, company_id, mollie_payment_id, mollie_status, companies ( id, legal_name, email, mollie_customer_id, mollie_mandate_id, mandate_status )").eq("id", id).maybeSingle();
  return data as unknown as null | { id: string; number: string; total_cents: number; status: string; company_id: string; mollie_payment_id: string | null; mollie_status: string | null; companies: { id: string; legal_name: string; email: string; mollie_customer_id: string | null; mollie_mandate_id: string | null; mandate_status: string | null } };
}

async function customerFor(c: { id: string; legal_name: string; email: string; mollie_customer_id: string | null }) {
  if (c.mollie_customer_id) return c.mollie_customer_id;
  const cu = await api<{ id: string }>("/customers", { method: "POST", body: JSON.stringify({ name: c.legal_name, email: c.email, locale: "nl_BE", metadata: { company_id: c.id } }) });
  await adminDb().from("companies").update({ mollie_customer_id: cu.id }).eq("id", c.id);
  return cu.id;
}

/** Online payment of an invoice by the customer; also sets up the mandate for the next invoices. */
export async function payOnline(invoiceId: string, back: string) {
  const inv = await invoiceRow(invoiceId);
  if (!inv || inv.status !== "open") throw new Error("Factuur niet open");
  const customerId = await customerFor(inv.companies);
  const p = await api<Payment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: amount(inv.total_cents), description: `BestelBon factuur ${inv.number}`, customerId, sequenceType: "first",
      redirectUrl: back, webhookUrl: `${siteUrl()}/api/mollie/billing`, locale: "nl_BE", metadata: { invoice_id: inv.id },
    }),
  });
  await adminDb().from("invoices").update({ mollie_payment_id: p.id, mollie_status: p.status }).eq("id", inv.id);
  return p._links.checkout?.href ?? null;
}

/** Automatic collection with the company's mandate. */
export async function charge(invoiceId: string) {
  const inv = await invoiceRow(invoiceId);
  const c = inv?.companies;
  if (!inv || inv.status !== "open" || !c?.mollie_customer_id || !c.mollie_mandate_id || c.mandate_status !== "valid") return false;
  if (inv.mollie_payment_id && ["open", "pending", "authorized", "paid"].includes(inv.mollie_status ?? "")) return false; // al bezig
  const p = await api<Payment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: amount(inv.total_cents), description: `BestelBon factuur ${inv.number}`, customerId: c.mollie_customer_id, mandateId: c.mollie_mandate_id,
      sequenceType: "recurring", webhookUrl: `${siteUrl()}/api/mollie/billing`, metadata: { invoice_id: inv.id },
    }),
  });
  await adminDb().from("invoices").update({ mollie_payment_id: p.id, mollie_status: p.status, charged_at: new Date().toISOString() }).eq("id", inv.id);
  return true;
}

function mandateLabel(m: Mandate) {
  const iban = m.details?.consumerAccount;
  if (iban) return `Domiciliëring op ${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
  if (m.details?.cardNumber) return `${m.details.cardLabel ?? "Kaart"} •••• ${m.details.cardNumber.slice(-4)}`;
  return m.method === "directdebit" ? "Domiciliëring" : m.method;
}

/** Webhook: read the payment at Mollie and update the invoice (and mandate). */
export async function syncPayment(paymentId: string) {
  const db = adminDb();
  const { data: inv } = await db.from("invoices").select("id, company_id, status").eq("mollie_payment_id", paymentId).maybeSingle();
  if (!inv) return;
  const p = await api<Payment>(`/payments/${encodeURIComponent(paymentId)}`);
  const upd: Record<string, unknown> = { mollie_status: p.status };
  if (p.status === "paid" && inv.status === "open") {
    upd.status = "betaald"; upd.paid_at = new Date().toISOString(); upd.payment_method = p.sequenceType === "recurring" ? "domiciliëring" : `online (${p.method ?? "Mollie"})`;
  }
  await db.from("invoices").update(upd).eq("id", inv.id);
  if (p.mandateId && p.customerId) {
    const m = await api<Mandate>(`/customers/${p.customerId}/mandates/${p.mandateId}`);
    await db.from("companies").update({ mollie_mandate_id: m.id, mandate_status: m.status, mandate_label: mandateLabel(m) }).eq("id", inv.company_id);
  }
}

/** Daily: collect open invoices of companies with a mandate, CHARGE_AFTER_DAYS after the invoice date. */
export async function chargeDue() {
  const db = adminDb();
  const until = new Date(Date.now() - CHARGE_AFTER_DAYS * 86400_000).toISOString().slice(0, 10);
  const { data } = await db.from("invoices").select("id, companies!inner ( mandate_status )")
    .eq("status", "open").is("mollie_payment_id", null).lte("issued_on", until).eq("companies.mandate_status", "valid").limit(200);
  let n = 0;
  for (const i of data ?? []) { try { if (await charge(i.id)) n++; } catch (e) { console.error("incasso", i.id, e); } }
  return n;
}
