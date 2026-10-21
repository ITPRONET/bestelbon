export type Choice = { id: string; name: string; extra_cents: number; position: number };
export type Group = { id: string; name: string; multi: boolean; required: boolean; position: number; option_choices: Choice[] };
export type Item = {
  id: string; name: string; description: string | null; price_cents: number; available: boolean;
  image_path: string | null; position: number; option_groups: Group[];
};
export type Category = { id: string; name: string; position: number; menu_items: Item[] };
export type Restaurant = {
  id: string; slug: string; name: string; type: string; city: string | null; street: string | null; postcode: string | null;
  brand_primary: string; brand_accent: string; logo_path: string | null;
  delivery_fee_cents: number; min_order_cents: number; prep_minutes: number; is_open: boolean; paused_reason: string | null;
  company_id: string;
};
export type Menu = { restaurant: Restaurant; categories: Category[]; plan: "standaard" | "pro" };

export type CartLine = { itemId: string; choiceIds: string[]; qty: number };
