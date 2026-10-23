// Custom domains for Pro restaurants, through the Vercel API.
// Needs VERCEL_TOKEN (Vercel > Account Settings > Tokens, scope: the BestelBon team), VERCEL_PROJECT_ID and VERCEL_TEAM_ID.
const API = "https://api.vercel.com";
const q = () => `teamId=${process.env.VERCEL_TEAM_ID ?? ""}`;
const pid = () => process.env.VERCEL_PROJECT_ID ?? "";
const auth = () => ({ Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" });

export const domainsEnabled = () => !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TEAM_ID);

export const isApex = (d: string) => d.split(".").length === 2 || /\.(co|com|org|net)\.[a-z]{2}$/.test(d) && d.split(".").length === 3;

export function cleanDomain(v: string) {
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d) && !d.endsWith("bestelbon.eu") && !d.endsWith("vercel.app") ? d : null;
}

export async function addDomain(name: string) {
  if (!domainsEnabled()) return { ok: false, error: "geen-token" };
  const r = await fetch(`${API}/v10/projects/${pid()}/domains?${q()}`, { method: "POST", headers: auth(), body: JSON.stringify({ name }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok || j?.error?.code === "domain_already_in_use_by_project" || j?.error?.code === "domain_already_exists") return { ok: true };
  return { ok: false, error: j?.error?.message ?? `HTTP ${r.status}` };
}

export async function removeDomain(name: string) {
  if (!domainsEnabled()) return;
  await fetch(`${API}/v9/projects/${pid()}/domains/${name}?${q()}`, { method: "DELETE", headers: auth() }).catch(() => null);
}

/** ok = DNS points to Vercel and the domain is verified; Vercel then issues the SSL certificate itself. */
export async function domainStatus(name: string) {
  if (!domainsEnabled()) return { ok: false, verified: false, misconfigured: true, txt: null as null | { domain: string; value: string } };
  const [p, c] = await Promise.all([
    fetch(`${API}/v9/projects/${pid()}/domains/${name}?${q()}`, { headers: auth(), cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    fetch(`${API}/v6/domains/${name}/config?${q()}`, { headers: auth(), cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
  ]);
  const v = (p?.verification ?? [])[0];
  const verified = p?.verified === true;
  const misconfigured = c?.misconfigured !== false;
  return { ok: verified && !misconfigured, verified, misconfigured, txt: v ? { domain: v.domain as string, value: v.value as string } : null };
}
