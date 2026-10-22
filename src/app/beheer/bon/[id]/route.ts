import { userDb } from "@/lib/supabase-server";
import { ticketPng } from "@/lib/ticket-image";
import type { TicketLine, TicketOrder } from "@/lib/ticket";

export const runtime = "nodejs";

// The exact image the printer gets, for the panel. RLS: only orders of your own restaurant.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("soort") === "bezorging" ? "bezorging" : "keuken";
  const db = await userDb();
  const { data: o } = await db.from("orders")
    .select("day_number, created_at, mode, requested_time, payment_method, payment_status, total_cents, delivery_fee_cents, customer_name, customer_phone, address, postcode, city, note, late_print, restaurants ( name ), order_lines ( item_name, options, qty, unit_cents, id )")
    .eq("id", id).maybeSingle();
  if (!o) return new Response("Niet gevonden", { status: 404 });
  const lines = ((o.order_lines ?? []) as (TicketLine & { id: number })[]).sort((a, b) => a.id - b.id);
  const name = (o.restaurants as unknown as { name: string } | null)?.name ?? "";
  const png = await ticketPng(kind, name, { ...(o as unknown as TicketOrder), late: !!o.late_print }, lines);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } });
}
