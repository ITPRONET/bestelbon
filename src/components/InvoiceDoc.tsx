import { eur } from "@/lib/money";
import { type Buyer, type Invoice, type Line, type Seller, shortDate, shownStatus, STATUS } from "@/lib/invoice";

export default function InvoiceDoc({ inv, lines, buyer, s }: { inv: Invoice; lines: Line[]; buyer: Buyer; s: Seller }) {
  const st = shownStatus(inv);
  return (
    <article className="invoice">
      <header className="inv-head">
        <div>
          <div className="inv-logo">Bestel<b>Bon</b></div>
          <div className="small">{s.name}<br />{s.street}<br />{s.postcode} {s.city}<br />BTW {s.vat || "—"}<br />{s.email}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <h1>Factuur</h1>
          <table className="inv-meta"><tbody>
            <tr><th>Nummer</th><td>{inv.number}</td></tr>
            <tr><th>Datum</th><td>{shortDate(inv.issued_on)}</td></tr>
            <tr><th>Vervaldag</th><td>{shortDate(inv.due_on)}</td></tr>
          </tbody></table>
          <span className={`pill ${STATUS[st]?.[1] ?? ""}`}>{STATUS[st]?.[0] ?? st}</span>
        </div>
      </header>
      <section className="inv-to">
        <div className="muted small">Factuur aan</div>
        <b>{buyer.legal_name}</b>
        <div className="small">{buyer.contact_name && <>t.a.v. {buyer.contact_name}<br /></>}{buyer.street}<br />{buyer.postcode} {buyer.city}<br />BTW {buyer.vat_number}</div>
      </section>
      <table className="inv-lines">
        <thead><tr><th>Omschrijving</th><th>Aantal</th><th>Prijs excl. btw</th><th>Totaal</th></tr></thead>
        <tbody>{lines.map((l, i) => (
          <tr key={i}><td>{l.description}</td><td>{Number(l.qty)}</td><td>{eur(l.unit_cents)}</td><td>{eur(Math.round(Number(l.qty) * l.unit_cents))}</td></tr>
        ))}</tbody>
        <tfoot>
          <tr><td colSpan={3}>Totaal excl. btw</td><td>{eur(inv.subtotal_cents)}</td></tr>
          <tr><td colSpan={3}>Btw {Number(inv.vat_rate)}%</td><td>{eur(inv.vat_cents)}</td></tr>
          <tr className="inv-total"><td colSpan={3}>Totaal</td><td>{eur(inv.total_cents)}</td></tr>
        </tfoot>
      </table>
      {inv.note && <p className="small">{inv.note}</p>}
      {st === "betaald" ? (
        <p className="inv-pay">Betaald{inv.paid_at ? ` op ${shortDate(inv.paid_at.slice(0, 10))}` : ""}{inv.payment_method ? ` (${inv.payment_method})` : ""}. Bedankt!</p>
      ) : st !== "gecrediteerd" && (
        <p className="inv-pay">Gelieve <b>{eur(inv.total_cents)}</b> te betalen voor {shortDate(inv.due_on)} op rekening <b>{s.iban || "—"}</b>{s.bic ? ` (BIC ${s.bic})` : ""} met gestructureerde mededeling <b className="mono">{inv.ogm}</b>.</p>
      )}
      <footer className="inv-foot small muted">{s.name} · BTW {s.vat} · {s.iban} · {s.email} · bestelbon.eu</footer>
    </article>
  );
}
