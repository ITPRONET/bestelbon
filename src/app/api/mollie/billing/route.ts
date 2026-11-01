import { NextResponse } from "next/server";
import { syncPayment } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const id = String((await req.formData().catch(() => null))?.get("id") ?? "");
  if (!/^tr_[A-Za-z0-9]{4,40}$/.test(id)) return new NextResponse("OK");
  try { await syncPayment(id); } catch (e) { console.error("billing webhook", e); return new NextResponse("Retry", { status: 500 }); }
  return new NextResponse("OK");
}
