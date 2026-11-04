import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Mail, PackageCheck, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { useInventory } from "@/context/InventoryContext";
import { orderTotals, reorderLines, type OrderLine } from "@/lib/asset-planning";
import { formatCurrency, getCurrency } from "@/lib/currency";
import { purchaseOrderPdf, printPdf, type SupplierInfo } from "@/lib/inventory-documents";

export const Route = createFileRoute("/_authenticated/reorder")({
  head: () => ({
    meta: [
      { title: "Supplier Order — Stockroom Inventory Logger" },
      { name: "description", content: "Edit reorder quantities, fill in supplier details and send a purchase order PDF." },
      { property: "og:title", content: "Supplier Order — Stockroom Inventory Logger" },
      { property: "og:description", content: "Edit reorder quantities, fill in supplier details and send a purchase order PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReorderPage,
});

const SUPPLIER_KEY = "stockroom:supplier";
const PO_KEY = "stockroom:po-counter";
const blankInfo: SupplierInfo = { company: "", supplier: "", email: "", poNumber: "PO-0001", deliveryDate: "", terms: "", notes: "" };
const poLabel = (n: number) => `PO-${String(n).padStart(4, "0")}`;

function ReorderPage() {
  const inv = useInventory();
  const [lines, setLines] = useState<OrderLine[] | null>(null);
  const [info, setInfo] = useState<SupplierInfo>(blankInfo);
  const [tax, setTax] = useState("0");
  const [shipping, setShipping] = useState("0");
  const [busy, setBusy] = useState(false);
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [adding, setAdding] = useState("");

  const suggested = () => reorderLines(inv.items).map(({ item, qty }) => ({ itemId: item.id, name: item.name, sku: item.sku, qty, unitCost: item.unitPrice }));

  useEffect(() => {
    if (!inv.ready || lines) return;
    setLines(suggested());
    try {
      const saved = JSON.parse(localStorage.getItem(SUPPLIER_KEY) ?? "{}");
      const n = Number(localStorage.getItem(PO_KEY) ?? "1") || 1;
      setInfo({ ...blankInfo, ...saved, poNumber: poLabel(n), deliveryDate: "", notes: "" });
    } catch { /* keep blank */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.ready]);

  const rows = lines ?? [];
  const taxN = Math.max(0, Number(tax) || 0);
  const shipN = Math.max(0, Number(shipping) || 0);
  const totals = orderTotals(rows, taxN, shipN);
  const available = useMemo(() => inv.items.filter((i) => !rows.some((r) => r.itemId === i.id)), [inv.items, rows]);
  const setInfoField = (k: keyof SupplierInfo, v: string) => setInfo((p) => ({ ...p, [k]: v }));
  const update = (id: string, patch: Partial<OrderLine>) => setLines((ls) => (ls ?? []).map((l) => (l.itemId === id ? { ...l, ...patch } : l)));
  const saveSupplier = () => { const { company, supplier, email, terms } = info; localStorage.setItem(SUPPLIER_KEY, JSON.stringify({ company, supplier, email, terms })); };
  const valid = rows.filter((l) => l.qty > 0);

  const pdf = async (print: boolean) => {
    if (!valid.length) { toast.error("Add at least one item with a quantity"); return; }
    setBusy(true);
    try {
      saveSupplier();
      const doc = await purchaseOrderPdf(info, valid, taxN, shipN);
      if (print) printPdf(doc); else doc.save(`${info.poNumber}.pdf`);
    } catch { toast.error(print ? "Could not open the print view. Allow pop-ups and try again." : "Could not create the PDF. Please try again."); }
    finally { setBusy(false); }
  };

  const email = () => {
    if (!valid.length) { toast.error("Add at least one item with a quantity"); return; }
    if (!info.email.trim()) { toast.error("Enter the supplier's email first"); return; }
    saveSupplier();
    const cur = getCurrency();
    const body = [`Hello ${info.supplier || ""},`, "", `Please supply the following (order ${info.poNumber}):`, "",
      ...valid.map((l) => `- ${l.name} (${l.sku}): ${l.qty} × ${cur} ${l.unitCost.toFixed(2)} = ${cur} ${(l.qty * l.unitCost).toFixed(2)}`), "",
      `Subtotal: ${formatCurrency(totals.subtotal)}`, `Tax: ${formatCurrency(totals.tax)}`, `Shipping: ${formatCurrency(totals.shipping)}`, `Total: ${formatCurrency(totals.total)}`,
      ...(info.deliveryDate ? [`Delivery by: ${info.deliveryDate}`] : []), ...(info.terms ? [`Terms: ${info.terms}`] : []), ...(info.notes ? ["", info.notes] : []), "",
      "The PDF purchase order is attached.", "", `Thanks,`, info.company || ""].join("\n");
    window.location.href = `mailto:${encodeURIComponent(info.email.trim())}?subject=${encodeURIComponent(`Purchase order ${info.poNumber}${info.company ? ` from ${info.company}` : ""}`)}&body=${encodeURIComponent(body)}`;
    toast.message("Your email app is opening — download the PDF and attach it.");
  };

  const receive = () => {
    for (const l of valid) inv.adjustStock(l.itemId, l.qty, { reason: "Purchase", source: "restock", note: `Received order ${info.poNumber}` });
    const next = (Number(localStorage.getItem(PO_KEY) ?? "1") || 1) + 1;
    localStorage.setItem(PO_KEY, String(next));
    toast.success(`Received ${valid.length} item${valid.length === 1 ? "" : "s"} into stock`);
    setConfirmReceive(false);
    setLines(null);
    setInfo((p) => ({ ...p, poNumber: poLabel(next), deliveryDate: "", notes: "" }));
  };

  useEffect(() => { if (inv.ready && lines === null) setLines(suggested()); /* refill after receiving */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, inv.items]);

  return (
    <div>
      <PageHeader title="Supplier order" subtitle={`Edit quantities and costs, then send a purchase order. Amounts in ${getCurrency()}.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Order lines</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLines(suggested())}><RotateCcw className="h-4 w-4" /> Reset to suggestions</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {!rows.length ? <p className="text-sm text-muted-foreground">Nothing needs reordering. Add any item below.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Unit cost</th><th className="p-2 text-right">Amount</th><th /></tr></thead>
                <tbody>{rows.map((l) => (
                  <tr key={l.itemId} className="border-b">
                    <td className="p-2">{l.name}<p className="font-mono text-xs text-muted-foreground">{l.sku}</p></td>
                    <td className="p-2"><Input aria-label={`Quantity for ${l.name}`} type="number" min={0} step={1} className="h-8 w-20" value={l.qty} onChange={(e) => { const n = Math.floor(Number(e.target.value)); if (Number.isFinite(n) && n >= 0) update(l.itemId, { qty: n }); }} /></td>
                    <td className="p-2"><Input aria-label={`Unit cost for ${l.name}`} type="number" min={0} step="0.01" className="h-8 w-28" value={l.unitCost} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) update(l.itemId, { unitCost: n }); }} /></td>
                    <td className="p-2 text-right tabular-nums">{formatCurrency(l.qty * l.unitCost)}</td>
                    <td className="p-2"><Button variant="ghost" size="icon" aria-label={`Remove ${l.name}`} onClick={() => setLines(rows.filter((r) => r.itemId !== l.itemId))}><Trash2 className="h-4 w-4" /></Button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
            <div className="flex gap-2">
              <Select value={adding} onValueChange={setAdding}>
                <SelectTrigger aria-label="Add another item"><SelectValue placeholder="Add another item…" /></SelectTrigger>
                <SelectContent>{available.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.sku})</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" disabled={!adding} onClick={() => { const i = inv.items.find((x) => x.id === adding); if (i) setLines([...rows, { itemId: i.id, name: i.name, sku: i.sku, qty: Math.max(1, i.reorderLevel), unitCost: i.unitPrice }]); setAdding(""); }}><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="tax">Tax (%)</Label><Input id="tax" type="number" min={0} step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ship">Shipping ({getCurrency()})</Label><Input id="ship" type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} /></div>
            </div>
            <dl className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatCurrency(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{formatCurrency(totals.tax)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd className="tabular-nums">{formatCurrency(totals.shipping)}</dd></div>
              <div className="flex justify-between border-t pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatCurrency(totals.total)}</dd></div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Supplier & order details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([["company", "Your business name"], ["supplier", "Supplier name"], ["email", "Supplier email"], ["poNumber", "Order number"], ["terms", "Payment terms (e.g. Net 30)"]] as const).map(([k, label]) => (
              <div key={k} className="space-y-1.5"><Label htmlFor={k}>{label}</Label><Input id={k} type={k === "email" ? "email" : "text"} value={info[k]} onChange={(e) => setInfoField(k, e.target.value)} /></div>
            ))}
            <div className="space-y-1.5"><Label htmlFor="deliveryDate">Deliver by</Label><Input id="deliveryDate" type="date" value={info.deliveryDate} onChange={(e) => setInfoField("deliveryDate", e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={3} value={info.notes} onChange={(e) => setInfoField("notes", e.target.value)} /></div>
            <div className="grid gap-2 pt-2">
              <Button disabled={busy} onClick={() => pdf(false)}><FileText className="h-4 w-4" /> Download PDF order</Button>
              <Button variant="outline" disabled={busy} onClick={() => pdf(true)}>Print order</Button>
              <Button variant="outline" onClick={email}><Mail className="h-4 w-4" /> Email supplier</Button>
              <Button variant="secondary" disabled={!valid.length} onClick={() => setConfirmReceive(true)}><PackageCheck className="h-4 w-4" /> Mark order as received</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={confirmReceive} onOpenChange={setConfirmReceive}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Add this order to stock?</AlertDialogTitle>
            <AlertDialogDescription>{valid.map((l) => `${l.name} +${l.qty}`).join(", ")}. Each change is saved in the stock history.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={receive}>Add to stock</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
