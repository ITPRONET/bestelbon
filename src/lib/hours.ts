// Opening hours in Europe/Brussels. weekday: 0 = zondag … 6 = zaterdag. A shift may run past midnight.
export type HourRow = { weekday: number; opens: string; closes: string };
export type Zone = { postcode: string; fee_cents: number; min_order_cents: number };

const WEEK = 7 * 1440;
export const DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const hhmm = (m: number) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, "0")}`;

/** Minutes since Sunday 00:00, Brussels time. */
export function weekMinute(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "0";
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v("weekday")) * 1440 + Number(v("hour")) * 60 + Number(v("minute"));
}

function windows(rows: HourRow[]) {
  return rows.flatMap((r) => {
    const o = r.weekday * 1440 + toMin(r.opens);
    let c = r.weekday * 1440 + toMin(r.closes);
    if (c <= o) c += 1440;
    return [-WEEK, 0, WEEK].map((s) => [o + s, c + s] as [number, number]);
  }).sort((a, b) => a[0] - b[0]);
}

export type OpenState = {
  always: boolean; open: boolean; closesAt?: number; next?: [number, number];
  /** Text for the storefront, e.g. "Open tot 21:30" or "Gesloten · opent morgen om 11:30". */
  label: string;
  /** Pre-ordering is possible because the next shift starts later today. */
  preorder: boolean;
};

export function openState(rows: HourRow[], now = weekMinute()): OpenState {
  if (!rows.length) return { always: true, open: true, label: "", preorder: false };
  const ws = windows(rows);
  const cur = ws.find(([o, c]) => o <= now && now < c);
  if (cur) return { always: false, open: true, closesAt: cur[1], label: `Open tot ${hhmm(cur[1])}`, preorder: false };
  const next = ws.find(([o]) => o > now);
  if (!next) return { always: false, open: false, label: "Gesloten", preorder: false };
  const dayDiff = Math.floor(next[0] / 1440) - Math.floor(now / 1440);
  const when = dayDiff === 0 ? "vandaag" : dayDiff === 1 ? "morgen" : DAYS[((Math.floor(next[0] / 1440) % 7) + 7) % 7];
  return { always: false, open: false, next, label: `Gesloten · opent ${when} om ${hhmm(next[0])}`, preorder: dayDiff === 0 };
}

/** Times the customer may choose. "Zo snel mogelijk" only while open. Slots every 15 minutes. */
export function timeSlots(rows: HourRow[], prep: number, now = weekMinute()): string[] {
  const st = openState(rows, now);
  if (st.always) return ["Zo snel mogelijk"];
  let from: number, to: number;
  if (st.open) { from = now + prep; to = st.closesAt!; }
  else if (st.preorder) { from = Math.max(st.next![0], now + prep); to = st.next![1]; }
  else return [];
  const out = st.open ? ["Zo snel mogelijk"] : [];
  for (let m = Math.ceil(from / 15) * 15; m <= to; m += 15) out.push(hhmm(m));
  return out;
}

export const cleanPostcode = (p: string) => p.replace(/\D/g, "").slice(0, 4);
export const findZone = (zones: Zone[], postcode: string) => zones.find((z) => z.postcode === cleanPostcode(postcode));
