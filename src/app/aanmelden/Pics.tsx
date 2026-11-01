// Simple line illustrations for the sign-up survey (decorative; the button text says it all).
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Printer({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="14" width="44" height="30" rx="6" {...S} />
      <path d="M10 14V4h24v10" {...S} />
      <path d="M12 44v8h20v-8" {...S} />
      <circle cx="36" cy="22" r="2" fill="currentColor" />
      {label && <text x="22" y="36" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{label}</text>}
    </g>
  );
}
function Ticket({ x, y }: { x: number; y: number }) {
  return <path transform={`translate(${x} ${y})`} d="M0 0h16v22l-2.7-2-2.6 2-2.7-2-2.6 2-2.7-2L0 22z" {...S} strokeWidth={1.6} />;
}
function Router({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="18" width="46" height="20" rx="5" {...S} />
      <path d="M10 18 4 4M36 18l6-14" {...S} />
      <circle cx="10" cy="28" r="1.8" fill="currentColor" /><circle cx="17" cy="28" r="1.8" fill="currentColor" />
    </g>
  );
}
function Plug({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="28" height="36" rx="6" {...S} />
      <circle cx="10" cy="14" r="1.8" fill="currentColor" /><circle cx="18" cy="14" r="1.8" fill="currentColor" />
      <rect x="9" y="22" width="10" height="7" rx="1.5" {...S} strokeWidth={1.6} />
    </g>
  );
}

export function PicOne() {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true">
      <Printer x={68} y={18} />
      <Ticket x={58} y={2} /><Ticket x={106} y={2} />
      <text x="90" y="86" textAnchor="middle" fontSize="10" fill="currentColor">keuken + bezorgbon</text>
    </svg>
  );
}
export function PicTwo() {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true">
      <Printer x={26} y={12} label="K" /><Printer x={110} y={12} label="B" />
      <text x="48" y="86" textAnchor="middle" fontSize="10" fill="currentColor">keuken</text>
      <text x="132" y="86" textAnchor="middle" fontSize="10" fill="currentColor">toog</text>
    </svg>
  );
}
export function PicCable() {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true">
      <Router x={8} y={22} />
      <path d="M54 54c22 0 24 4 44 4h14" {...S} />
      <Printer x={120} y={14} />
      <text x="86" y="86" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">max. 2 m</text>
    </svg>
  );
}
export function PicPowerline() {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true">
      <Router x={0} y={24} />
      <path d="M46 54h8" {...S} strokeWidth={1.6} />
      <Plug x={54} y={30} />
      <path d="M84 48q4-6 8 0t8 0" {...S} />
      <Plug x={102} y={30} />
      <path d="M130 54h4v-12" {...S} strokeWidth={1.6} />
      <Printer x={134} y={0} />
      <text x="90" y="86" textAnchor="middle" fontSize="10" fill="currentColor">via het stopcontact</text>
    </svg>
  );
}
export function PicUnknown() {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true">
      <circle cx="90" cy="42" r="28" {...S} />
      <path d="M81 35a9 9 0 1 1 13 8c-3 2-4 3-4 6" {...S} strokeWidth={2.4} />
      <circle cx="90" cy="57" r="1.8" fill="currentColor" />
    </svg>
  );
}
export function PicSelf() {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true">
      <path d="M60 26l30-14 30 14v40l-30 14-30-14z" {...S} />
      <path d="M60 26l30 14 30-14M90 40v40" {...S} />
      <path d="M75 19l30 14" {...S} strokeWidth={1.6} />
    </svg>
  );
}
export function PicVisit() {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true">
      <g transform="translate(12 8)"><path d="M28 52V36l12-10h34l16 14h16a6 6 0 0 1 6 6v6" {...S} />
      <path d="M28 52h96" {...S} />
      <circle cx="50" cy="56" r="8" {...S} /><circle cx="104" cy="56" r="8" {...S} />
      <path d="M48 28v12h24V28" {...S} strokeWidth={1.6} /></g>
    </svg>
  );
}
