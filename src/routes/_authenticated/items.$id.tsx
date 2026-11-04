import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/inventory/StatusBadge";
import { StockActions } from "@/components/inventory/StockActions";
import { ItemFormSheet } from "@/components/inventory/ItemFormSheet";
import { ConfirmDelete } from "@/components/inventory/ConfirmDelete";
import { CodePreview } from "@/components/inventory/CodePreview";
import { useInventory } from "@/context/InventoryContext";
import { formatMoney, getStatus, itemValue } from "@/lib/inventory";
import { suggestedReorder } from "@/lib/asset-planning";
import { LabelButton } from "@/components/inventory/PlanningActions";
import { WarrantyAlerts } from "@/components/inventory/WarrantyAlerts";

export const Route = createFileRoute("/_authenticated/items/$id")({
  head: () => ({
    meta: [
      { title: "Item details — Stockroom Inventory Logger" },
      { name: "description", content: "Item details, barcode preview and stock movement history." },
      { property: "og:title", content: "Item details — Stockroom Inventory Logger" },
      { property: "og:description", content: "Item details, barcode preview and stock movement history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ItemDetail,
});

function ItemDetail() {
  const { id } = Route.useParams();
  const { items, movements, ready, deleteItem } = useInventory();
  const navigate = useNavigate();
  const item = items.find((i) => i.id === id);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const history = useMemo(() => movements.filter((m) => m.itemId === id).sort((a, b) => a.date.localeCompare(b.date)), [movements, id]);
  const chart = history.map((m) => ({ date: new Date(m.date).toLocaleDateString(), qty: m.resultingQty }));

  if (!ready) return <p className="text-muted-foreground">Loading…</p>;
  if (!item) return (
    <div className="py-20 text-center">
      <p className="font-medium">Item not found</p>
      <Button asChild variant="outline" className="mt-4"><Link to="/items">Back to items</Link></Button>
    </div>
  );

  const field = (label: string, value: React.ReactNode) => (
    <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-medium">{value === 0 ? 0 : value || <span className="text-muted-foreground">—</span>}</dd></div>
  );

  return (
    <>
      <Link to="/items" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Items</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{item.name}</h1>
          <div className="mt-2 flex items-center gap-2"><StatusBadge status={getStatus(item)} /><span className="font-mono text-xs text-muted-foreground">{item.sku}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StockActions item={item} />
          <LabelButton items={[item]} />
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" size="sm" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {field("Quantity", item.quantity)}
              {field("Unit price", formatMoney(item.unitPrice))}
              {field("Total value", formatMoney(itemValue(item)))}
              {field("Category", item.category)}
              {field("Location", item.location)}
              {field("Reorder level", item.reorderLevel)}
              {item.itemType !== "asset" && field("Suggested reorder quantity", suggestedReorder(item))}
              {field("Type", item.itemType === "asset" ? "Fixed asset" : "Inventory item")}
              {field("Barcode", item.barcode && <span className="font-mono">{item.barcode}</span>)}
              {field("QR code / asset tag", item.qrCode && <span className="font-mono">{item.qrCode}</span>)}
              {item.itemType === "asset" && <>
                {field("Purchase date", item.purchaseDate)}
                {field("Warranty expiry", item.warrantyExpiry)}
                {field("Assigned person", item.assignedPerson)}
                {field("Condition", item.condition)}
              </>}
            </dl>
            {item.notes && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{item.notes}</p>}
          </CardContent>
        </Card>
        <CodePreview barcode={item.barcode} qr={item.qrCode} />
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Quantity over time</CardTitle></CardHeader>
          <CardContent className="h-56">
            {chart.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={36} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Area type="stepAfter" dataKey="qty" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="grid h-full place-items-center text-sm text-muted-foreground">Not enough movements yet to draw a chart.</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Stock movement history</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {!history.length ? <p className="p-6 text-sm text-muted-foreground">No movements recorded.</p> : (
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-y bg-muted/50 text-left text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3 text-right">Change</th><th className="p-3 text-right">Result</th><th className="p-3">Reason</th><th className="p-3">Source</th></tr></thead>
                <tbody>
                  {[...history].reverse().map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="p-3">{new Date(m.date).toLocaleString()}</td>
                      <td className={`p-3 text-right font-medium tabular-nums ${m.change > 0 ? "text-success" : "text-destructive"}`}>{m.change > 0 ? "+" : ""}{m.change}</td>
                      <td className="p-3 text-right tabular-nums">{m.resultingQty}</td>
                      <td className="p-3">{m.reason ?? "—"}</td>
                      <td className="p-3 capitalize text-muted-foreground">{m.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
      {item.itemType === "asset" && <WarrantyAlerts items={[item]} />}
      <ItemFormSheet open={edit} onOpenChange={setEdit} item={item} />
      <ConfirmDelete item={del ? item : null} onCancel={() => setDel(false)} onConfirm={() => { deleteItem(item.id); toast.success(`Deleted ${item.name}`); navigate({ to: "/items" }); }} />
    </>
  );
}
