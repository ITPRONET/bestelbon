// Vercel Cron (zie vercel.json): dagelijks openstaande facturen afschrijven bij klanten met domiciliëring.
import { NextResponse } from "next/server";
import { billingEnabled, chargeDue } from "@/lib/billing";
import { syncPendingToOctopus } from "@/lib/octopus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const charged = billingEnabled() ? await chargeDue() : 0;
  // Betaalde facturen die nog niet (goed) in Octopus staan: opnieuw proberen.
  const octopus = await syncPendingToOctopus().catch((e) => { console.error("octopus cron", e); return 0; });
  return NextResponse.json({ charged, octopus, ...(billingEnabled() ? {} : { note: "MOLLIE_API_KEY_2 ontbreekt" }) });
}
