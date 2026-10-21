import { userDb } from "@/lib/supabase-server";
import { seller, ubl, type Buyer, type Invoice, type Line } from "@/lib/invoice";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await userDb();
  const { data: inv } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) return new Response("Niet gevonden", { status: 404 });
  const [{ data: lines }, { data: buyer }, s] = await Promise.all([
    db.from("invoice_lines").select("description, qty, unit_cents, position").eq("invoice_id", id).order("position"),
    db.from("companies").select("legal_name, vat_number, street, postcode, city, contact_name, email").eq("id", inv.company_id).single(),
    seller(),
  ]);
  return new Response(ubl(inv as Invoice, (lines ?? []) as Line[], buyer as Buyer, s), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${inv.number}.xml"` },
  });
}
