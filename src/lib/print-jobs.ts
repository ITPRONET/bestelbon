import { after } from "next/server";
import { adminDb } from "./supabase";
import { sendOrderReceived } from "./order-mail";

/** Queue the tickets for an order: kitchen ticket(s), and for delivery a delivery ticket
 *  (on the delivery printer, or on the kitchen printer when there is none). */
export async function queueTickets(orderId: string, restaurantId: string, mode: "levering" | "afhalen") {
  const db = adminDb();
  const { data: printers } = await db.from("printers").select("id, role, copies").eq("restaurant_id", restaurantId);
  const all = printers ?? [];
  const kitchen = all.filter((p) => p.role === "keuken");
  const delivery = all.filter((p) => p.role === "bezorging");
  const jobs: { printer_id: string; order_id: string; restaurant_id: string; kind: "keuken" | "bezorging" }[] = [];
  for (const p of kitchen) for (let i = 0; i < p.copies; i++) jobs.push({ printer_id: p.id, order_id: orderId, restaurant_id: restaurantId, kind: "keuken" });
  if (mode === "levering") {
    const targets = delivery.length ? delivery : kitchen.slice(0, 1);
    for (const p of targets) for (let i = 0; i < (delivery.length ? p.copies : 1); i++) jobs.push({ printer_id: p.id, order_id: orderId, restaurant_id: restaurantId, kind: "bezorging" });
  }
  if (jobs.length) {
    await db.from("print_jobs").insert(jobs);
  } else {
    // Geen printer (testfase): de klant krijgt de bevestiging meteen.
    await db.from("orders").update({ customer_notified_at: new Date().toISOString() }).eq("id", orderId);
    after(() => sendOrderReceived(orderId).then(() => undefined));
  }
}
