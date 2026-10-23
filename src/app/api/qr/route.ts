import QRCode from "qrcode";

export const runtime = "nodejs";

// QR code for a restaurant's ordering page: /api/qr?slug=frituurdekroon[&format=png&download=1]
export async function GET(req: Request) {
  const u = new URL(req.url);
  const slug = u.searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return new Response("Onbekend", { status: 400 });
  // Optional custom domain (Pro); only plain https hostnames are accepted.
  const custom = u.searchParams.get("u") ?? "";
  const target = /^https:\/\/[a-z0-9.-]+$/.test(custom) ? custom : `${process.env.NEXT_PUBLIC_SITE_URL ?? u.origin}/${slug}`;
  const dl: Record<string, string> = u.searchParams.get("download") ? { "Content-Disposition": `attachment; filename="qr-${slug}.${u.searchParams.get("format") === "png" ? "png" : "svg"}"` } : {};
  if (u.searchParams.get("format") === "png") {
    const png = await QRCode.toBuffer(target, { width: 1200, margin: 2, errorCorrectionLevel: "M" });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", ...dl } });
  }
  const svg = await QRCode.toString(target, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=3600", ...dl } });
}
