// Printer set-up chosen at sign-up (self-starter package): how many printers and how each one reaches the internet.
export type Conn = "kabel" | "powerline" | "onbekend";
export type Setup = { printers: 1 | 2; conns: Conn[]; install: "zelf" | "ter_plaatse" };
export const ROLES = ["Keuken", "Toog / bezorging"] as const;

/** What goes in the box. "Weet ik niet" is counted as powerline (we check by phone). */
export function packageOf(s: Setup) {
  const conns = s.conns.slice(0, s.printers);
  const cable = conns.filter((c) => c === "kabel").length;
  const powerline = conns.length - cable;
  return { printers: conns.length, cable, powerline, adapters: powerline ? powerline + 1 : 0, unknown: conns.includes("onbekend"), conns };
}

export function setupText(s: Setup) {
  const p = packageOf(s);
  const per = p.conns.map((c, i) => `${s.printers === 1 ? "Printer" : ROLES[i]}: ${c === "kabel" ? "netwerkkabel" : c === "powerline" ? "powerline" : "weet niet (advies nodig)"}`).join(" · ");
  return `${p.printers} printer${p.printers > 1 ? "s" : ""}${p.adapters ? ` + ${p.adapters} powerline-adapters` : ""} · ${per} · ${s.install === "ter_plaatse" ? "installatie ter plaatse" : "zelf installeren"}`;
}
