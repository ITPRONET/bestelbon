import TwoFactor from "./TwoFactor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tweestapsverificatie" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; verplicht?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/beheer") && !sp.next.startsWith("//") ? sp.next : "/beheer";
  return <TwoFactor next={next} required={!!sp.verplicht} />;
}
