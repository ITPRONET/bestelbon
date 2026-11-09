// Graphic 80 mm receipts (576 dots wide) for Star CloudPRNT "image/png" and the panel preview.
import React from "react";
import { readFile } from "fs/promises";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import { deflateSync } from "zlib";
import type { TicketLine, TicketOrder } from "./ticket";

const W = 576;
const PAD = 16;
const MONO = "Plex";

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  const dir = path.join(process.cwd(), "src/assets/fonts");
  fonts ??= Promise.all([
    readFile(path.join(dir, "ibm-plex-mono-latin-400-normal.woff")).then((data) => ({ name: MONO, data, weight: 400 as const, style: "normal" as const })),
    readFile(path.join(dir, "ibm-plex-mono-latin-600-normal.woff")).then((data) => ({ name: MONO, data, weight: 600 as const, style: "normal" as const })),
    readFile(path.join(dir, "ibm-plex-mono-latin-700-normal.woff")).then((data) => ({ name: MONO, data, weight: 700 as const, style: "normal" as const })),
    readFile(path.join(dir, "figtree-latin-800-normal.woff")).then((data) => ({ name: "Figtree", data, weight: 800 as const, style: "normal" as const })),
  ]);
  return fonts;
}

const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const time = (iso: string) => new Date(iso).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
const paid = (o: TicketOrder) => o.payment_method === "online" && o.payment_status === "betaald";
/** Pro: het logo van de zaak bovenaan de klantenbon. Grijswaarden + Floyd-Steinberg, zodat ook een kleurenlogo
 *  netjes zwart-wit print. Gecachet per pad (een nieuw logo krijgt een nieuw pad). */
const logoCache = new Map<string, Promise<string | null>>();
export function ticketLogo(logoPath: string | null | undefined): Promise<string | null> {
  if (!logoPath) return Promise.resolve(null);
  let p = logoCache.get(logoPath);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/zaak-media/${logoPath}`);
        if (!res.ok) return null;
        const sharp = (await import("sharp")).default;
        const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
          .flatten({ background: "#ffffff" })
          .resize({ width: 380, height: 150, fit: "inside", withoutEnlargement: false })
          .grayscale().normalise().raw().toBuffer({ resolveWithObject: true });
        const w = info.width, h = info.height, g = new Float32Array(data.length);
        for (let i = 0; i < data.length; i++) g[i] = data[i];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = y * w + x, old = g[i], nw = old < 128 ? 0 : 255, err = old - nw;
          g[i] = nw;
          if (x + 1 < w) g[i + 1] += err * 7 / 16;
          if (y + 1 < h) { if (x > 0) g[i + w - 1] += err * 3 / 16; g[i + w] += err * 5 / 16; if (x + 1 < w) g[i + w + 1] += err / 16; }
        }
        const out = Buffer.alloc(w * h); for (let i = 0; i < out.length; i++) out[i] = g[i] < 128 ? 0 : 255;
        const png = await sharp(out, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
        return `data:image/png;base64,${png.toString("base64")}|${w}x${h}`;
      } catch (e) {
        console.error("ticket logo", e);
        return null;
      }
    })();
    logoCache.set(logoPath, p);
    p.then((v) => { if (!v) logoCache.delete(logoPath); });
  }
  return p;
}

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const LOGO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M7 3h18v24l-3-2-3 2-3-2-3 2-3-2-3 2V3z" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="round"/><path d="M11 9h10M11 13h10M11 17h6" stroke="#000" stroke-width="2" stroke-linecap="round"/><circle cx="23.5" cy="23.5" r="6" fill="#000"/><path d="M21 23.6l1.7 1.7 3-3.2" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`);

/* ---------- building blocks ---------- */
const Col = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => <div style={{ display: "flex", flexDirection: "column", ...style }}>{children}</div>;
const Center = ({ children, size = 26, weight = 400, style }: { children: React.ReactNode; size?: number; weight?: number; style?: React.CSSProperties }) => (
  <div style={{ display: "flex", justifyContent: "center", textAlign: "center", fontSize: size, fontWeight: weight, lineHeight: 1.25, ...style }}>{children}</div>
);
const Bar = ({ text, size = 28 }: { text: string; size?: number }) => (
  <div style={{ display: "flex", justifyContent: "center", background: "#000", color: "#fff", fontSize: size, fontWeight: 700, letterSpacing: 3, padding: "8px 10px", margin: "6px 0" }}>{text}</div>
);
const Rule = () => <div style={{ display: "flex", borderTop: "3px dashed #000", margin: "14px 0" }} />;
const Row = ({ l, r, size = 26, weight = 400 }: { l: string; r: string; size?: number; weight?: number }) => (
  <div style={{ display: "flex", justifyContent: "space-between", fontSize: size, fontWeight: weight, lineHeight: 1.3 }}>
    <span style={{ flex: 1, paddingRight: 12 }}>{l}</span><span>{r}</span>
  </div>
);
const Footer = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 4 }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={LOGO} width={38} height={38} alt="" />
    <span style={{ fontFamily: "Figtree", fontWeight: 800, fontSize: 30, letterSpacing: -0.5 }}>BestelBon</span>
    <span style={{ fontSize: 20, marginTop: 6 }}>bestelbon.eu</span>
  </div>
);
const Late = () => (
  <div style={{ display: "flex", justifyContent: "center", border: "4px solid #000", fontSize: 26, fontWeight: 700, padding: "6px", margin: "8px 0" }}>NAGEPRINT · VERTRAAGD</div>
);

function Paper({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", boxSizing: "border-box", width: W, padding: `${PAD}px ${PAD}px 40px`, background: "#fff", color: "#000", fontFamily: MONO }}>{children}</div>;
}

/** Klantenkaart op de klantenbon: kader met stempels (● = gespaard) en wat er nog nodig is. */
function LoyaltyBox({ note }: { note: string }) {
  const m = note.match(/Klantenkaart (\d+)\/(\d+)/);
  const have = m ? Number(m[1]) : 0, need = m ? Number(m[2]) : 0;
  const parts = note.split(" · ");
  const used = parts.find((p) => p.startsWith("BELONING"));
  const rest = parts.filter((p) => p !== used).map((p) => p.replace(/^Klantenkaart \d+\/\d+( - )?/, ""));
  return (
    <Col style={{ border: "3px solid #000", borderRadius: 14, padding: "10px 12px", marginTop: 12, alignItems: "center" }}>
      {used && <div style={{ display: "flex", background: "#000", color: "#fff", fontSize: 24, fontWeight: 700, padding: "4px 10px", marginBottom: 8 }}>{used}</div>}
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>{`KLANTENKAART  ${have}/${need}`}</div>
      {need > 0 && need <= 20 && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, margin: "8px 0 4px" }}>
          {Array.from({ length: need }, (_, i) => (
            <div key={i} style={{ display: "flex", width: 34, height: 34, borderRadius: 17, border: "3px solid #000", background: i < have ? "#000" : "#fff" }} />
          ))}
        </div>
      )}
      {rest.filter(Boolean).map((t, i) => <div key={i} style={{ display: "flex", justifyContent: "center", textAlign: "center", fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>{t}</div>)}
    </Col>
  );
}

/* ---------- tickets ---------- */
function Kitchen({ name, o, lines }: { name: string; o: TicketOrder; lines: TicketLine[] }) {
  return (
    <Paper>
      <Bar text="KEUKEN" size={30} />
      <Center size={26} style={{ marginTop: 6 }}>{name}</Center>
      <Center size={104} weight={700} style={{ lineHeight: 1.05, margin: "4px 0" }}>{`#${o.day_number}`}</Center>
      <Center size={34} weight={700}>{`${o.mode === "levering" ? "LEVERING" : "AFHALEN"} · ${o.requested_time ?? "Zo snel mogelijk"}`}</Center>
      <Center size={24}>{`besteld ${time(o.created_at)}`}</Center>
      {o.late && <Late />}
      <Rule />
      <Col style={{ gap: 8 }}>
        {lines.map((l, i) => (
          <Col key={i}>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>{`${l.qty} x ${l.item_name}`}</div>
            {l.options.map((opt, j) => <div key={j} style={{ display: "flex", fontSize: 27, paddingLeft: 30, lineHeight: 1.25 }}>{`> ${opt}`}</div>)}
          </Col>
        ))}
      </Col>
      {o.note && <Rule />}
      {o.note && <div style={{ display: "flex", fontSize: 28, lineHeight: 1.3 }}><span style={{ fontWeight: 700, paddingRight: 12 }}>OPMERKING:</span><span style={{ flex: 1 }}>{o.note}</span></div>}
      <Rule />
      <Center size={28}>{o.customer_name ?? ""}</Center>
      <Bar text={paid(o) ? "BETAALD ONLINE" : `TE BETALEN: € ${money(o.total_cents)}`} size={30} />
      <Rule />
      <Footer />
    </Paper>
  );
}

function Logo({ logo }: { logo: string }) {
  const [src, size] = logo.split("|");
  const [w, h] = size.split("x").map(Number);
  return <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><img src={src} width={w} height={h} alt="" /></div>; // eslint-disable-line @next/next/no-img-element
}

function Delivery({ name, o, lines, qr, logo }: { name: string; o: TicketOrder; lines: TicketLine[]; qr: string | null; logo?: string | null }) {
  return (
    <Paper>
      {logo && <Logo logo={logo} />}
      <Bar text={o.mode === "levering" ? "BEZORGING" : "AFHALEN"} size={30} />
      <Center size={26} style={{ marginTop: 6 }}>{name}</Center>
      <Center size={104} weight={700} style={{ lineHeight: 1.05, margin: "4px 0" }}>{`#${o.day_number}`}</Center>
      <Center size={34} weight={700}>{`${o.mode === "levering" ? "LEVERING" : "AFHALEN"} · ${o.requested_time ?? "Zo snel mogelijk"}`}</Center>
      {o.late && <Late />}
      <Rule />
      <Col style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.25 }}>
        <div style={{ display: "flex" }}>{o.customer_name ?? ""}</div>
        {o.address && <div style={{ display: "flex" }}>{o.address}</div>}
        {(o.postcode || o.city) && <div style={{ display: "flex" }}>{`${o.postcode ?? ""} ${o.city ?? ""}`.trim()}</div>}
      </Col>
      <div style={{ display: "flex", fontSize: 28, marginTop: 4 }}>{`Tel: ${o.customer_phone ?? ""}`}</div>
      {o.note && <div style={{ display: "flex", fontSize: 26, marginTop: 6, lineHeight: 1.3 }}><span style={{ fontWeight: 700, paddingRight: 10 }}>Opm:</span><span style={{ flex: 1 }}>{o.note}</span></div>}
      <Rule />
      <Col style={{ gap: 2 }}>
        {lines.map((l, i) => (
          <Col key={i} style={{ marginBottom: 4 }}>
            <Row l={`${l.qty}x ${l.item_name}`} r={money(l.qty * l.unit_cents)} weight={700} />
            {l.options.map((opt, j) => <div key={j} style={{ display: "flex", fontSize: 24, paddingLeft: 30, lineHeight: 1.25 }}>{`> ${opt}`}</div>)}
          </Col>
        ))}
        {o.delivery_fee_cents > 0 && <Row l="Leverkost" r={money(o.delivery_fee_cents)} />}
        {!!o.discount_cents && <Row l="Korting klantenkaart" r={"-" + money(o.discount_cents)} />}
      </Col>
      <Rule />
      <Row l="TOTAAL" r={`€ ${money(o.total_cents)}`} size={34} weight={700} />
      <Bar text={paid(o) ? "BETAALD ONLINE" : `TE BETALEN: € ${money(o.total_cents)}`} size={30} />
      {o.loyalty_note && <LoyaltyBox note={o.loyalty_note} />}
      {qr && (
        <Col style={{ alignItems: "center", marginTop: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={300} height={300} alt="" />
          <div style={{ display: "flex", fontSize: 24, marginTop: 6 }}>Scan voor route</div>
        </Col>
      )}
      <Rule />
      <Footer />
    </Paper>
  );
}

function Test({ stamp }: { stamp: string }) {
  return (
    <Paper>
      <Bar text="TESTAFDRUK" size={30} />
      <Center size={30} weight={700} style={{ marginTop: 14 }}>BestelBon werkt op deze printer.</Center>
      <Center size={24} style={{ marginTop: 8 }}>{stamp}</Center>
      <Center size={24} style={{ marginTop: 8 }}>Bestellingen printen hier automatisch.</Center>
      <Rule />
      <Footer />
    </Paper>
  );
}

/* ---------- rendering ---------- */
/** 1-bit bitmap, rows packed MSB first, 1 = black. */
type Bits = { w: number; h: number; stride: number; data: Buffer };
async function bitmap(el: React.ReactElement): Promise<Bits> {
  const svg = await satori(el, { width: W, fonts: await loadFonts() });
  // No anti-aliasing: a thermal printer only knows black and white.
  const img = new Resvg(svg, { background: "#fff", shapeRendering: 0, textRendering: 0, imageRendering: 1, fitTo: { mode: "width", value: W } }).render();
  const w = img.width, h = img.height, stride = Math.ceil(w / 8), px = img.pixels;
  const data = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] < 128) data[y * stride + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return { w, h, stride, data };
}
async function render(el: React.ReactElement) {
  return mono(await bitmap(el));
}

/** 1-bit black/white PNG. Star printers have little memory: a 1-bit image is ~30x smaller to decode than RGBA. */
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b: Buffer) { let c = -1; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function mono({ w, h, stride, data }: Bits) {
  const raw = Buffer.alloc((stride + 1) * h); // filter byte 0 per row; PNG grayscale: 1 = white
  for (let y = 0; y < h; y++) for (let b = 0; b < stride; b++) raw[y * (stride + 1) + 1 + b] = ~data[y * stride + b] & 0xff;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 1; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

export async function routeQr(o: TicketOrder) {
  const dest = [o.address, `${o.postcode ?? ""} ${o.city ?? ""}`.trim(), "België"].filter(Boolean).join(", ");
  if (!o.address) return null;
  const svg = await QRCode.toString(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return svgUri(svg);
}

export async function ticketPng(kind: "keuken" | "bezorging", name: string, o: TicketOrder, lines: TicketLine[], logo: string | null = null) {
  return kind === "bezorging"
    ? render(<Delivery name={name} o={o} lines={lines} qr={await routeQr(o)} logo={logo} />)
    : render(<Kitchen name={name} o={o} lines={lines} />);
}

/** StarPRNT: several tickets in ONE print job, each followed by a cut (no pause between tickets).
 *  ESC @ init · ESC GS S raster image (m=1, x bytes, y lines, n=0) · ESC d 2 feed + full cut. */
export async function ticketsStarPrnt(tickets: { kind: "keuken" | "bezorging"; name: string; o: TicketOrder; lines: TicketLine[]; logo?: string | null }[]) {
  const parts: Buffer[] = [Buffer.from([0x1b, 0x40])];
  for (const t of tickets) {
    const el = t.kind === "bezorging" ? <Delivery name={t.name} o={t.o} lines={t.lines} qr={await routeQr(t.o)} logo={t.logo} /> : <Kitchen name={t.name} o={t.o} lines={t.lines} />;
    const b = await bitmap(el);
    for (let y0 = 0; y0 < b.h; y0 += 256) { // in blokken, zodat de printerbuffer klein blijft
      const n = Math.min(256, b.h - y0);
      parts.push(Buffer.from([0x1b, 0x1d, 0x53, 1, b.stride & 0xff, b.stride >> 8, n & 0xff, n >> 8, 0]));
      parts.push(b.data.subarray(y0 * b.stride, (y0 + n) * b.stride));
    }
    parts.push(Buffer.from([0x1b, 0x64, 0x02]));
  }
  return Buffer.concat(parts);
}

export function testPng() {
  return render(<Test stamp={new Date().toLocaleString("nl-BE", { timeZone: "Europe/Brussels" })} />);
}
