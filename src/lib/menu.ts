import { publicDb } from "./supabase";
import type { Menu, Category, Trader } from "./types";

const GROUP = "id, name, multi, required, max_select, position, option_choices ( id, name, extra_cents, position )";
const SELECT = `id, name, position, option_groups ( ${GROUP} ),
  menu_items ( id, name, description, price_cents, available, image_path, position, allergens, option_groups ( ${GROUP} ) )`;

export async function loadMenu(slug: string): Promise<Menu | null> {
  const db = publicDb();
  const { data: restaurant } = await db.from("restaurants")
    .select("id, slug, name, type, city, street, postcode, brand_primary, brand_accent, logo_path, cover_paths, menu_layout, delivery_fee_cents, min_order_cents, prep_minutes, is_open, paused_reason, company_id, offers_delivery, offers_pickup, online_required")
    .eq("slug", slug).maybeSingle();
  if (!restaurant) return null;
  const [{ data: cats }, { data: hours }, { data: zones }] = await Promise.all([
    db.from("menu_categories").select(SELECT).eq("restaurant_id", restaurant.id),
    db.from("opening_hours").select("weekday, opens, closes").eq("restaurant_id", restaurant.id),
    db.from("delivery_zones").select("postcode, fee_cents, min_order_cents").eq("restaurant_id", restaurant.id).order("postcode"),
  ]);
  const sortGroups = (gs: Category["menu_items"][number]["option_groups"]) =>
    [...gs].sort((a, b) => a.position - b.position).map((g) => ({ ...g, option_choices: [...g.option_choices].sort((a, b) => a.position - b.position) }));
  const categories = ((cats ?? []) as unknown as (Category & { option_groups?: Category["menu_items"][number]["option_groups"] })[])
    .sort((a, b) => a.position - b.position)
    .map(({ option_groups: catGroups, ...c }) => ({
      ...c,
      // Opties van de categorie (bv. broodsoort, formaat) gelden voor elk gerecht erin, vóór de eigen opties.
      menu_items: c.menu_items.sort((a, b) => a.position - b.position).map((i) => ({
        ...i, option_groups: [...sortGroups(catGroups ?? []), ...sortGroups(i.option_groups)],
      })),
    }));
  // Plan is not public data; the storefront only needs to know whether branding is allowed.
  const [{ plan, trader, blocked }, online] = await Promise.all([
    companyOf(restaurant.company_id),
    import("./mollie").then((m) => m.onlineReady(restaurant.id)).catch(() => false),
  ]);
  // Geblokkeerde klant (bv. onbetaalde facturen): bestelpagina toont "tijdelijk niet mogelijk".
  if (blocked) restaurant.is_open = false;
  return { restaurant, categories, plan, trader, online: online && !blocked, hours: hours ?? [], zones: zones ?? [] };
}

/** Plan (for branding) and the seller's legal details (consumer law: the shop must show who sells). */
async function companyOf(companyId: string): Promise<{ plan: "standaard" | "pro"; trader: Trader | null; blocked?: boolean }> {
  try {
    const { adminDb } = await import("./supabase");
    const { data } = await adminDb().from("companies").select("plan, legal_name, vat_number, street, postcode, city, email, phone, blocked_at").eq("id", companyId).maybeSingle();
    if (!data) return { plan: "standaard", trader: null };
    const { plan, blocked_at, ...t } = data;
    return { plan: (plan as "standaard" | "pro") ?? "standaard", trader: t as Trader, blocked: !!blocked_at };
  } catch {
    return { plan: "standaard", trader: null };
  }
}
