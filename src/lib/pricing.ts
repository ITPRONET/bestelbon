import { today } from "./panel";

/** Promotion: administrative start-up costs are waived for contracts signed up to and including this date. */
export const ADMIN_FREE_UNTIL = "2026-12-31";
export const ADMIN_FREE_LABEL = "31 december 2026";
export const YEAR_DISCOUNT = 0.1;

export const adminFeeWaived = (on = today()) => on <= ADMIN_FREE_UNTIL;

/** Invoice lines for the administrative costs; the waiver is shown as its own line so the invoice stays transparent. */
export function adminFeeLines(label: string, cents: number, on = today()) {
  const lines = [{ description: label, qty: 1, unit_cents: cents }];
  if (adminFeeWaived(on)) lines.push({ description: `Promotie: administratieve kosten gratis bij ondertekening tot ${ADMIN_FREE_LABEL}`, qty: -1, unit_cents: cents });
  return lines;
}

/** One year of subscription paid in advance, with the yearly discount as a separate line (net prices stay positive for Peppol). */
export function yearLines(planName: string, monthCents: number, fromLabel: string, toLabel: string) {
  return [
    { description: `Abonnement BestelBon ${planName} – 12 maanden (${fromLabel} t/m ${toLabel})`, qty: 12, unit_cents: monthCents },
    { description: "Korting jaarlijkse betaling vooraf (10%)", qty: -1, unit_cents: Math.round(monthCents * 12 * YEAR_DISCOUNT) },
  ];
}
