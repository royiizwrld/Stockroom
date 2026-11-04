import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Download, FileSpreadsheet, FileText, MoreHorizontal, Pencil, Plus, Printer, Search, SearchX, Trash2, Upload, X } from "lucide-react";
import { inventoryPdf, printPdf } from "@/lib/inventory-documents";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/inventory/StatusBadge";
import { StockActions } from "@/components/inventory/StockActions";
import { ItemFormSheet } from "@/components/inventory/ItemFormSheet";
import { ConfirmDelete } from "@/components/inventory/ConfirmDelete";
import { CsvImportDialog } from "@/components/inventory/CsvImportDialog";
import { LabelButton, ReorderButton } from "@/components/inventory/PlanningActions";
import { useInventory } from "@/context/InventoryContext";
import { formatMoney, getStatus, itemValue, itemsToCsv, matchesSearch, STATUS_LABEL } from "@/lib/inventory";
import type { Item, StockStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/items/")({
  head: () => ({
    meta: [
      { title: "Items — Stockroom Inventory Logger" },
      { name: "description", content: "Search, filter, sort and manage every inventory item and asset." },
      { property: "og:title", content: "Items — Stockroom Inventory Logger" },
      { property: "og:description", content: "Search, filter, sort and manage every inventory item and asset." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ItemsPage,
});

type SortKey = "name" | "sku" | "category" | "quantity" | "unitPrice" | "value" | "location" | "status";
const STATUS_ORDER: Record<StockStatus, number> = { out: 0, low: 1, in: 2 };

function ItemsPage() {
  const { items, categories, deleteItem } = useInventory();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [editing, setEditing] = useState<Item | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const list = items.filter((i) => matchesSearch(i, q) && (cat === "all" || i.category === cat) && (status === "all" || getStatus(i) === status));
    const val = (i: Item): string | number =>
      sort.key === "value" ? itemValue(i) : sort.key === "status" ? STATUS_ORDER[getStatus(i)] : (i[sort.key] as string | number);
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [items, q, cat, status, sort]);

  const filtersOn = q || cat !== "all" || status !== "all";
  const clear = () => { setQ(""); setCat("all"); setStatus("all"); };

  const exportCsv = () => {
    const blob = new Blob([itemsToCsv(filtered)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${filtered.length} items`);
  };

  const [busy, setBusy] = useState(false);
  const pdfAction = async (print: boolean) => {
    setBusy(true);
    try {
      const doc = await inventoryPdf(filtered);
      if (print) printPdf(doc);
      else { doc.save(`inventory-${new Date().toISOString().slice(0, 10)}.pdf`); toast.success(`Exported ${filtered.length} items as PDF`); }
    } catch { toast.error(print ? "Could not open the print view. Allow pop-ups and try again." : "Could not create the PDF. Please try again."); }
    finally { setBusy(false); }
  };

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`p-3 font-medium ${right ? "text-right" : "text-left"}`}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : 1 }))}>
        {label}
        {sort.key === k ? (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Items"
        subtitle={`${filtered.length} of ${items.length} items`}
        actions={<>
          <LabelButton items={filtered} />
          <ReorderButton items={filtered} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Upload className="h-4 w-4" /> Import <ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setImportOpen(true)}><FileSpreadsheet className="h-4 w-4" /> Import CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigate({ to: "/bulk" })}><FileText className="h-4 w-4" /> Import PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!filtered.length || busy}><Download className="h-4 w-4" /> {busy ? "Preparing…" : "Export"} <ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportCsv}><FileSpreadsheet className="h-4 w-4" /> Export CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void pdfAction(false)}><FileText className="h-4 w-4" /> Export PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void pdfAction(true)}><Printer className="h-4 w-4" /> Print list</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" /> Add item</Button>
        </>}
      />
      <Card className="mb-4 flex flex-col gap-3 p-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, location, barcode or asset tag" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(["in", "low", "out"] as StockStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        {filtersOn && <Button variant="ghost" onClick={clear}><X className="h-4 w-4" /> Clear filters</Button>}
      </Card>

      <Card className="overflow-hidden">
        {!filtered.length ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{items.length ? "No items match your filters" : "No items yet"}</p>
            {filtersOn ? <Button variant="outline" size="sm" onClick={clear}>Clear filters</Button>
              : <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>Add your first item</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <Th k="name" label="Name" /><Th k="sku" label="SKU" /><Th k="category" label="Category" />
                  <Th k="quantity" label="Qty" right /><Th k="unitPrice" label="Unit price" right /><Th k="value" label="Value" right />
                  <Th k="location" label="Location" /><Th k="status" label="Status" /><th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const st = getStatus(i);
                  return (
                    <tr key={i.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => navigate({ to: "/items/$id", params: { id: i.id } })}>
                      <td className="p-3 font-medium">{i.name}{i.itemType === "asset" && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-secondary-foreground">Asset</span>}</td>
                      <td className="p-3 font-mono text-xs">{i.sku}</td>
                      <td className="p-3">{i.category}</td>
                      <td className="p-3 text-right tabular-nums">{i.quantity}</td>
                      <td className="p-3 text-right tabular-nums">{formatMoney(i.unitPrice)}</td>
                      <td className="p-3 text-right tabular-nums">{formatMoney(itemValue(i))}</td>
                      <td className="p-3">{i.location || <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-3"><StatusBadge status={st} /></td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <StockActions item={i} showRestock={st !== "in"} compact />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditing(i); setFormOpen(true); }}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(i)}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ItemFormSheet open={formOpen} onOpenChange={setFormOpen} item={editing} />
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDelete item={toDelete} onCancel={() => setToDelete(null)} onConfirm={() => { if (toDelete) { deleteItem(toDelete.id); toast.success(`Deleted ${toDelete.name}`); } setToDelete(null); }} />
    </>
  );
}
