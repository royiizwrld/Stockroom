import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, FileUp, Loader2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/PageHeader";
import { useInventory } from "@/context/InventoryContext";
import { extractItems } from "@/lib/ai.functions";
import { DEFAULT_REORDER_LEVEL, findMatch, generateSku } from "@/lib/inventory";
import type { ItemType } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/bulk")({
  head: () => ({
    meta: [
      { title: "Smart Bulk Entry — Stockroom Inventory Logger" },
      { name: "description", content: "Paste text or upload an invoice photo, PDF or CSV and let AI turn it into inventory items." },
      { property: "og:title", content: "Smart Bulk Entry — Stockroom Inventory Logger" },
      { property: "og:description", content: "Paste text or upload an invoice photo, PDF or CSV and let AI turn it into inventory items." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BulkPage,
});

interface Row {
  key: string; name: string; quantity: number; unitPrice: number; category: string; location: string;
  sku: string; qrCode: string; itemType: ItemType; confidence: number; matchId?: string | undefined; mode: "new" | "merge";
}

const EXAMPLE = "20 A4 paper reams @ 650 shelf B2, 5 office chairs 8500 each store room, HDMI cables x30 - 400, laptop Dell Latitude asset tag LT-014 45000";

async function pdfToText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = "";
  for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    out += tc.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
  }
  return out;
}

const readDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

function BulkPage() {
  const inv = useInventory();
  const navigate = useNavigate();
  const extract = useServerFn(extractItems);
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const onFile = async (f: File) => {
    setError("");
    try {
      if (f.type.startsWith("image/")) {
        if (f.size > 8_000_000) { toast.error("Image is too large (max 8 MB)."); return; }
        setImage({ url: await readDataUrl(f), name: f.name });
      } else if (f.type === "application/pdf" || f.name.endsWith(".pdf")) {
        setText(await pdfToText(f)); setFileName(f.name);
      } else {
        setText(await f.text()); setFileName(f.name);
      }
    } catch {
      toast.error("Couldn't read that file.");
    }
  };

  const run = async () => {
    setLoading(true); setError("");
    try {
      const res = await extract({ data: { text, imageDataUrl: image?.url, categories: inv.categories, locations: inv.locations } });
      if (!res.ok) { setError(res.error); return; }
      const skus = inv.items.map((i) => i.sku);
      setRows(res.items.map((r, idx) => {
        const match = findMatch(inv.items, r.name, r.sku || undefined);
        const category = inv.categories.find((c) => c.toLowerCase() === r.category.toLowerCase()) ?? "Other";
        const sku = r.sku || generateSku(r.name, skus);
        skus.push(sku);
        return { key: `${idx}-${r.name}`, ...r, category, sku, quantity: Math.max(0, Math.round(r.quantity)), unitPrice: Math.max(0, r.unitPrice), matchId: match?.id, mode: match ? "merge" : "new" };
      }));
    } catch {
      setError("We couldn't reach the AI. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const upd = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    const newSkus = rows.filter((r) => r.mode === "new").map((r) => r.sku.toLowerCase());
    if (rows.some((r) => !r.name.trim() || r.quantity < 0 || r.unitPrice < 0)) { toast.error("Fix rows with missing names or negative values."); return; }
    if (new Set(newSkus).size !== newSkus.length || rows.some((r) => r.mode === "new" && inv.isSkuTaken(r.sku))) { toast.error("Some SKUs are duplicated. Edit them or choose 'Add quantity'."); return; }
    let added = 0, merged = 0;
    for (const r of rows) {
      if (r.mode === "merge" && r.matchId) {
        if (r.quantity > 0) inv.adjustStock(r.matchId, r.quantity, { reason: "Purchase", source: "bulk" });
        merged++;
      } else {
        inv.addItem({ name: r.name.trim(), sku: r.sku.trim(), category: r.category, quantity: r.quantity, unitPrice: r.unitPrice, location: r.location, reorderLevel: DEFAULT_REORDER_LEVEL, notes: "", itemType: r.itemType, barcode: "", qrCode: r.qrCode }, "bulk");
        added++;
      }
    }
    toast.success(`Saved: ${added} new, ${merged} updated`);
    navigate({ to: "/items" });
  };

  return (
    <>
      <PageHeader title="Smart Bulk Entry" subtitle="Paste messy text or upload a CSV, PDF or photo. Nothing is saved until you confirm." />
      <Card className="mb-6">
        <CardContent className="space-y-3 p-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={EXAMPLE} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <FileUp className="h-4 w-4" /> Upload CSV, PDF or photo
              <input type="file" className="hidden" accept=".csv,.txt,.pdf,image/*" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
            {!text && <Button variant="ghost" size="sm" onClick={() => setText(EXAMPLE)}>Try example</Button>}
            {fileName && <span className="text-xs text-muted-foreground">Loaded {fileName}</span>}
            {image && (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <img src={image.url} alt="" className="h-10 w-10 rounded object-cover" /> {image.name}
                <button onClick={() => setImage(null)} aria-label="Remove image"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            )}
            <Button className="ml-auto" onClick={run} disabled={loading || (!text.trim() && !image)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Extract items
            </Button>
          </div>
          {error && <p className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr><th className="p-2">Name</th><th className="p-2 w-20">Qty</th><th className="p-2 w-28">Unit price</th><th className="p-2">Category</th><th className="p-2">Location</th><th className="p-2">SKU</th><th className="p-2">Type</th><th className="p-2">Match</th><th className="p-2" /></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const match = r.matchId ? inv.items.find((i) => i.id === r.matchId) : undefined;
                  const low = r.confidence < 0.6;
                  return (
                    <tr key={r.key} className={`border-b ${low ? "bg-warning/15" : ""}`}>
                      <td className="p-2">
                        <Input value={r.name} onChange={(e) => upd(r.key, { name: e.target.value })} className="h-8" />
                        {low && <span className="mt-1 flex items-center gap-1 text-xs text-warning-foreground dark:text-warning"><AlertTriangle className="h-3 w-3" /> Low confidence — please check</span>}
                      </td>
                      <td className="p-2"><Input type="number" min={0} value={r.quantity} onChange={(e) => upd(r.key, { quantity: Number(e.target.value) })} className="h-8" /></td>
                      <td className="p-2"><Input type="number" min={0} value={r.unitPrice} onChange={(e) => upd(r.key, { unitPrice: Number(e.target.value) })} className="h-8" /></td>
                      <td className="p-2">
                        <select value={r.category} onChange={(e) => upd(r.key, { category: e.target.value })} className="h-8 w-full rounded-md border bg-background px-2">
                          {inv.categories.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><Input value={r.location} onChange={(e) => upd(r.key, { location: e.target.value })} className="h-8" /></td>
                      <td className="p-2"><Input value={r.sku} onChange={(e) => upd(r.key, { sku: e.target.value })} className="h-8 font-mono text-xs" disabled={r.mode === "merge"} /></td>
                      <td className="p-2">
                        <select value={r.itemType} onChange={(e) => upd(r.key, { itemType: e.target.value as ItemType })} className="h-8 rounded-md border bg-background px-2">
                          <option value="inventory">Inventory</option><option value="asset">Asset</option>
                        </select>
                      </td>
                      <td className="p-2">
                        {match ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Looks like <b>{match.name}</b> ({match.quantity})</p>
                            <select value={r.mode} onChange={(e) => upd(r.key, { mode: e.target.value as Row["mode"] })} className="h-8 w-full rounded-md border bg-background px-2 text-xs">
                              <option value="merge">Add quantity to existing</option><option value="new">Add as new</option>
                            </select>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">New item</span>}
                      </td>
                      <td className="p-2"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Delete row"><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 p-3">
            <Button variant="outline" onClick={() => setRows([])}>Discard</Button>
            <Button onClick={save}>Confirm & Save {rows.length} rows</Button>
          </div>
        </Card>
      )}
    </>
  );
}
