// Vercel Cron (zie vercel.json): dagelijks openstaande facturen afschrijven bij klanten met domiciliëring.
import { NextResponse } from "next/server";
import { billingEnabled, chargeDue } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  if (!billingEnabled()) return NextResponse.json({ charged: 0, note: "MOLLIE_API_KEY ontbreekt" });
  return NextResponse.json({ charged: await chargeDue() });
}
