import type { InventoryState, Item, Movement } from "./types";
import { DEFAULT_CATEGORIES, DEFAULT_LOCATIONS, uid } from "./inventory";

const FLAG = "stockroom:demo";
const DATA = "stockroom:demo-data";
export const DEMO_WORKSPACE_ID = "demo-workspace";

export const isDemo = () => typeof window !== "undefined" && sessionStorage.getItem(FLAG) === "1";
export function startDemo() { sessionStorage.setItem(FLAG, "1"); sessionStorage.removeItem(DATA); }
export function endDemo() { sessionStorage.removeItem(FLAG); sessionStorage.removeItem(DATA); }

export function loadDemoState(): InventoryState {
  try { const raw = sessionStorage.getItem(DATA); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  const s = makeDemoState(); saveDemoState(s); return s;
}
export function saveDemoState(s: InventoryState) { sessionStorage.setItem(DATA, JSON.stringify(s)); }

/** Isolated guest workspace: lives only in this browser tab, never touches the cloud. */
export function makeDemoState(now = Date.now()): InventoryState {
  const d = (n: number) => new Date(now - n * 86400000).toISOString();
  const fx = (amt: number, cur: string, rate: number) => `Bought at ${cur} ${amt.toFixed(2)}, converted at 1 ${cur} = ${rate} (sample rate).`;
  const raw: Array<Partial<Item> & Pick<Item, "name" | "sku" | "category" | "quantity" | "unitPrice" | "location" | "reorderLevel">> = [
    { name: "USB-C Hub 7-in-1", sku: "TEC-HUB-001", category: "Tech Accessories", quantity: 3, unitPrice: 3230, location: "Shelf A1", reorderLevel: 8, barcode: "6971234500011", notes: fx(25, "USD", 129.2) },
    { name: "Wireless Mouse", sku: "TEC-MOU-002", category: "Tech Accessories", quantity: 18, unitPrice: 1550, location: "Shelf A1", reorderLevel: 6, notes: fx(12, "USD", 129.2) },
    { name: "Laptop Stand Aluminium", sku: "TEC-STD-003", category: "Tech Accessories", quantity: 0, unitPrice: 4180, location: "Shelf A2", reorderLevel: 3, notes: fx(28, "EUR", 149.3) },
    { name: "A4 Paper Ream", sku: "OFF-A4-004", category: "Office Supplies", quantity: 4, unitPrice: 650, location: "Store Room", reorderLevel: 12 },
    { name: "Sticky Notes (pack)", sku: "OFF-STK-005", category: "Office Supplies", quantity: 60, unitPrice: 180, location: "Store Room", reorderLevel: 15 },
    { name: "Ballpoint Pens (box)", sku: "OFF-PEN-006", category: "Office Supplies", quantity: 2, unitPrice: 250, location: "Store Room", reorderLevel: 5 },
    { name: "Ergonomic Office Chair", sku: "FUR-CHR-007", category: "Furniture", quantity: 6, unitPrice: 14950, location: "Warehouse", reorderLevel: 2, notes: fx(92, "GBP", 162.5) },
    { name: "Dell Latitude 5540 Laptop", sku: "TEC-LAP-008", category: "Tech Accessories", quantity: 1, unitPrice: 129200, location: "Office", reorderLevel: 0, itemType: "asset", qrCode: "LT-014", assignedPerson: "Front desk", condition: "Good", purchaseDate: d(300).slice(0, 10), warrantyExpiry: d(-20).slice(0, 10), notes: fx(1000, "USD", 129.2) },
    { name: "Wi-Fi Router AX3000", sku: "NET-RTR-009", category: "Networking", quantity: 2, unitPrice: 9690, location: "Office", reorderLevel: 1, itemType: "asset", qrCode: "NET-002", condition: "Good", notes: fx(75, "USD", 129.2) },
    { name: "Cordless Drill", sku: "TOO-DRL-010", category: "Tools", quantity: 0, unitPrice: 6200, location: "Warehouse", reorderLevel: 1 },
  ];
  const items: Item[] = raw.map((r, i) => ({ id: uid() + i, notes: "", itemType: "inventory", barcode: "", qrCode: "", ...r, sample: true, createdAt: d(90), updatedAt: d(1) }));
  const by = (sku: string) => items.find((i) => i.sku === sku)!;
  const movements: Movement[] = [];
  const add = (sku: string, days: number, change: number, reason: Movement["reason"], note?: string) => {
    const it = by(sku);
    movements.push({ id: uid(), itemId: it.id, itemName: it.name, date: d(days), change, resultingQty: 0, reason, note, source: change > 0 ? "restock" : "remove" });
  };
  // Purchase order history (received orders)
  add("TEC-HUB-001", 45, 20, "Purchase", "Received on PO-0001"); add("TEC-MOU-002", 45, 20, "Purchase", "Received on PO-0001");
  add("OFF-A4-004", 30, 25, "Purchase", "Received on PO-0002"); add("OFF-PEN-006", 30, 10, "Purchase", "Received on PO-0002");
  add("TEC-STD-003", 21, 6, "Purchase", "Received on PO-0003");
  add("TEC-HUB-001", 20, -7, "Sale"); add("TEC-HUB-001", 9, -6, "Sale"); add("TEC-HUB-001", 3, -4, "Sale");
  add("TEC-MOU-002", 12, -2, "Sale"); add("OFF-A4-004", 18, -11, "Sale"); add("OFF-A4-004", 5, -10, "Sale");
  add("OFF-PEN-006", 8, -8, "Sale"); add("TEC-STD-003", 10, -5, "Sale"); add("TEC-STD-003", 2, -1, "Damaged");
  add("TOO-DRL-010", 15, -1, "Lost");
  for (const it of items) {
    let q = it.quantity;
    for (const m of movements.filter((m) => m.itemId === it.id).sort((a, b) => b.date.localeCompare(a.date))) { m.resultingQty = q; q -= m.change; }
  }
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...items.map((i) => i.category)]));
  const locations = Array.from(new Set([...DEFAULT_LOCATIONS, "Shelf A2", "Warehouse"]));
  return { items, categories, locations, movements };
}
