import { NextResponse } from "next/server";
import { z } from "zod";
import { findCard, loyaltyRestaurant, rewardLabel, sendRewardCode } from "@/lib/loyalty";

export const runtime = "nodejs";

const Body = z.object({
  slug: z.string().min(3).max(40),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().max(120),
  action: z.enum(["status", "code"]).default("status"),
});

/** Stand van de klantenkaart (alleen als telefoon én e-mail kloppen), of een code sturen om de beloning te gebruiken. */
export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ card: null });
  const b = p.data;
  const r = await loyaltyRestaurant(b.slug);
  if (!r) return NextResponse.json({ card: null });
  const card = await findCard(r.id, b.phone, b.email);
  const need = r.loyalty_stamps, reward = rewardLabel(r, r.itemName);
  const rewardOk = r.loyalty_reward !== "product" || r.itemAvailable;
  if (b.action === "code") {
    if (!card || card.stamps < need || !rewardOk) return NextResponse.json({ error: "Je beloning is nog niet beschikbaar." }, { status: 400 });
    const s = await sendRewardCode({ id: card.id, email: card.email, code_expires_at: card.code_expires_at }, r.name, reward);
    if (s === "fail") return NextResponse.json({ error: "De code kon niet verstuurd worden. Probeer later opnieuw." }, { status: 502 });
    return NextResponse.json({ sent: true, recent: s === "recent" });
  }
  return NextResponse.json({ card: card ? { stamps: Math.min(card.stamps, need), ready: card.stamps >= need && rewardOk } : null, need, reward });
}
