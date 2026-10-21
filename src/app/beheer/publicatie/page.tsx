import PanelNav from "@/components/PanelNav";
import { panel } from "@/lib/panel";
import CopyField from "./CopyField";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publicatie" };

export default async function Page({ searchParams }: { searchParams: Promise<{ zaak?: string }> }) {
  const sp = await searchParams;
  const { restaurants, current } = await panel(sp.zaak);
  if (!current) return null;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${base}/${current.slug}`;
  const button = `<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;background:#ff6a00;color:#fff;font:600 16px/1 system-ui,sans-serif;padding:14px 22px;border-radius:999px;text-decoration:none">Online bestellen</a>`;
  return (
    <>
      <PanelNav active="publicatie" restaurants={restaurants} current={current} />
      <h1 className="ph">Publicatie</h1>
      <div className="sgrid">
        <div style={{ display: "grid", gap: 16, alignContent: "start", minWidth: 0 }}>
          <section className="panel">
            <h2 className="h2">Je bestelpagina</h2>
            <CopyField value={url} label="Link naar je bestelpagina" />
            <p style={{ marginBottom: 0 }}><a className="btn" href={url} target="_blank" rel="noopener">Bekijk als klant</a></p>
          </section>
          <section className="panel">
            <h2 className="h2">Waar zet je de link?</h2>
            <ul className="steps">
              <li><b>Google-bedrijfsprofiel</b><span className="muted">Bij “Bestellen” en “Menu”. Hier zoeken de meeste klanten.</span></li>
              <li><b>Facebook-pagina</b><span className="muted">Knop “Bestel eten” met deze link.</span></li>
              <li><b>Instagram</b><span className="muted">Link in je bio.</span></li>
              <li><b>Flyers, deur en afhaalzakken</b><span className="muted">De QR-code hiernaast.</span></li>
            </ul>
          </section>
          <section className="panel">
            <h2 className="h2">Knop voor je eigen website</h2>
            <p className="muted small" style={{ marginTop: 0 }}>Plak deze code op je website. Wij of je webdesigner kunnen dat ook voor je doen.</p>
            <CopyField value={button} label="HTML-code" multiline />
          </section>
        </div>
        <section className="panel" style={{ textAlign: "center" }}>
          <h2 className="h2">QR-code</h2>
          <div className="sticker">
            <div className="st-top"><small>Scan &amp; bestel</small>Bestel online</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr?slug=${current.slug}`} alt={`QR-code naar ${url}`} width={200} height={200} />
            <div className="st-name">{current.name}</div>
            <div className="st-url">{url.replace(/^https?:\/\//, "")}</div>
          </div>
          <p style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn btn-primary" href={`/api/qr?slug=${current.slug}&format=png&download=1`}>Download PNG</a>
            <a className="btn" href={`/api/qr?slug=${current.slug}&download=1`}>Download SVG (drukker)</a>
          </p>
        </section>
      </div>
    </>
  );
}
