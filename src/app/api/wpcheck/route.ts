// Tijdelijke controle van de WordPress-doorgifte (wordt weer verwijderd).
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const self = new URL(req.url).origin;
  const r = await fetch(`${self}/wp-admin/`, { redirect: "manual", cache: "no-store" });
  return Response.json({ status: r.status, location: r.headers.get("location") });
}
