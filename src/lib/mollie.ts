// Mollie Connect: each restaurant links its own Mollie account (OAuth). Payments are created on the
// restaurant's account, so the money goes straight to the restaurant; BestelBon never holds funds.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { adminDb } from "./supabase";

const API = "https://api.mollie.com";
const SCOPES = "payments.read payments.write refunds.read refunds.write organizations.read profiles.read onboarding.read";

const env = (k: string) => (process.env[k] ?? "").trim();
export const mollieEnabled = () => !!(env("MOLLIE_CLIENT_ID") && env("MOLLIE_CLIENT_SECRET"));
/** Test mode: payments are created with testmode=true (no real money). Turn off for launch. */
export const testmode = () => ["true", "1", "ja", "yes"].includes(env("MOLLIE_TESTMODE").toLowerCase());
export const siteUrl = () => (env("NEXT_PUBLIC_SITE_URL") || "https://bestelbon.eu").replace(/\/$/, "");
export const redirectUri = () => `${siteUrl()}/api/mollie/callback`;

/* ---------- token encryption (AES-256-GCM, key derived from the client secret) ---------- */
const key = () => createHash("sha256").update(`bestelbon-mollie:${env("MOLLIE_CLIENT_SECRET")}`).digest();
function seal(v: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(v, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
function open(v: string) {
  const [iv, tag, enc] = v.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

/* ---------- OAuth ---------- */
export function authorizeUrl(state: string) {
  const q = new URLSearchParams({ client_id: env("MOLLIE_CLIENT_ID"), redirect_uri: redirectUri(), state, scope: SCOPES, response_type: "code", approval_prompt: "auto", locale: "nl_BE" });
  return `https://my.mollie.com/oauth2/authorize?${q}`;
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number };
async function tokenRequest(body: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${API}/oauth2/tokens`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${env("MOLLIE_CLIENT_ID")}:${env("MOLLIE_CLIENT_SECRET")}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mollie token ${res.status}`);
  return res.json();
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mollie ${path} ${res.status}: ${(data as { detail?: string }).detail ?? ""}`);
  return data as T;
}

type Org = { id: string; name: string };
type Profiles = { _embedded?: { profiles?: { id: string; status: string; mode: string }[] } };
type Onboarding = { status: string; canReceivePayments: boolean };

async function accountInfo(token: string) {
  const [org, profiles, ob] = await Promise.all([
    api<Org>(token, "/v2/organizations/me"),
    api<Profiles>(token, "/v2/profiles?limit=50"),
    api<Onboarding>(token, "/v2/onboarding/me").catch(() => null),
  ]);
  const list = profiles._embedded?.profiles ?? [];
  const profile = list.find((p) => p.status === "verified") ?? list[0];
  return { organization_id: org.id, organization_name: org.name, profile_id: profile?.id ?? null, can_receive: !!ob?.canReceivePayments, onboarding_status: ob?.status ?? null };
}

/** Code from the OAuth callback → store the (encrypted) tokens for this restaurant. */
export async function connect(restaurantId: string, code: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });
  const info = await accountInfo(t.access_token);
  await adminDb().from("payment_accounts").upsert({
    restaurant_id: restaurantId, provider: "mollie",
    access_token: seal(t.access_token), refresh_token: seal(t.refresh_token),
    expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(),
    ...info, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  return info;
}

/** Valid access token for the restaurant, refreshed when needed. */
async function tokenFor(restaurantId: string) {
  const db = adminDb();
  const { data: a } = await db.from("payment_accounts").select("access_token, refresh_token, expires_at").eq("restaurant_id", restaurantId).maybeSingle();
  if (!a) return null;
  if (new Date(a.expires_at).getTime() > Date.now()) return open(a.access_token);
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: open(a.refresh_token) });
  await db.from("payment_accounts").update({
    access_token: seal(t.access_token), refresh_token: seal(t.refresh_token),
    expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("restaurant_id", restaurantId);
  return t.access_token;
}

/** Re-read account status (e.g. after the restaurant finished Mollie's onboarding). */
export async function refreshAccount(restaurantId: string) {
  const token = await tokenFor(restaurantId);
  if (!token) return null;
  const info = await accountInfo(token);
  await adminDb().from("payment_accounts").update({ ...info, updated_at: new Date().toISOString() }).eq("restaurant_id", restaurantId);
  return info;
}

export async function disconnect(restaurantId: string) {
  const db = adminDb();
  const { data: a } = await db.from("payment_accounts").select("refresh_token").eq("restaurant_id", restaurantId).maybeSingle();
  if (a) {
    // Best effort: revoke at Mollie too.
    await fetch(`${API}/oauth2/tokens`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${Buffer.from(`${env("MOLLIE_CLIENT_ID")}:${env("MOLLIE_CLIENT_SECRET")}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token_type_hint: "refresh_token", token: open(a.refresh_token) }),
    }).catch(() => null);
  }
  await db.from("payment_accounts").delete().eq("restaurant_id", restaurantId);
  await db.from("restaurants").update({ online_payments: false }).eq("id", restaurantId);
}

/** Can customers of this restaurant pay online right now? */
export async function onlineReady(restaurantId: string) {
  if (!mollieEnabled()) return false;
  const db = adminDb();
  const [{ data: r }, { data: a }] = await Promise.all([
    db.from("restaurants").select("online_payments").eq("id", restaurantId).maybeSingle(),
    db.from("payment_accounts").select("profile_id, can_receive").eq("restaurant_id", restaurantId).maybeSingle(),
  ]);
  return !!(r?.online_payments && a?.profile_id && (a.can_receive || testmode()));
}

type Payment = { id: string; status: string; metadata?: { order_id?: string }; _links: { checkout?: { href: string } } };

export async function createPayment(restaurantId: string, p: { orderId: string; number: number; restaurantName: string; cents: number; redirectUrl: string }) {
  const token = await tokenFor(restaurantId);
  const { data: a } = await adminDb().from("payment_accounts").select("profile_id").eq("restaurant_id", restaurantId).maybeSingle();
  if (!token || !a?.profile_id) throw new Error("Mollie niet gekoppeld");
  const pay = await api<Payment>(token, "/v2/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: { currency: "EUR", value: (p.cents / 100).toFixed(2) },
      description: `${p.restaurantName} bestelling #${p.number}`.slice(0, 255),
      redirectUrl: p.redirectUrl,
      webhookUrl: `${siteUrl()}/api/mollie/webhook`,
      profileId: a.profile_id,
      locale: "nl_BE",
      metadata: { order_id: p.orderId },
      ...(testmode() ? { testmode: true } : {}),
    }),
  });
  return { id: pay.id, checkoutUrl: pay._links.checkout?.href ?? null };
}

export async function getPayment(restaurantId: string, paymentId: string) {
  const token = await tokenFor(restaurantId);
  if (!token) throw new Error("Mollie niet gekoppeld");
  return api<Payment>(token, `/v2/payments/${encodeURIComponent(paymentId)}${testmode() ? "?testmode=true" : ""}`);
}
