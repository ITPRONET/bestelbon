// Plain-text 80 mm tickets (48 characters per line) for CloudPRNT "text/plain".
const W = 48;

export type TicketOrder = {
  day_number: number; created_at: string; mode: "levering" | "afhalen"; requested_time: string | null;
  payment_method: "online" | "cash"; payment_status: string; total_cents: number; delivery_fee_cents: number;
  customer_name: string | null; customer_phone: string | null; address: string | null; postcode: string | null; city: string | null;
  note: string | null; late: boolean;
};
export type TicketLine = { item_name: string; options: string[]; qty: number; unit_cents: number };

const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "");
const center = (s: string) => { s = ascii(s).slice(0, W); const p = Math.floor((W - s.length) / 2); return " ".repeat(p) + s; };
const lr = (l: string, r: string) => { l = ascii(l); r = ascii(r); const room = W - r.length - 1; return (l.length > room ? l.slice(0, room) : l.padEnd(room)) + " " + r; };
const hr = (c = "-") => c.repeat(W);
const bar = (s: string) => { s = ascii(s); const p = Math.max(0, Math.floor((W - s.length - 2) / 2)); return "#".repeat(p) + " " + s + " " + "#".repeat(Math.max(0, W - p - s.length - 2)); };
const wrap = (s: string, indent = "") => {
  const out: string[] = []; let line = indent;
  for (const word of ascii(s).split(/\s+/)) {
    if ((line + word).length > W) { out.push(line.trimEnd()); line = indent; }
    line += word + " ";
  }
  if (line.trim()) out.push(line.trimEnd());
  return out;
};
const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const time = (iso: string, tz = "Europe/Brussels") => new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: tz });
const payLine = (o: TicketOrder) => o.payment_method === "online" && o.payment_status === "betaald" ? "BETAALD ONLINE" : `TE BETALEN: EUR ${money(o.total_cents)}`;

export function kitchenTicket(name: string, o: TicketOrder, lines: TicketLine[]) {
  const out = [bar("KEUKEN"), center(name), "", center(`#${o.day_number}`), center(`${o.mode === "levering" ? "LEVERING" : "AFHALEN"} - ${o.requested_time ?? "Zo snel mogelijk"}`), center(`besteld ${time(o.created_at)}`)];
  if (o.late) out.push(bar("NAGEPRINT - VERTRAAGD"));
  out.push(hr());
  for (const l of lines) {
    out.push(...wrap(`${l.qty} x ${l.item_name}`));
    for (const opt of l.options) out.push(...wrap(`> ${opt}`, "    "));
  }
  if (o.note) { out.push(hr()); out.push(...wrap(`OPMERKING: ${o.note}`)); }
  out.push(hr(), center(o.customer_name ?? ""), bar(payLine(o)), "", center("BestelBon - bestelbon.eu"), "", "");
  return out.join("\n");
}

export function deliveryTicket(name: string, o: TicketOrder, lines: TicketLine[]) {
  const out = [bar("BEZORGING"), center(`${name} - #${o.day_number}`), center(o.requested_time ?? "Zo snel mogelijk")];
  if (o.late) out.push(bar("NAGEPRINT - VERTRAAGD"));
  out.push(hr(), ascii(o.customer_name ?? ""), ...wrap(o.address ?? ""), ascii(`${o.postcode ?? ""} ${o.city ?? ""}`.trim()), ascii(`Tel: ${o.customer_phone ?? ""}`));
  if (o.note) out.push(...wrap(`Opm: ${o.note}`));
  out.push(hr());
  for (const l of lines) out.push(lr(`${l.qty}x ${l.item_name}`, money(l.qty * l.unit_cents)));
  if (o.delivery_fee_cents) out.push(lr("Leverkost", money(o.delivery_fee_cents)));
  out.push(hr(), lr("TOTAAL", `EUR ${money(o.total_cents)}`), bar(payLine(o)), "", center("BestelBon - bestelbon.eu"), "", "");
  return out.join("\n");
}
