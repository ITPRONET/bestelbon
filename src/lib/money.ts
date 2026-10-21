const fmt = new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" });
export const eur = (cents: number) => fmt.format(cents / 100);
