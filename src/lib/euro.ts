/** "4,20" / "4.20" / "4" → 420 cents. Returns null when invalid. */
export function toCents(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/\s|€/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}
export const fromCents = (c: number) => (c / 100).toFixed(2).replace(".", ",");
