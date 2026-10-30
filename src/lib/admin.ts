import { redirect } from "next/navigation";
import { adminDb } from "./supabase";
import { userDb } from "./supabase-server";

/** Returns a service-role client, but only for platform admins. Use in admin pages and server actions. */
export async function adminOnly() {
  const db = await userDb();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/beheer/login");
  const { data: adm } = await db.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!adm) redirect("/beheer");
  const { data: aal } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/beheer/2fa?verplicht=1&next=/beheer/admin");
  return adminDb();
}

export const PLAN = { standaard: "Standaard", pro: "Pro" } as Record<string, string>;
export const CO_STATUS: Record<string, [string, string]> = { installatie: ["Installatie", "wait"], actief: ["Actief", "ok"], achterstallig: ["Achterstallig", "bad"], opgezegd: ["Opgezegd", ""] };
export const INST_STATUS: Record<string, [string, string]> = { te_plannen: ["Te plannen", "bad"], gepland: ["Gepland", "wait"], geinstalleerd: ["Geïnstalleerd", "ok"] };
export const TYPES = ["Frituur", "Pizzeria", "Broodjeszaak", "Afhaalrestaurant", "Snackbar", "Pita & kebab"];
