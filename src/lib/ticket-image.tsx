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

function Delivery({ name, o, lines, qr }: { name: string; o: TicketOrder; lines: TicketLine[]; qr: string | null }) {
  return (
    <Paper>
      <Bar text="BEZORGING" size={30} />
      <Center size={26} style={{ marginTop: 6 }}>{name}</Center>
      <Center size={104} weight={700} style={{ lineHeight: 1.05, margin: "4px 0" }}>{`#${o.day_number}`}</Center>
      <Center size={34} weight={700}>{`LEVERING · ${o.requested_time ?? "Zo snel mogelijk"}`}</Center>
      {o.late && <Late />}
      <Rule />
      <Col style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.25 }}>
        <div style={{ display: "flex" }}>{o.customer_name ?? ""}</div>
        <div style={{ display: "flex" }}>{o.address ?? ""}</div>
        <div style={{ display: "flex" }}>{`${o.postcode ?? ""} ${o.city ?? ""}`.trim()}</div>
      </Col>
      <div style={{ display: "flex", fontSize: 28, marginTop: 4 }}>{`Tel: ${o.customer_phone ?? ""}`}</div>
      {o.note && <div style={{ display: "flex", fontSize: 26, marginTop: 6, lineHeight: 1.3 }}><span style={{ fontWeight: 700, paddingRight: 10 }}>Opm:</span><span style={{ flex: 1 }}>{o.note}</span></div>}
      <Rule />
      <Col style={{ gap: 2 }}>
        {lines.map((l, i) => <Row key={i} l={`${l.qty}x ${l.item_name}`} r={money(l.qty * l.unit_cents)} />)}
        {o.delivery_fee_cents > 0 && <Row l="Leverkost" r={money(o.delivery_fee_cents)} />}
      </Col>
      <Rule />
      <Row l="TOTAAL" r={`€ ${money(o.total_cents)}`} size={34} weight={700} />
      <Bar text={paid(o) ? "BETAALD ONLINE" : `TE BETALEN: € ${money(o.total_cents)}`} size={30} />
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
async function render(el: React.ReactElement) {
  const svg = await satori(el, { width: W, fonts: await loadFonts() });
  // No anti-aliasing: a thermal printer only knows black and white.
  const img = new Resvg(svg, { background: "#fff", shapeRendering: 0, textRendering: 0, imageRendering: 1, fitTo: { mode: "width", value: W } }).render();
  return mono(img.pixels, img.width, img.height);
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
function mono(rgba: Buffer, w: number, h: number) {
  const stride = Math.ceil(w / 8);
  const raw = Buffer.alloc((stride + 1) * h); // filter byte 0 per row
  for (let y = 0; y < h; y++) {
    const row = y * (stride + 1);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (lum >= 128) raw[row + 1 + (x >> 3)] |= 0x80 >> (x & 7); // 1 = white in grayscale
    }
  }
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

export async function ticketPng(kind: "keuken" | "bezorging", name: string, o: TicketOrder, lines: TicketLine[]) {
  return kind === "bezorging"
    ? render(<Delivery name={name} o={o} lines={lines} qr={await routeQr(o)} />)
    : render(<Kitchen name={name} o={o} lines={lines} />);
}

export function testPng() {
  return render(<Test stamp={new Date().toLocaleString("nl-BE", { timeZone: "Europe/Brussels" })} />);
}
