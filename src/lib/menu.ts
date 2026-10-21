import { publicDb } from "./supabase";
import type { Menu, Category } from "./types";

const SELECT = `id, name, position,
  menu_items ( id, name, description, price_cents, available, image_path, position,
    option_groups ( id, name, multi, required, position, option_choices ( id, name, extra_cents, position ) ) )`;

export async function loadMenu(slug: string): Promise<Menu | null> {
  const db = publicDb();
  const { data: restaurant } = await db.from("restaurants")
    .select("id, slug, name, type, city, street, postcode, brand_primary, brand_accent, logo_path, delivery_fee_cents, min_order_cents, prep_minutes, is_open, paused_reason, company_id")
    .eq("slug", slug).maybeSingle();
  if (!restaurant) return null;
  const { data: cats } = await db.from("menu_categories").select(SELECT).eq("restaurant_id", restaurant.id);
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
  const plan = await planOf(restaurant.company_id);
  return { restaurant, categories, plan };
}

async function planOf(companyId: string): Promise<"standaard" | "pro"> {
  try {
    const { adminDb } = await import("./supabase");
    const { data } = await adminDb().from("companies").select("plan").eq("id", companyId).maybeSingle();
    return (data?.plan as "standaard" | "pro") ?? "standaard";
  } catch {
    return "standaard";
  }
}
