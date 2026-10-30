"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PostcodeForm({ initial }: { initial?: string }) {
  const router = useRouter();
  const [pc, setPc] = useState(initial ?? "");
  const [last, setLast] = useState("");
  useEffect(() => {
    try {
      if (initial) localStorage.setItem("bb_pc", initial);
      else setLast(localStorage.getItem("bb_pc") ?? "");
    } catch { /* ignore */ }
  }, [initial]);
  const go = (v: string) => { if (/^\d{4}$/.test(v)) router.push(`/bestellen/${v}`); };
  return (
    <form className="g-form" onSubmit={(e) => { e.preventDefault(); go(pc); }}>
      <label className="sr" htmlFor="pc">Postcode</label>
      <input id="pc" value={pc} onChange={(e) => setPc(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="postal-code" placeholder="Je postcode, bv. 2180" />
      <button disabled={pc.length !== 4}>Zoeken</button>
      {!initial && last && <button type="button" className="g-last" onClick={() => go(last)}>Vorige keer: {last}</button>}
    </form>
  );
}
