// Klantenkaart (Pro): digitale stempelkaart per zaak, herkend aan telefoonnummer + e-mail.
import { createHash, randomInt } from "crypto";
import { adminDb } from "./supabase";
import { sendMail } from "./mail";
import { eur } from "./money";

export type LoyaltyCfg = { loyalty_on?: boolean | null; loyalty_stamps?: number | null; loyalty_min_cents?: number | null; loyalty_reward?: string | null; loyalty_item_id?: string | null; loyalty_value?: number | null };

/** Telefoonnummer als sleutel: alleen cijfers, Belgisch 04.. wordt 324.. */
export function phoneKey(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "32" + d.slice(1);
  return d;
}
const sameMail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "gratis Friet groot", "€ 5,00 korting", "10% korting" */
export function rewardLabel(c: LoyaltyCfg, itemName?: string | null) {
  if (c.loyalty_reward === "bedrag") return `${eur(c.loyalty_value ?? 0)} korting`;
  if (c.loyalty_reward === "procent") return `${c.loyalty_value ?? 0}% korting`;
  return `gratis ${itemName ?? "gerecht"}`;
}

/** Korting in cent voor een subtotaal (product-beloning = 0: die komt als gratis lijn). */
export function rewardDiscount(c: LoyaltyCfg, subtotal: number) {
  if (c.loyalty_reward === "bedrag") return Math.min(subtotal, c.loyalty_value ?? 0);
  if (c.loyalty_reward === "procent") return Math.min(subtotal, Math.round((subtotal * Math.min(100, c.loyalty_value ?? 0)) / 100));
  return 0;
}

/** Actieve klantenkaart van een zaak (Pro + aangezet)? */
export async function loyaltyRestaurant(slug: string) {
  const db = adminDb();
  const { data: r } = await db.from("restaurants")
    .select("id, name, loyalty_on, loyalty_stamps, loyalty_min_cents, loyalty_reward, loyalty_item_id, loyalty_value, companies ( plan ), menu_items!restaurants_loyalty_item_id_fkey ( name, available )")
    .eq("slug", slug).maybeSingle();
  if (!r || !r.loyalty_on || (r.companies as unknown as { plan: string } | null)?.plan !== "pro") return null;
  const item = r.menu_items as unknown as { name: string; available: boolean } | null;
  if (r.loyalty_reward === "product" && !r.loyalty_item_id) return null;
  return { ...r, itemName: item?.name ?? null, itemAvailable: item?.available ?? false };
}

export async function findCard(restaurantId: string, phone: string, email: string) {
  const { data } = await adminDb().from("loyalty_cards").select("id, email, stamps, rewards, code_hash, code_expires_at, code_tries")
    .eq("restaurant_id", restaurantId).eq("phone_key", phoneKey(phone)).maybeSingle();
  return data && sameMail(data.email, email) ? data : null;
}

const hashCode = (cardId: string, code: string) => createHash("sha256").update(cardId + ":" + code + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")).digest("hex");

/** Stuurt een 4-cijferige code om de beloning te gebruiken. Max. één nieuwe code per minuut. */
export async function sendRewardCode(card: { id: string; email: string; code_expires_at: string | null }, shopName: string, reward: string) {
  if (card.code_expires_at && new Date(card.code_expires_at).getTime() - 14 * 60_000 > Date.now()) return "recent" as const;
  const code = String(randomInt(0, 10000)).padStart(4, "0");
  await adminDb().from("loyalty_cards").update({ code_hash: hashCode(card.id, code), code_expires_at: new Date(Date.now() + 15 * 60_000).toISOString(), code_tries: 0 }).eq("id", card.id);
  const ok = await sendMail({
    to: card.email, fromName: `${shopName} via BestelBon`, subject: `Je code voor je beloning: ${code}`,
    text: `Je klantenkaart bij ${shopName} is vol!\n\nJe code: ${code}\n\nVul deze code in bij je bestelling om je beloning (${reward}) te gebruiken. De code is 15 minuten geldig.\n\nHeb je dit niet gevraagd? Dan mag je deze mail negeren.`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#141a3a;max-width:480px;margin:0 auto;padding:20px"><p style="font-size:17px;font-weight:bold;margin:0 0 8px">Je klantenkaart bij ${shopName.replace(/</g, "&lt;")} is vol! 🎁</p><p style="font-size:15px;margin:0 0 16px">Vul deze code in bij je bestelling om je beloning (<b>${reward}</b>) te gebruiken:</p><p style="font-size:36px;font-weight:bold;letter-spacing:8px;background:#fff4ec;border-radius:10px;padding:14px;text-align:center;margin:0 0 16px">${code}</p><p style="font-size:13px;color:#596088;margin:0">De code is 15 minuten geldig. Heb je dit niet gevraagd? Dan mag je deze mail negeren.</p></div>`,
  });
  return ok ? ("sent" as const) : ("fail" as const);
}

export async function checkRewardCode(card: { id: string; code_hash: string | null; code_expires_at: string | null; code_tries: number }, code: string) {
  if (!card.code_hash || !card.code_expires_at || new Date(card.code_expires_at).getTime() < Date.now() || card.code_tries >= 5) return false;
  if (hashCode(card.id, code.trim()) === card.code_hash) return true;
  await adminDb().from("loyalty_cards").update({ code_tries: card.code_tries + 1 }).eq("id", card.id);
  return false;
}

/** Stempel bij een bestelling die echt doorgaat (bonnen in de wachtrij). Eenmalig per bestelling. */
export async function awardStamp(orderId: string) {
  const db = adminDb();
  const { data: o } = await db.from("orders").select("loyalty_card_id, loyalty_stamped, loyalty_redeemed, subtotal_cents, restaurants ( loyalty_stamps, loyalty_min_cents, loyalty_reward, loyalty_value, menu_items!restaurants_loyalty_item_id_fkey ( name ) )").eq("id", orderId).maybeSingle();
  if (!o?.loyalty_card_id || o.loyalty_stamped) return;
  const cfg = o.restaurants as unknown as LoyaltyCfg & { loyalty_stamps: number; loyalty_min_cents: number; menu_items: { name: string } | null };
  const earns = o.subtotal_cents >= cfg.loyalty_min_cents;
  const { data: claimed } = await db.from("orders").update({ loyalty_stamped: true }).eq("id", orderId).eq("loyalty_stamped", false).select("id");
  if (!claimed?.length) return;
  const { data } = await db.rpc("loyalty_add", { p_card: o.loyalty_card_id, p_stamps: earns ? 1 : 0, p_rewards: 0, p_orders: 1 });
  const stamps = (data as { stamps: number }[] | null)?.[0]?.stamps ?? 0;
  const need = cfg.loyalty_stamps;
  const note = [
    o.loyalty_redeemed ? "BELONING KLANTENKAART GEBRUIKT" : "",
    stamps >= need
      ? `Klantenkaart ${need}/${need} - vol! ${rewardLabel(cfg, cfg.menu_items?.name)} bij volgende bestelling`
      : `Klantenkaart ${stamps}/${need} - nog ${need - stamps} tot ${rewardLabel(cfg, cfg.menu_items?.name)}${earns ? "" : " (geen stempel: onder minimum)"}`,
  ].filter(Boolean).join(" · ");
  await db.from("orders").update({ loyalty_note: note }).eq("id", orderId);
}

/** Online betaling mislukt: gebruikte beloning teruggeven. */
export async function undoRedeem(orderId: string) {
  const db = adminDb();
  const { data: o } = await db.from("orders").select("loyalty_card_id, loyalty_redeemed, restaurants ( loyalty_stamps )").eq("id", orderId).maybeSingle();
  if (!o?.loyalty_card_id || !o.loyalty_redeemed) return;
  const { data: claimed } = await db.from("orders").update({ loyalty_redeemed: false }).eq("id", orderId).eq("loyalty_redeemed", true).select("id");
  if (!claimed?.length) return;
  const need = (o.restaurants as unknown as { loyalty_stamps: number }).loyalty_stamps;
  await db.rpc("loyalty_add", { p_card: o.loyalty_card_id, p_stamps: need, p_rewards: -1, p_orders: 0 });
}
