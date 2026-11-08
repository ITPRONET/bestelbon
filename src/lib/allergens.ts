// De 14 allergenen die de EU (Verordening 1169/2011) verplicht vermeldt, ook bij online verkoop.
export const ALLERGENS = [
  { key: "gluten", label: "Gluten" },
  { key: "schaaldieren", label: "Schaaldieren" },
  { key: "eieren", label: "Eieren" },
  { key: "vis", label: "Vis" },
  { key: "pindas", label: "Pinda's" },
  { key: "soja", label: "Soja" },
  { key: "melk", label: "Melk" },
  { key: "noten", label: "Noten" },
  { key: "selder", label: "Selder" },
  { key: "mosterd", label: "Mosterd" },
  { key: "sesam", label: "Sesamzaad" },
  { key: "sulfieten", label: "Sulfieten" },
  { key: "lupine", label: "Lupine" },
  { key: "weekdieren", label: "Weekdieren" },
] as const;
export type AllergenKey = (typeof ALLERGENS)[number]["key"];
const KEYS = new Set<string>(ALLERGENS.map((a) => a.key));
export const allergenLabel = (k: string) => ALLERGENS.find((a) => a.key === k)?.label ?? k;

/** From the menu form: checked allergens, or [] when "bevat geen" is ticked, or null when nothing was filled in. */
export function allergensFromForm(f: FormData): string[] | null {
  const picked = f.getAll("allergen").map(String).filter((k) => KEYS.has(k));
  if (picked.length) return ALLERGENS.map((a) => a.key).filter((k) => picked.includes(k));
  return f.get("allergen_none") === "on" ? [] : null;
}
