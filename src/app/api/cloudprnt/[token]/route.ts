// Star CloudPRNT endpoint. Configure the printer with:  https://<app>/api/cloudprnt/<token>
// POST = poll, GET = fetch job, DELETE = confirm printed (or failed).
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminDb } from "@/lib/supabase";
import { kitchenTicket, deliveryTicket, type TicketOrder, type TicketLine } from "@/lib/ticket";
import { ticketPng, testPng, ticketsStarPrnt } from "@/lib/ticket-image";
import { after } from "next/server";
import { sendOrderReceived } from "@/lib/order-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LATE_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function printerFor(token: string) {
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await adminDb().from("printers").select("id, restaurant_id, starprnt_ok").eq("token_hash", hash).maybeSingle();
  return data;
}

async function nextJob(printerId: string) {
  const { data } = await adminDb().from("print_jobs")
    .select("id, order_id, kind, attempts, created_at, fetched_at")
    .eq("printer_id", printerId).in("status", ["wachtend", "opgehaald"])
    .order("created_at", { ascending: true }).order("kind", { ascending: true }).limit(1).maybeSingle(); // enum-volgorde: keuken, bezorging, bar → keukenbon eerst
  return data;
}

const STARPRNT = "application/vnd.star.starprnt";

/** All waiting tickets of the same order for this printer (kitchen first), so they print as one job. */
async function batchOf(printerId: string, job: { id: string; order_id: string | null }) {
  if (!job.order_id) return [];
  const { data } = await adminDb().from("print_jobs").select("id, order_id, kind, attempts, created_at")
    .eq("printer_id", printerId).eq("order_id", job.order_id).in("status", ["wachtend", "opgehaald"]).order("kind", { ascending: true });
  return data ?? [];
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const p = await printerFor((await params).token);
  if (!p) return new NextResponse("Not found", { status: 404 });
  await adminDb().from("printers").update({ last_seen_at: new Date().toISOString() }).eq("id", p.id);
  const job = await nextJob(p.id);
  // Meerdere bonnen van één bestelling: als één StarPRNT-opdracht (geen pauze tussen keuken- en bezorgbon).
  let combine = !!job && p.starprnt_ok !== false && (await batchOf(p.id, job)).length > 1;
  // Haalt de printer de StarPRNT-opdracht niet op (kent het formaat niet)? Na 20 s terug naar losse PNG-bonnen.
  if (combine && p.starprnt_ok !== true && !job!.fetched_at && Date.now() - new Date(job!.created_at).getTime() > 20_000) {
    await adminDb().from("printers").update({ starprnt_ok: false }).eq("id", p.id);
    combine = false;
  }
  return NextResponse.json(
    job ? { jobReady: true, mediaTypes: combine ? [STARPRNT] : ["image/png"], deleteMethod: "DELETE" } : { jobReady: false },
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
  const asked = new URL(req.url).searchParams.get("type") ?? "";
  console.log(`cloudprnt GET type=${asked || "-"} ua=${req.headers.get("user-agent") ?? "-"}`);
  // Graphic receipts only. Some Star firmware picks text/plain when it is offered, so we no longer offer it.
  const asText = asked.startsWith("text/");
  const IMG = { "Content-Type": "image/png", "X-Star-Cut": "full; feed=true", "X-Star-ImageDitherPattern": "none", "Cache-Control": "no-store" };

  if (!job.order_id) {
    const stamp = new Date().toLocaleString("nl-BE", { timeZone: "Europe/Brussels" });
    const text = ["################### TESTAFDRUK ###################", "", "   BestelBon werkt op deze printer.", `   ${stamp}`, "", "   Bestellingen printen hier automatisch.", "", "             BestelBon - bestelbon.eu", "", ""].join("\n");
    await db.from("print_jobs").update({ status: "opgehaald", fetched_at: new Date().toISOString(), attempts: job.attempts + 1 }).eq("id", job.id);
    if (!asText) return new NextResponse(new Uint8Array(await testPng()), { headers: IMG });
    return new NextResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Star-Cut": "full; feed=true", "Cache-Control": "no-store" } });
  }
  const { data: o } = await db.from("orders")
    .select("day_number, created_at, mode, requested_time, payment_method, payment_status, total_cents, delivery_fee_cents, customer_name, customer_phone, address, postcode, city, note, discount_cents, loyalty_note, restaurants ( name )")
    .eq("id", job.order_id).single();
  const { data: lines } = await db.from("order_lines").select("item_name, options, qty, unit_cents").eq("order_id", job.order_id).order("id");
  if (!o) return new NextResponse("Gone", { status: 410 });

  const late = Date.now() - new Date(job.created_at).getTime() > LATE_MS;
  const name = (o.restaurants as unknown as { name: string } | null)?.name ?? "";
  const order = { ...(o as unknown as TicketOrder), late };
  const ls = (lines ?? []) as TicketLine[];

  if (asked === STARPRNT) {
    const batch = await batchOf(p.id, job);
    const data = await ticketsStarPrnt(batch.map((j) => ({ kind: j.kind === "bezorging" ? "bezorging" as const : "keuken" as const, name, o: order, lines: ls })));
    const now = new Date().toISOString();
    for (const j of batch) await db.from("print_jobs").update({ status: "opgehaald", fetched_at: now, attempts: j.attempts + 1, media: "starprnt" }).eq("id", j.id);
    if (late) await db.from("orders").update({ late_print: true }).eq("id", job.order_id);
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": STARPRNT, "Cache-Control": "no-store" } });
  }
  const body = asText
    ? (job.kind === "bezorging" ? deliveryTicket(name, order, ls) : kitchenTicket(name, order, ls))
    : new Uint8Array(await ticketPng(job.kind === "bezorging" ? "bezorging" : "keuken", name, order, ls));

  await db.from("print_jobs").update({ status: "opgehaald", fetched_at: new Date().toISOString(), attempts: job.attempts + 1, media: asText ? "text" : "png" }).eq("id", job.id);
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
  const { data: first } = await db.from("print_jobs").select("fetched_at")
    .eq("printer_id", p.id).eq("status", "opgehaald").order("fetched_at", { ascending: true }).limit(1).maybeSingle();
  if (!first) return new NextResponse("OK");
  // Alles wat in dezelfde opdracht werd opgehaald (één bon, of keuken- + bezorgbon samen).
  const { data: jobs } = await db.from("print_jobs").select("id, order_id, attempts, media")
    .eq("printer_id", p.id).eq("status", "opgehaald").eq("fetched_at", first.fetched_at);
  const batch = jobs ?? [];
  const starprnt = batch.some((j) => j.media === "starprnt");
  console.log(`cloudprnt DELETE code=${code} jobs=${batch.length}${starprnt ? " starprnt" : ""}`);

  if (code.startsWith("2")) {
    const now = new Date().toISOString();
    await db.from("print_jobs").update({ status: "geprint", printed_at: now }).in("id", batch.map((j) => j.id));
    if (starprnt && p.starprnt_ok !== true) await db.from("printers").update({ starprnt_ok: true }).eq("id", p.id);
    for (const orderId of [...new Set(batch.map((j) => j.order_id).filter(Boolean))] as string[]) {
      // Eerste bon uit de printer: de zaak heeft de bestelling, dus we laten het de klant (één keer) weten.
      const { data: firstOut } = await db.from("orders").update({ customer_notified_at: now }).eq("id", orderId).is("customer_notified_at", null).select("id");
      if (firstOut?.length) after(() => sendOrderReceived(orderId).then(() => undefined));
      const { count } = await db.from("print_jobs").select("id", { count: "exact", head: true }).eq("order_id", orderId).neq("status", "geprint");
      if (!count) await db.from("orders").update({ status: "geprint", printed_at: now }).eq("id", orderId).neq("status", "geprint");
    }
  } else if (starprnt && p.starprnt_ok !== true) {
    // Printer kent StarPRNT niet: voortaan losse PNG-bonnen, en deze opnieuw.
    await db.from("printers").update({ starprnt_ok: false }).eq("id", p.id);
    await db.from("print_jobs").update({ status: "wachtend" }).in("id", batch.map((j) => j.id));
  } else {
    // Papier op, klep open, ...: opnieuw proberen, tot een maximum.
    for (const j of batch) await db.from("print_jobs").update({ status: j.attempts >= MAX_ATTEMPTS ? "mislukt" : "wachtend" }).eq("id", j.id);
  }
  return new NextResponse("OK");
}
