// Address of a restaurant's ordering page.
// SUBDOMAIN_ROOT (e.g. "bestelbon.eu") turns on addresses like frituurdekroon.bestelbon.eu.
// Without it the old form bestelbon.eu/frituurdekroon is used. A verified own domain (Pro) always wins.
export const subRoot = () => (process.env.SUBDOMAIN_ROOT ?? "").trim().toLowerCase();

export function shopUrl(slug: string, own?: { custom_domain?: string | null; domain_verified?: boolean | null; sub_ok?: boolean | null } | null) {
  if (own?.custom_domain && own.domain_verified) return `https://${own.custom_domain}`;
  const root = subRoot();
  if (root && own?.sub_ok) return `https://${slug}.${root}`;
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${slug}`;
}

/** Status page of an order, on the same address as the ordering page. */
export const orderUrl = (slug: string, id: string, own?: Parameters<typeof shopUrl>[1]) => {
  const base = shopUrl(slug, own);
  return base.endsWith(`/${slug}`) ? `${base}/bestelling/${id}` : `${base}/${slug}/bestelling/${id}`;
};
