import { adminDb } from "./supabase";
import { today } from "./panel";
import { normVat } from "./vat";

export type Seller = { name: string; street: string; postcode: string; city: string; vat: string; iban: string; bic: string; email: string; vat_rate: number; due_days: number };
export type Invoice = { id: string; number: string; issued_on: string; due_on: string; status: string; ogm: string | null; vat_rate: number; subtotal_cents: number; vat_cents: number; total_cents: number; paid_at: string | null; payment_method: string | null; peppol_status: string; period: string | null; note: string | null; company_id: string };
export type Line = { description: string; qty: number; unit_cents: number; position: number };
export type Buyer = { legal_name: string; vat_number: string; street: string | null; postcode: string | null; city: string | null; contact_name: string | null; email: string };

const DEFAULT: Seller = { name: "ITPRONET", street: "", postcode: "", city: "", vat: "", iban: "", bic: "", email: "info@bestelbon.eu", vat_rate: 21, due_days: 14 };

/** Seller (ITPRONET) details, kept in platform_settings and edited in the admin. */
export async function seller(): Promise<Seller> {
  const { data } = await adminDb().from("platform_settings").select("seller").eq("id", 1).maybeSingle();
  return { ...DEFAULT, ...((data?.seller as Partial<Seller>) ?? {}) };
}

export const shownStatus = (i: { status: string; due_on: string }) => (i.status === "open" && i.due_on < today() ? "vervallen" : i.status);
export const STATUS: Record<string, [string, string]> = {
  open: ["Open", "wait"], betaald: ["Betaald", "ok"], vervallen: ["Vervallen", "bad"], gecrediteerd: ["Gecrediteerd", ""],
};
export const PEPPOL: Record<string, string> = { niet_verstuurd: "Niet verstuurd", verstuurd: "Verstuurd via Peppol", afgeleverd: "Afgeleverd via Peppol", per_mail: "Per e-mail verstuurd" };
export const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
export const periodLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
export const shortDate = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

const x = (s: string | number | null | undefined) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const a = (c: number) => (c / 100).toFixed(2);

function party(name: string, vat: string, street: string, postcode: string, city: string, email?: string) {
  const v = normVat(vat);
  const be = v.compact.startsWith("BE");
  return `<cac:Party>
      ${be ? `<cbc:EndpointID schemeID="0208">${x(v.digits)}</cbc:EndpointID>` : `<cbc:EndpointID schemeID="9925">${x(v.compact)}</cbc:EndpointID>`}
      <cac:PartyName><cbc:Name>${x(name)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress><cbc:StreetName>${x(street)}</cbc:StreetName><cbc:CityName>${x(city)}</cbc:CityName><cbc:PostalZone>${x(postcode)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>${x(v.compact.slice(0, 2) || "BE")}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>
      <cac:PartyTaxScheme><cbc:CompanyID>${x(v.compact)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>
      <cac:PartyLegalEntity><cbc:RegistrationName>${x(name)}</cbc:RegistrationName>${be ? `<cbc:CompanyID schemeID="0208">${x(v.digits)}</cbc:CompanyID>` : ""}</cac:PartyLegalEntity>
      ${email ? `<cac:Contact><cbc:ElectronicMail>${x(email)}</cbc:ElectronicMail></cac:Contact>` : ""}
    </cac:Party>`;
}

/** Peppol BIS Billing 3.0 (UBL 2.1) invoice, for upload to a Peppol access point. */
export function ubl(inv: Invoice, lines: Line[], b: Buyer, s: Seller) {
  const rate = Number(inv.vat_rate);
  const lineXml = lines.map((l, i) => {
    const total = Math.round(Number(l.qty) * l.unit_cents);
    return `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">${Number(l.qty)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${a(total)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${x(l.description)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="EUR">${a(l.unit_cents)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${x(inv.number)}</cbc:ID>
  <cbc:IssueDate>${inv.issued_on}</cbc:IssueDate>
  <cbc:DueDate>${inv.due_on}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${x(inv.number)}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    ${party(s.name, s.vat, s.street, s.postcode, s.city, s.email)}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    ${party(b.legal_name, b.vat_number, b.street ?? "", b.postcode ?? "", b.city ?? "", b.email)}
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>${x(inv.ogm ?? inv.number)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount><cbc:ID>${x(s.iban.replace(/\s/g, ""))}</cbc:ID>${s.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${x(s.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms><cbc:Note>Te betalen voor ${inv.due_on} met gestructureerde mededeling ${x(inv.ogm)}</cbc:Note></cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${a(inv.vat_cents)}</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">${a(inv.subtotal_cents)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">${a(inv.vat_cents)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${rate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${a(inv.subtotal_cents)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${a(inv.subtotal_cents)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${a(inv.total_cents)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${a(inv.status === "betaald" ? 0 : inv.total_cents)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lineXml}
</Invoice>
`;
}
