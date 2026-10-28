"use client";
import { useRef, useState } from "react";

/** Picks a photo, shrinks it in the browser (max 1200 px, JPEG) and submits the form. Phone photos of 5 MB become ~200 KB. */
export default function PhotoInput({ label = "Foto kiezen" }: { label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("x"))), "image/jpeg", 0.82));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "foto.jpg", { type: "image/jpeg" }));
      e.target.files = dt.files;
      e.target.form?.requestSubmit();
    } catch {
      setBusy(false);
      setErr("Deze foto kon niet worden gelezen. Probeer een JPG of PNG.");
    }
  }
  return (
    <span style={{ display: "inline-grid", gap: 4 }}>
      <label className="btn" style={{ cursor: "pointer" }}>
        {busy ? "Uploaden…" : label}
        <input ref={ref} type="file" name="photo" accept="image/*" onChange={onChange} hidden />
      </label>
      {err && <span className="err small">{err}</span>}
    </span>
  );
}
