"use client";
import { useRef, useState } from "react";
export default function CopyField({ value, label, multiline }: { value: string; label: string; multiline?: boolean }) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [ok, setOk] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); } catch { ref.current?.select(); }
    setOk(true); setTimeout(() => setOk(false), 1500);
  };
  return (
    <div className="copyrow">
      {multiline ? <textarea ref={ref} readOnly rows={3} value={value} aria-label={label} /> : <input ref={ref} readOnly value={value} aria-label={label} />}
      <button type="button" className="btn" onClick={copy}>{ok ? "Gekopieerd" : "Kopieer"}</button>
    </div>
  );
}
