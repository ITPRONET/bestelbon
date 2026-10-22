// Star CloudPRNT endpoint. Configure the printer with:  https://<app>/api/cloudprnt/<token>
// POST = poll, GET = fetch job, DELETE = confirm printed (or failed).
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminDb } from "@/lib/supabase";
import { kitchenTicket, deliveryTicket, type TicketOrder, type TicketLine } from "@/lib/ticket";
import { ticketPng, testPng } from "@/lib/ticket-image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LATE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function printerFor(token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await adminDb().from("printers").select("id, restaurant_id").eq("token_hash", hash).maybeSingle();
  return data;
}

async function nextJob(printerId: string) {
  const { data } = await adminDb().from("print_jobs")
    .select("id, order_id, kind, attempts, created_at")
    .eq("printer_id", printerId).in("status", ["wachtend", "opgehaald"])
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  return data;
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const p = await printerFor((await params).token);
  if (!p) return new NextResponse("Not found", { status: 404 });
  await adminDb().from("printers").update({ last_seen_at: new Date().toISOString() }).eq("id", p.id);
  const job = await nextJob(p.id);
  return NextResponse.json(
    job ? { jobReady: true, mediaTypes: ["image/png", "text/plain"], deleteMethod: "DELETE" } : { jobReady: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const db = adminDb();
  const p = await printerFor((await params).token);
  if (!p) return new NextResponse("Not found", { status: 404 });
  const job = await nextJob(p.id);
  if (!job) return new NextResponse("No job", { status: 404 });
  // The printer asks for the media type it picked from our list; graphic receipts unless it wants text.
  const asText = (new URL(req.url).searchParams.get("type") ?? "image/png").startsWith("text/");
  const IMG = { "Content-Type": "image/png", "X-Star-Cut": "full; feed=true", "X-Star-ImageDitherPattern": "none", "Cache-Control": "no-store" };

  if (!job.order_id) {
    const stamp = new Date().toLocaleString("nl-BE", { timeZone: "Europe/Brussels" });
    const text = ["################### TESTAFDRUK ###################", "", "   BestelBon werkt op deze printer.", `   ${stamp}`, "", "   Bestellingen printen hier automatisch.", "", "             BestelBon - bestelbon.eu", "", ""].join("\n");
    await db.from("print_jobs").update({ status: "opgehaald", fetched_at: new Date().toISOString(), attempts: job.attempts + 1 }).eq("id", job.id);
    if (!asText) return new NextResponse(new Uint8Array(await testPng()), { headers: IMG });
    return new NextResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Star-Cut": "full; feed=true", "Cache-Control": "no-store" } });
  }
  const { data: o } = await db.from("orders")
    .select("day_number, created_at, mode, requested_time, payment_method, payment_status, total_cents, delivery_fee_cents, customer_name, customer_phone, address, postcode, city, note, restaurants ( name )")
    .eq("id", job.order_id).single();
  const { data: lines } = await db.from("order_lines").select("item_name, options, qty, unit_cents").eq("order_id", job.order_id).order("id");
  if (!o) return new NextResponse("Gone", { status: 410 });

  const late = Date.now() - new Date(job.created_at).getTime() > LATE_MS;
  const name = (o.restaurants as unknown as { name: string } | null)?.name ?? "";
  const order = { ...(o as unknown as TicketOrder), late };
  const ls = (lines ?? []) as TicketLine[];
  const body = asText
    ? (job.kind === "bezorging" ? deliveryTicket(name, order, ls) : kitchenTicket(name, order, ls))
    : new Uint8Array(await ticketPng(job.kind === "bezorging" ? "bezorging" : "keuken", name, order, ls));

  await db.from("print_jobs").update({ status: "opgehaald", fetched_at: new Date().toISOString(), attempts: job.attempts + 1 }).eq("id", job.id);
  if (late) await db.from("orders").update({ late_print: true }).eq("id", job.order_id);

  if (!asText) return new NextResponse(body, { headers: IMG });
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Star-Cut": "full; feed=true", "Cache-Control": "no-store" },
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const db = adminDb();
  const p = await printerFor((await params).token);
  if (!p) return new NextResponse("Not found", { status: 404 });
  const code = decodeURIComponent(new URL(req.url).searchParams.get("code") ?? "200");
  const { data: job } = await db.from("print_jobs").select("id, order_id, attempts")
    .eq("printer_id", p.id).eq("status", "opgehaald").order("fetched_at", { ascending: true }).limit(1).maybeSingle();
  if (!job) return new NextResponse("OK");

  if (code.startsWith("2")) {
    const now = new Date().toISOString();
    await db.from("print_jobs").update({ status: "geprint", printed_at: now }).eq("id", job.id);
    if (!job.order_id) return new NextResponse("OK");
    const { count } = await db.from("print_jobs").select("id", { count: "exact", head: true })
      .eq("order_id", job.order_id).neq("status", "geprint");
    if (!count) await db.from("orders").update({ status: "geprint", printed_at: now }).eq("id", job.order_id).neq("status", "geprint");
    // TODO: e-mail "ontvangen door de zaak" naar de klant
  } else {
    // Papier op, klep open, ...: opnieuw proberen, tot een maximum.
    await db.from("print_jobs").update({ status: job.attempts >= MAX_ATTEMPTS ? "mislukt" : "wachtend" }).eq("id", job.id);
  }
  return new NextResponse("OK");
}
