// Vercel Cron (zie vercel.json): dagelijks nieuwe abonnementsperiodes factureren (op de startdag van elke klant)
// en openstaande facturen afschrijven bij klanten met domiciliëring.
import { NextResponse } from "next/server";
import { billingEnabled, chargeDue } from "@/lib/billing";
import { syncPendingToOctopus } from "@/lib/octopus";
import { createDueInvoices } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const created = await createDueInvoices().catch((e) => { console.error("abonnementen cron", e); return 0; });
  const charged = billingEnabled() ? await chargeDue() : 0;
  // Betaalde facturen die nog niet (goed) in Octopus staan: opnieuw proberen.
  const octopus = await syncPendingToOctopus().catch((e) => { console.error("octopus cron", e); return 0; });
  return NextResponse.json({ created, charged, octopus, ...(billingEnabled() ? {} : { note: "MOLLIE_API_KEY_2 ontbreekt" }) });
}
