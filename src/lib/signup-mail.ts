// Welcome e-mail after a zaak signs up on /aanmelden: branded HTML plus a plain-text version.
// Table layout with inline styles, so it looks right in Outlook, Gmail and Apple Mail.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const NAVY = "#0b1033", RED = "#ff4b2b", YELLOW = "#ffc229", INK = "#141a3a", MUTED = "#596088", LINE = "#e6e8f2";

export type SignupMail = {
  contact: string; zaak: string; type: string | null; plan: "pro" | "standaard"; billing: "jaar" | "maand";
  printers: string; start: string | null; gks: string; legal: string; vat: string; address: string; phone: string; email: string; message: string | null;
};

function niceDate(iso: string | null) {
  if (!iso) return "zo snel mogelijk";
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(+d) ? iso : d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function signupMail(m: SignupMail, site: string, panel: string | null = null) {
  const first = m.contact.trim().split(/\s+/)[0] || m.contact;
  const plan = `${m.plan === "pro" ? "Pro" : "Standaard"} · ${m.billing === "jaar" ? "jaarlijks (10% korting)" : "maandelijks"}`;
  const start = niceDate(m.start);
  const rows: [string, string][] = [
    ["Zaak", `${m.zaak}${m.type ? ` (${m.type})` : ""}`],
    ["Pakket", plan],
    ["Printers", m.printers],
    ["Gewenste start", start],
    ["Witte kassa", m.gks],
    ["Bedrijf", `${m.legal} · ${m.vat}`],
    ["Adres", m.address],
    ["Contact", `${m.contact} · ${m.phone}`],
    ...(m.message ? [["Opmerking", m.message] as [string, string]] : []),
  ];
  const steps: [string, string, string][] = panel ? [
    ["✍️", "Vul alvast je menu in", "Je krijgt zo een aparte mail om je wachtwoord te kiezen. Daarna kan je meteen je gerechten, prijzen en openingsuren invullen."],
    ["📞", "We bellen je", "Binnen één werkdag overlopen we samen alles en stellen we je printer vooraf in. Jij hoeft niets te installeren."],
    ["🔌", "Stekker erin, klaar", "Printer aansluiten, en je eerste online bestelling rolt vanzelf uit de printer."],
  ] : [
    ["📞", "We bellen je", "Binnen één werkdag overlopen we samen je menu, je openingsuren en je bezorgzone."],
    ["🧾", "Wij zetten alles klaar", "We bouwen je bestelpagina en stellen je printer vooraf in. Jij hoeft niets te installeren."],
    ["🔌", "Stekker erin, klaar", "Printer aansluiten, en je eerste online bestelling rolt vanzelf uit de printer."],
  ];
  const prep = panel ? ["Je menukaart met prijzen", "Je openingsuren", "Waar je levert en wat de leverkost is", ...(m.plan === "pro" ? ["Je logo en een sfeerfoto"] : [])] : ["Je menukaart (foto of pdf is genoeg)", "Je openingsuren", "Waar je levert en wat de leverkost is", ...(m.plan === "pro" ? ["Je logo en een sfeerfoto"] : [])];

  const text = [
    `Beste ${first},`, "",
    `Bedankt voor je aanmelding bij BestelBon! ${panel ? "Je beheerpaneel staat al klaar en " : ""}we bellen je binnen één werkdag om alles te overlopen.`, "",
    "Zo gaat het verder:", ...steps.map(([, t, d], i) => `${i + 1}. ${t}: ${d}`), "",
    panel ? "Wat je in je beheerpaneel invult:" : "Handig om klaar te leggen:", ...prep.map((p) => `- ${p}`), "",
    ...(panel ? [`Je beheerpaneel: ${panel} (eerst je wachtwoord kiezen via de aparte mail).`, ""] : []),
    "Je aanmelding:", ...rows.map(([k, v]) => `${k}: ${v}`), "",
    `Je ging akkoord met de algemene voorwaarden (${site}/voorwaarden) en de verwerkersovereenkomst (${site}/verwerkersovereenkomst).`, "",
    "Vragen? Antwoord gewoon op deze mail.", "", "Tot snel,", "Het BestelBon-team", "info@bestelbon.eu · bestelbon.eu",
  ].join("\n");

  const font = "font-family:'Segoe UI',Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Welkom bij BestelBon</title></head>
<body style="margin:0;padding:0;background:#eef0f7;${font};color:${INK}">
<div style="display:none;max-height:0;overflow:hidden">We bellen je binnen één werkdag. Dit is wat er nu gebeurt.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden">

<tr><td style="background:${NAVY};padding:28px 32px 34px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="background:#fffdf6;border-radius:9px;width:34px;height:34px;text-align:center;font-size:19px;line-height:34px">🧾</td>
    <td style="padding-left:10px;${font};font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.4px">Bestel<span style="color:${RED}">Bon</span></td>
  </tr></table>
  <p style="margin:26px 0 8px;font-size:30px;line-height:1.15;font-weight:800;color:#ffffff;letter-spacing:-0.6px">Welkom bij BestelBon, ${esc(first)}! <span style="color:${YELLOW}">🎉</span></p>
  <p style="margin:0;font-size:16px;line-height:1.5;color:#c3c8ea">Je aanmelding voor <b style="color:#ffffff">${esc(m.zaak)}</b> is goed aangekomen.${panel ? ` Je beheerpaneel staat al klaar, en we` : ` We`} bellen je <b style="color:${YELLOW}">binnen één werkdag</b> om alles te overlopen.</p>
</td></tr>

<tr><td style="padding:30px 32px 6px">
  <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:1.2px;color:${RED};text-transform:uppercase">Zo gaat het verder</p>
  ${steps.map(([icon, t, d], i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
    <td width="52" valign="top"><div style="width:44px;height:44px;border-radius:12px;background:${i === 2 ? "#e9f8f0" : "#fff1ec"};text-align:center;line-height:44px;font-size:22px">${icon}</div></td>
    <td valign="top" style="padding-left:6px"><p style="margin:2px 0 3px;font-size:16px;font-weight:700;color:${INK}"><span style="color:${MUTED};font-weight:600">${i + 1}.</span> ${t}</p><p style="margin:0;font-size:14px;line-height:1.5;color:${MUTED}">${d}</p></td>
  </tr></table>`).join("")}
</td></tr>

<tr><td style="padding:8px 32px 4px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e6;border:1px solid #ffe3a3;border-radius:14px"><tr><td style="padding:16px 18px">
    <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${INK}">💡 ${panel ? "Wat je in je beheerpaneel invult" : "Handig om klaar te leggen voor ons gesprek"}</p>
    ${prep.map((p) => `<p style="margin:0 0 4px;font-size:14px;line-height:1.45;color:${INK}">✔&nbsp; ${p}</p>`).join("")}
  </td></tr></table>
</td></tr>

<tr><td style="padding:22px 32px 6px">
  <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:1.2px;color:${RED};text-transform:uppercase">Je aanmelding</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:14px;border-collapse:separate">
  ${rows.map(([k, v], i) => `<tr><td width="34%" valign="top" style="padding:10px 14px;font-size:13px;color:${MUTED};${i ? `border-top:1px solid ${LINE};` : ""}">${k}</td><td valign="top" style="padding:10px 14px;font-size:14px;font-weight:600;color:${INK};${i ? `border-top:1px solid ${LINE};` : ""}">${esc(v)}</td></tr>`).join("")}
  </table>
</td></tr>

<tr><td align="center" style="padding:26px 32px 8px">
  ${panel ? `<p style="margin:0 0 14px;font-size:15px;color:${INK}">Wachtwoord gekozen? Dan kan je meteen aan de slag.</p>
  <a href="${panel}" style="display:inline-block;background:${YELLOW};color:${NAVY};font-weight:800;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:999px">Naar je beheerpaneel →</a>
  <p style="margin:14px 0 0;font-size:13px;color:${MUTED}">Of bekijk eerst <a href="https://frituurdekroon.bestelbon.eu" style="color:${MUTED}">een voorbeeld van een bestelpagina</a>.</p>` : `<p style="margin:0 0 14px;font-size:15px;color:${INK}">Benieuwd hoe jouw bestelpagina eruit kan zien?</p>
  <a href="https://frituurdekroon.bestelbon.eu" style="display:inline-block;background:${YELLOW};color:${NAVY};font-weight:800;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:999px">Bekijk een voorbeeld →</a>`}
</td></tr>

<tr><td style="padding:24px 32px 28px">
  <p style="margin:0 0 4px;font-size:15px;color:${INK}">Vragen? Antwoord gewoon op deze mail.</p>
  <p style="margin:0;font-size:15px;color:${INK}">Tot snel,<br><b>Het BestelBon-team</b></p>
</td></tr>

<tr><td style="background:#f6f7fb;padding:18px 32px;border-top:1px solid ${LINE}">
  <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${MUTED}">Je ging akkoord met de <a href="${site}/voorwaarden" style="color:${MUTED}">algemene voorwaarden</a> en de <a href="${site}/verwerkersovereenkomst" style="color:${MUTED}">verwerkersovereenkomst</a>.</p>
  <p style="margin:0;font-size:12px;color:${MUTED}"><b>BestelBon</b> · online bestellen zonder commissie · <a href="https://bestelbon.eu" style="color:${MUTED}">bestelbon.eu</a> · <a href="mailto:info@bestelbon.eu" style="color:${MUTED}">info@bestelbon.eu</a></p>
</td></tr>

</table></td></tr></table></body></html>`;

  return { subject: `Welkom bij BestelBon, ${first}! Dit gebeurt er nu`, text, html };
}
