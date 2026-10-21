import Status from "./Status";
export const metadata = { title: "Je bestelling" };
export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  return <Status slug={slug} id={id} />;
}
