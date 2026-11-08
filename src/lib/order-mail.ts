import { adminDb } from "./supabase";
import { sendMail } from "./mail";
import { rewardLabel } from "./loyalty";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const euro = (c: number) => "€ " + (c / 100).toFixed(2).replace(".", ",");

/** "Je bestelling is ontvangen door de zaak": sent once, when the first ticket comes out of the printer. */
export async function sendOrderReceived(orderId: string) {
  const db = adminDb();
  const { data: o } = await db.from("orders")
    .select("id, day_number, mode, requested_time, payment_method, payment_status, subtotal_cents, delivery_fee_cents, total_cents, discount_cents, loyalty_stamped, loyalty_redeemed, customer_name, customer_email, address, postcode, city, note, loyalty_cards ( stamps ), restaurants ( name, slug, phone, loyalty_stamps, loyalty_reward, loyalty_value, loyalty_item:menu_items!restaurants_loyalty_item_id_fkey ( name ), street, postcode, city, custom_domain, domain_verified ), order_lines ( item_name, options, qty, unit_cents, id )")
    .eq("id", orderId).maybeSingle();
  if (!o?.customer_email) return false;
  const r = o.restaurants as unknown as { name: string; slug: string; phone: string | null; street: string | null; postcode: string | null; city: string | null; custom_domain: string | null; domain_verified: boolean };
  const lines = ((o.order_lines ?? []) as { item_name: string; options: string[]; qty: number; unit_cents: number; id: number }[]).sort((a, b) => a.id - b.id);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bestelbon.eu";
  const statusUrl = r.custom_domain && r.domain_verified ? `https://${r.custom_domain}/${r.slug}/bestelling/${o.id}` : `${site}/${r.slug}/bestelling/${o.id}`;
  const when = o.requested_time && o.requested_time !== "Zo snel mogelijk" ? `om ${o.requested_time}` : "zo snel mogelijk";
  const what = o.mode === "levering" ? `We leveren ${when}` : `Je kunt je bestelling ${when} afhalen`;
  const pay = o.payment_method === "online" && o.payment_status === "betaald" ? "Betaald online." : `Te betalen bij ${o.mode === "levering" ? "levering" : "afhaling"}: ${euro(o.total_cents)}.`;
  const shopAddr = [r.street, `${r.postcode ?? ""} ${r.city ?? ""}`.trim()].filter(Boolean).join(", ");
  const first = (o.customer_name ?? "").split(" ")[0];
  // Klantenkaart: stand na deze bestelling.
  const lc = o.loyalty_cards as unknown as { stamps: number } | null;
  const lcfg = o.restaurants as unknown as { loyalty_stamps: number; loyalty_reward: string; loyalty_value: number; loyalty_item: { name: string } | null };
  let card = "", cardDots = "";
  if (lc && o.loyalty_stamped) {
    const need = lcfg.loyalty_stamps, have = Math.min(lc.stamps, need), reward = rewardLabel(lcfg, lcfg.loyalty_item?.name);
    card = have >= need ? `Je klantenkaart is vol! Bij je volgende bestelling krijg je ${reward}.` : `Je klantenkaart: ${have}/${need} stempels. Nog ${need - have} bestelling${need - have === 1 ? "" : "en"} tot ${reward}.`;
    cardDots = Array.from({ length: need }, (_, i) => `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;margin:0 3px 4px 0;background:${i < have ? "#ff6a00" : "#ffffff"};border:2px solid #ff6a00"></span>`).join("");
  }

  const text = [
    `Hallo ${first},`, "",
    `${r.name} heeft je bestelling #${o.day_number} ontvangen en gaat ermee aan de slag.`,
    `${what}.`, "",
    ...lines.map((l) => `${l.qty} x ${l.item_name}${l.options.length ? ` (${l.options.join(", ")})` : ""}  ${euro(l.qty * l.unit_cents)}`),
    ...(o.delivery_fee_cents ? [`Leverkost  ${euro(o.delivery_fee_cents)}`] : []),
    ...(o.discount_cents ? [`Korting klantenkaart  -${euro(o.discount_cents)}`] : []),
    `Totaal  ${euro(o.total_cents)}`, pay, "", ...(card ? [card, ""] : []),
    ...(o.mode === "levering" ? [`Leveradres: ${o.address}, ${o.postcode} ${o.city}`] : shopAddr ? [`Afhalen bij: ${shopAddr}`] : []),
    ...(o.note ? [`Opmerking: ${o.note}`] : []), "",
    `Volg je bestelling: ${statusUrl}`,
    r.phone ? `Vragen over je bestelling? Bel ${r.name}: ${r.phone}` : "",
    "", "Smakelijk!", `${r.name}`, "", "Verstuurd via BestelBon (https://bestelbon.eu). Je gegevens worden 30 dagen na de bestelling gewist.",
  ].join("\n");

  const F = "font-family:Arial,Helvetica,sans-serif";
  const rows = lines.map((l) => `<tr><td style="${F};padding:8px 0;border-bottom:1px solid #e6e8f2;font-size:15px;color:#141a3a"><b>${l.qty} x ${esc(l.item_name)}</b>${l.options.length ? `<br><span style="color:#596088;font-size:13px">${esc(l.options.join(", "))}</span>` : ""}</td><td width="90" align="right" valign="top" style="${F};padding:8px 0 8px 12px;border-bottom:1px solid #e6e8f2;font-size:15px;color:#141a3a;white-space:nowrap">${euro(l.qty * l.unit_cents).replace(" ", "&nbsp;")}</td></tr>`).join("");
  const nb = (c: number) => euro(c).replace(" ", "&nbsp;");
  const where = o.mode === "levering" ? `Leveradres: ${esc(`${o.address}, ${o.postcode} ${o.city}`)}` : shopAddr ? `Afhalen bij: ${esc(shopAddr)}` : "";
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bestelling #${o.day_number}</title></head>
<body style="margin:0;padding:0;background:#f4f5fb">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5fb" style="background:#f4f5fb"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px">
  <tr><td bgcolor="#0b1033" style="background:#0b1033;border-radius:14px 14px 0 0;padding:18px 24px;${F};color:#ffffff">
    <div style="font-size:13px;color:#c4c8e6">Bestelling #${o.day_number}</div>
    <div style="font-size:22px;font-weight:bold;color:#ffffff;margin-top:2px">${esc(r.name)}</div>
  </td></tr>
  <tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:0 0 14px 14px;padding:24px;${F};color:#141a3a">
    <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#141a3a">Je bestelling is ontvangen &#10003;</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:22px;color:#141a3a">Hallo ${esc(first)}, ${esc(r.name)} heeft je bestelling ontvangen en gaat ermee aan de slag. <b>${esc(what)}.</b></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
      ${o.delivery_fee_cents ? `<tr><td style="${F};padding:8px 0;font-size:15px;color:#596088">Leverkost</td><td align="right" style="${F};padding:8px 0;font-size:15px;color:#141a3a;white-space:nowrap">${nb(o.delivery_fee_cents)}</td></tr>` : ""}
      ${o.discount_cents ? `<tr><td style="${F};padding:8px 0;font-size:15px;color:#596088">Korting klantenkaart</td><td align="right" style="${F};padding:8px 0;font-size:15px;color:#141a3a;white-space:nowrap">-${nb(o.discount_cents)}</td></tr>` : ""}
      <tr><td style="${F};padding:12px 0 0;font-weight:bold;font-size:17px;color:#141a3a">Totaal</td><td align="right" style="${F};padding:12px 0 0;font-weight:bold;font-size:17px;color:#141a3a;white-space:nowrap">${nb(o.total_cents)}</td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px"><tr><td bgcolor="#fff4ec" style="background:#fff4ec;border-radius:8px;padding:10px 12px;${F};font-size:15px;font-weight:bold;color:#141a3a">${esc(pay)}</td></tr></table>
    ${card ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px"><tr><td style="border:1px solid #ffd9bd;border-radius:10px;padding:12px 14px;${F}"><div style="font-size:13px;font-weight:bold;color:#596088;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Klantenkaart</div><div>${cardDots}</div><div style="font-size:15px;color:#141a3a;margin-top:4px">${esc(card)}</div></td></tr></table>` : ""}
    ${where || o.note ? `<p style="margin:16px 0 0;font-size:14px;line-height:20px;color:#596088">${where}${o.note ? `${where ? "<br>" : ""}Opmerking: ${esc(o.note)}` : ""}</p>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px"><tr><td bgcolor="#ff6a00" style="background:#ff6a00;border-radius:999px;padding:12px 22px">
      <a href="${statusUrl}" style="${F};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block"><span style="color:#ffffff">Volg je bestelling</span></a>
    </td></tr></table>
    ${r.phone ? `<p style="margin:18px 0 0;font-size:14px;color:#141a3a">Vragen? Bel ${esc(r.name)}: <a href="tel:${esc(r.phone)}" style="color:#141a3a;font-weight:bold">${esc(r.phone)}</a></p>` : ""}
  </td></tr>
  <tr><td align="center" style="padding:14px 0 0;${F};font-size:12px;color:#596088">Verstuurd via <a href="https://bestelbon.eu" style="color:#596088;font-weight:bold;text-decoration:underline">BestelBon</a> &middot; je gegevens worden 30 dagen na de bestelling gewist</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return sendMail({ to: o.customer_email, subject: `${r.name}: bestelling #${o.day_number} ontvangen`, text, html, fromName: `${r.name} via BestelBon` });
}
