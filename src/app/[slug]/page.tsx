import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadMenu } from "@/lib/menu";
import Shop from "./Shop";

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const menu = await loadMenu((await params).slug);
  return { title: menu ? `${menu.restaurant.name} · online bestellen` : "Niet gevonden" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const menu = await loadMenu((await params).slug);
  if (!menu) notFound();
  return <Shop menu={menu} storageUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zaak-media/`} />;
}
