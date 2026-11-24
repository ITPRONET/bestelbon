// Creating a customer (company + zaak + installation + login for the owner).
// Used by the admin page "Nieuwe klant" and automatically right after a signup on /aanmelden,
// so the owner can fill in the menu while we prepare the printer.
import { adminDb } from "./supabase";
import { RESERVED_SLUGS } from "./reserved";
import { addSubdomain } from "./vercel";
import { adminFeeLines } from "./pricing";

type Db = ReturnType<typeof adminDb>;

export const slugify = (v: string) => v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 40);

/** A free address for a new zaak: frituurdekroon, frituurdekroon2, ... */
export async function freeSlug(db: Db, wanted: string) {
  const base = slugify(wanted).slice(0, 36) || "zaak";
  for (let i = 1; i < 50; i++) {
    const s = i === 1 ? base : `${base}${i}`;
    if (s.length < 3 || RESERVED_SLUGS.has(s)) continue;
    const { data } = await db.from("restaurants").select("id").eq("slug", s).maybeSingle();
    if (!data) return s;
  }
  return `${base}${Date.now().toString(36)}`;
}

export type NewCustomer = {
  legal_name: string; vat: string; street: string | null; postcode: string | null; city: string | null;
  contact_name: string | null; email: string; phone: string | null; owner_email: string;
  plan: "standaard" | "pro"; billing: "maand" | "jaar"; started_on?: string;
  zaak: string; slug: string; type: string;
  cable: number; pl: number; adapters: number; install_mode: "zelf" | "ter_plaatse"; printer_setup?: unknown;
  planned_on?: string | null; notes?: string | null;
  terms?: { version: string; at: string };
  signup_id?: string;
};

export async function createCustomer(db: Db, c: NewCustomer) {
  const { data: co, error: e1 } = await db.from("companies").insert({
    legal_name: c.legal_name, vat_number: c.vat, street: c.street, postcode: c.postcode, city: c.city, contact_name: c.contact_name,
    email: c.email, phone: c.phone, plan: c.plan, billing: c.billing, status: "installatie", started_on: c.started_on || undefined,
    ...(c.terms ? { terms_version: c.terms.version, terms_accepted_at: c.terms.at } : {}),
  }).select("id").single();
  if (e1 || !co) return { ok: false as const, error: "opslaan" };
  const { data: r, error: e2 } = await db.from("restaurants").insert({
    company_id: co.id, name: c.zaak, slug: c.slug, type: c.type, street: c.street, postcode: c.postcode, city: c.city, phone: c.phone,
  }).select("id").single();
  if (e2 || !r) { await db.from("companies").delete().eq("id", co.id); return { ok: false as const, error: "opslaan" }; }

  // frituurdekroon.bestelbon.eu (only with VERCEL_TOKEN + SUBDOMAIN_ROOT); until then bestelbon.eu/frituurdekroon keeps working.
  const sub = await addSubdomain(c.slug).catch(() => ({ ok: false }));
  if (sub.ok) await db.from("restaurants").update({ sub_ok: true }).eq("id", r.id);

  // Login for the owner: invitation e-mail to choose a password, or link an existing account.
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  let uid: string | undefined;
  const inv = await db.auth.admin.inviteUserByEmail(c.owner_email, { redirectTo: `${site}/auth/bevestig` });
  uid = inv.data.user?.id;
  if (!uid) {
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    uid = list?.users.find((u) => u.email?.toLowerCase() === c.owner_email)?.id;
  }
  if (uid) await db.from("restaurant_members").insert({ restaurant_id: r.id, user_id: uid, role: "eigenaar" });

  await db.from("installations").insert({
    company_id: co.id, restaurant_id: r.id, printers_cable: c.cable, printers_wifi: 0, powerline_adapters: c.adapters, install_mode: c.install_mode,
    printer_setup: c.printer_setup ?? null, planned_on: c.planned_on || null, status: c.planned_on ? "gepland" : "te_plannen", notes: c.notes || null,
  });
  if (c.signup_id) await db.from("signups").update({ status: "klant", company_id: co.id }).eq("id", c.signup_id);
  return { ok: true as const, companyId: co.id as string, restaurantId: r.id as string, account: uid ? (inv.data.user ? "uitgenodigd" : "gekoppeld") : "geenaccount" };
}

/** Start-up invoice: printers, powerline adapters, installation on site and (optionally) the administration fee. */
export async function startInvoice(db: Db, companyId: string, zaak: string, o: { printers: number; adapters: number; onSite: boolean; adminFee: boolean }) {
  const { data: prices } = await db.from("prices").select("key, label, cents");
  const p = (k: string) => prices?.find((x) => x.key === k);
  const lines = [
    o.printers && p("printer_kabel") && { description: p("printer_kabel")!.label, qty: o.printers, unit_cents: p("printer_kabel")!.cents },
    o.adapters && p("powerline") && { description: p("powerline")!.label, qty: o.adapters, unit_cents: p("powerline")!.cents },
    o.onSite && p("installatie") && { description: p("installatie")!.label, qty: 1, unit_cents: p("installatie")!.cents },
    ...(o.adminFee && p("administratie") ? adminFeeLines(p("administratie")!.label, p("administratie")!.cents) : []),
  ].filter(Boolean);
  if (!lines.length) return false;
  const { error } = await db.rpc("create_invoice", { p_company: companyId, p_lines: lines, p_note: `Opstart BestelBon voor ${zaak}` });
  return !error;
}
