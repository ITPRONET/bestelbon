import { adminDb } from "./supabase";
import { sendMail } from "./mail";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const euro = (c: number) => "€ " + (c / 100).toFixed(2).replace(".", ",");

/** "Je bestelling is ontvangen door de zaak": sent once, when the first ticket comes out of the printer. */
export async function sendOrderReceived(orderId: string) {
  const db = adminDb();
  const { data: o } = await db.from("orders")
    .select("id, day_number, mode, requested_time, payment_method, payment_status, subtotal_cents, delivery_fee_cents, total_cents, customer_name, customer_email, address, postcode, city, note, restaurants ( name, slug, phone, street, postcode, city, custom_domain, domain_verified ), order_lines ( item_name, options, qty, unit_cents, id )")
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

  const text = [
    `Hallo ${first},`, "",
    `${r.name} heeft je bestelling #${o.day_number} ontvangen en gaat ermee aan de slag.`,
    `${what}.`, "",
    ...lines.map((l) => `${l.qty} x ${l.item_name}${l.options.length ? ` (${l.options.join(", ")})` : ""}  ${euro(l.qty * l.unit_cents)}`),
    ...(o.delivery_fee_cents ? [`Leverkost  ${euro(o.delivery_fee_cents)}`] : []),
    `Totaal  ${euro(o.total_cents)}`, pay, "",
    ...(o.mode === "levering" ? [`Leveradres: ${o.address}, ${o.postcode} ${o.city}`] : shopAddr ? [`Afhalen bij: ${shopAddr}`] : []),
    ...(o.note ? [`Opmerking: ${o.note}`] : []), "",
    `Volg je bestelling: ${statusUrl}`,
    r.phone ? `Vragen over je bestelling? Bel ${r.name}: ${r.phone}` : "",
    "", "Smakelijk!", `${r.name}`, "", "Verstuurd via BestelBon. Je gegevens worden 30 dagen na de bestelling gewist.",
  ].join("\n");

  const rows = lines.map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee"><b>${l.qty} x ${esc(l.item_name)}</b>${l.options.length ? `<br><span style="color:#596088;font-size:13px">${esc(l.options.join(", "))}</span>` : ""}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${euro(l.qty * l.unit_cents)}</td></tr>`).join("");
  const html = `<!doctype html><html lang="nl"><body style="margin:0;background:#f4f5fb;font-family:Arial,Helvetica,sans-serif;color:#141a3a">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#0b1033;color:#fff;border-radius:14px 14px 0 0;padding:18px 22px">
    <div style="font-size:13px;opacity:.75">Bestelling #${o.day_number}</div>
    <div style="font-size:22px;font-weight:bold;margin-top:2px">${esc(r.name)}</div>
  </div>
  <div style="background:#fff;border-radius:0 0 14px 14px;padding:22px">
    <p style="margin:0 0 6px;font-size:18px;font-weight:bold">Je bestelling is ontvangen ✓</p>
    <p style="margin:0 0 16px">Hallo ${esc(first)}, ${esc(r.name)} heeft je bestelling ontvangen en gaat ermee aan de slag. <b>${esc(what)}.</b></p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">${rows}
      ${o.delivery_fee_cents ? `<tr><td style="padding:6px 0;color:#596088">Leverkost</td><td style="padding:6px 0;text-align:right">${euro(o.delivery_fee_cents)}</td></tr>` : ""}
      <tr><td style="padding:10px 0 0;font-weight:bold;font-size:17px">Totaal</td><td style="padding:10px 0 0;text-align:right;font-weight:bold;font-size:17px">${euro(o.total_cents)}</td></tr>
    </table>
    <p style="margin:12px 0 0;background:#fff4ec;border-radius:8px;padding:10px 12px;font-weight:bold">${esc(pay)}</p>
    <p style="margin:16px 0 0;font-size:14px;color:#596088">${o.mode === "levering" ? `Leveradres: ${esc(`${o.address}, ${o.postcode} ${o.city}`)}` : shopAddr ? `Afhalen bij: ${esc(shopAddr)}` : ""}${o.note ? `<br>Opmerking: ${esc(o.note)}` : ""}</p>
    <p style="margin:20px 0 0"><a href="${statusUrl}" style="display:inline-block;background:#ff6a00;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">Volg je bestelling</a></p>
    ${r.phone ? `<p style="margin:16px 0 0;font-size:14px">Vragen? Bel ${esc(r.name)}: <a href="tel:${esc(r.phone)}" style="color:#141a3a">${esc(r.phone)}</a></p>` : ""}
  </div>
  <p style="text-align:center;color:#596088;font-size:12px;margin:14px 0 0">Verstuurd via <b>BestelBon</b> · je gegevens worden 30 dagen na de bestelling gewist</p>
</div></body></html>`;

  return sendMail({ to: o.customer_email, subject: `${r.name}: bestelling #${o.day_number} ontvangen`, text, html, fromName: `${r.name} via BestelBon` });
}
