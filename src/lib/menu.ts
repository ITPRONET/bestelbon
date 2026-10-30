import { publicDb } from "./supabase";
import type { Menu, Category, Trader } from "./types";

const SELECT = `id, name, position,
  menu_items ( id, name, description, price_cents, available, image_path, position,
    option_groups ( id, name, multi, required, position, option_choices ( id, name, extra_cents, position ) ) )`;

export async function loadMenu(slug: string): Promise<Menu | null> {
  const db = publicDb();
  const { data: restaurant } = await db.from("restaurants")
    .select("id, slug, name, type, city, street, postcode, brand_primary, brand_accent, logo_path, delivery_fee_cents, min_order_cents, prep_minutes, is_open, paused_reason, company_id")
    .eq("slug", slug).maybeSingle();
  if (!restaurant) return null;
  const [{ data: cats }, { data: hours }, { data: zones }] = await Promise.all([
    db.from("menu_categories").select(SELECT).eq("restaurant_id", restaurant.id),
    db.from("opening_hours").select("weekday, opens, closes").eq("restaurant_id", restaurant.id),
    db.from("delivery_zones").select("postcode, fee_cents, min_order_cents").eq("restaurant_id", restaurant.id).order("postcode"),
  ]);
  const categories = ((cats ?? []) as unknown as Category[])
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      ...c,
      menu_items: c.menu_items.sort((a, b) => a.position - b.position).map((i) => ({
        ...i,
        option_groups: i.option_groups.sort((a, b) => a.position - b.position).map((g) => ({
          ...g, option_choices: g.option_choices.sort((a, b) => a.position - b.position),
        })),
      })),
    }));
  // Plan is not public data; the storefront only needs to know whether branding is allowed.
  const { plan, trader } = await companyOf(restaurant.company_id);
  return { restaurant, categories, plan, trader, hours: hours ?? [], zones: zones ?? [] };
}

/** Plan (for branding) and the seller's legal details (consumer law: the shop must show who sells). */
async function companyOf(companyId: string): Promise<{ plan: "standaard" | "pro"; trader: Trader | null }> {
  try {
    const { adminDb } = await import("./supabase");
    const { data } = await adminDb().from("companies").select("plan, legal_name, vat_number, street, postcode, city, email, phone").eq("id", companyId).maybeSingle();
    if (!data) return { plan: "standaard", trader: null };
    const { plan, ...t } = data;
    return { plan: (plan as "standaard" | "pro") ?? "standaard", trader: t as Trader };
  } catch {
    return { plan: "standaard", trader: null };
  }
}
