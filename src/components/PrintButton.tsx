"use client";
export default function PrintButton({ label = "Afdrukken of PDF" }: { label?: string }) {
  return <button type="button" className="btn btn-primary" onClick={() => window.print()}>{label}</button>;
}
