/** Normalises a VAT number. Belgian numbers are checked with the mod-97 rule. */
export function normVat(input: string): { ok: boolean; display: string; compact: string; digits: string } {
  const raw = input.toUpperCase().replace(/[\s.\-]/g, "");
  const cc = /^[A-Z]{2}/.test(raw) ? raw.slice(0, 2) : "BE";
  if (cc !== "BE") return { ok: raw.length > 4, display: raw, compact: raw, digits: raw.slice(2) };
  let d = raw.replace(/\D/g, "");
  if (d.length === 9) d = "0" + d;
  const ok = d.length === 10 && /^[01]/.test(d) && 97 - (Number(d.slice(0, 8)) % 97) === Number(d.slice(8));
  return { ok, display: `BE ${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}`, compact: "BE" + d, digits: d };
}
