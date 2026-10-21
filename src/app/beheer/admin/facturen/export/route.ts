import { adminOnly } from "@/lib/admin";
import { shownStatus } from "@/lib/invoice";

export async function GET(req: Request) {
  const db = await adminOnly();
  const maand = new URL(req.url).searchParams.get("maand") ?? "";
  let q = db.from("invoices").select("number, issued_on, due_on, status, subtotal_cents, vat_rate, vat_cents, total_cents, ogm, paid_at, payment_method, peppol_status, companies(legal_name, vat_number)").order("seq");
  if (/^\d{4}-\d{2}$/.test(maand)) q = q.gte("issued_on", `${maand}-01`).lt("issued_on", new Date(Date.UTC(Number(maand.slice(0, 4)), Number(maand.slice(5, 7)), 1)).toISOString().slice(0, 10));
  const { data } = await q;
  const c = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const n = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const rows = [["Nummer", "Datum", "Vervaldag", "Klant", "Btw-nummer", "Excl. btw", "Btw %", "Btw", "Totaal", "Status", "Betaald op", "Betaalwijze", "Mededeling", "Peppol"].map(c).join(";")];
  for (const i of data ?? []) {
    const co = i.companies as unknown as { legal_name: string; vat_number: string } | null;
    rows.push([i.number, i.issued_on, i.due_on, co?.legal_name, co?.vat_number, n(i.subtotal_cents), i.vat_rate, n(i.vat_cents), n(i.total_cents), shownStatus(i), i.paid_at?.slice(0, 10), i.payment_method, i.ogm, i.peppol_status].map(c).join(";"));
  }
  return new Response("﻿" + rows.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bestelbon-facturen-${maand || "alle"}.csv"` } });
}
