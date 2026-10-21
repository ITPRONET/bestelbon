import Link from "next/link";
import { notFound } from "next/navigation";
import InvoiceDoc from "@/components/InvoiceDoc";
import PrintButton from "@/components/PrintButton";
import { panel } from "@/lib/panel";
import { seller, type Buyer, type Invoice, type Line } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Factuur" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, isAdmin } = await panel();
  const { data: inv } = await db.from("invoices").select("*").eq("id", id).maybeSingle(); // RLS: eigen bedrijf of admin
  if (!inv) notFound();
  const [{ data: lines }, { data: buyer }, s] = await Promise.all([
    db.from("invoice_lines").select("description, qty, unit_cents, position").eq("invoice_id", id).order("position"),
    db.from("companies").select("legal_name, vat_number, street, postcode, city, contact_name, email").eq("id", inv.company_id).single(),
    seller(),
  ]);
  return (
    <>
      <div className="noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Link className="btn" href={isAdmin ? `/beheer/admin/bedrijf/${inv.company_id}` : "/beheer/facturen"}>← Terug</Link>
        <PrintButton label="Download PDF / afdrukken" />
        <a className="btn" href={`/beheer/factuur/${id}/ubl`}>Peppol-bestand (UBL)</a>
      </div>
      <InvoiceDoc inv={inv as Invoice} lines={(lines ?? []) as Line[]} buyer={buyer as Buyer} s={s} />
    </>
  );
}
