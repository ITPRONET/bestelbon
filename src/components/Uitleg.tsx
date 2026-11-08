"use client";
import { useEffect, useRef, useState } from "react";

// Knop "Bekijk uitleg" met een korte video (ondertiteld, zonder geluid) in een venster.
export default function Uitleg({ video, title }: { video: "menu" | "verkoop" | "publicatie" | "instellingen"; title: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button type="button" className="btn uitleg-btn" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="currentColor" opacity=".15" /><path d="M10 8l6 4-6 4z" fill="currentColor" /></svg>
        Bekijk uitleg
      </button>
      <dialog ref={ref} className="uitleg" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === ref.current) setOpen(false); }} aria-label={title}>
        <div className="uitleg-head"><b>{title}</b><button type="button" className="btn btn-ghost small" onClick={() => setOpen(false)}>Sluiten</button></div>
        {open && <video src={`/uitleg/${video}.mp4`} poster={`/uitleg/${video}.jpg`} controls autoPlay playsInline preload="metadata" />}
      </dialog>
    </>
  );
}
