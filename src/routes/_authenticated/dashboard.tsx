import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, Boxes, Layers, Wallet, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/inventory/StatusBadge";
import { StockActions } from "@/components/inventory/StockActions";
import { useInventory } from "@/context/InventoryContext";
import { formatMoney, getStatus, itemValue } from "@/lib/inventory";
import { suggestedReorder } from "@/lib/asset-planning";
import { ReorderButton } from "@/components/inventory/PlanningActions";
import { WarrantyAlerts } from "@/components/inventory/WarrantyAlerts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stockroom Inventory Logger" },
      { name: "description", content: "Inventory value, stock levels and low stock alerts at a glance." },
      { property: "og:title", content: "Dashboard — Stockroom Inventory Logger" },
      { property: "og:description", content: "Inventory value, stock levels and low stock alerts at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Boxes; tone?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone ?? "bg-accent text-accent-foreground"}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate font-display text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { items, ready, hasSample, clearSample } = useInventory();
  const stats = useMemo(() => {
    const low = items.filter((i) => getStatus(i) === "low").length;
    const out = items.filter((i) => getStatus(i) === "out").length;
    const byCat: Record<string, number> = {};
    items.forEach((i) => (byCat[i.category] = (byCat[i.category] ?? 0) + itemValue(i)));
    return {
      units: items.reduce((s, i) => s + i.quantity, 0),
      value: items.reduce((s, i) => s + itemValue(i), 0),
      low, out,
      chart: Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      alerts: items.filter((i) => getStatus(i) !== "in").sort((a, b) => a.quantity - b.quantity),
    };
  }, [items]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Your stock at a glance"
        actions={<><ReorderButton items={items} />{hasSample && (
          <Button variant="outline" size="sm" onClick={() => { clearSample(); toast.success("Sample data cleared"); }}>
            <Trash2 className="h-4 w-4" /> Clear sample data
          </Button>
        )}</>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total items" value={ready ? String(items.length) : "—"} icon={Boxes} />
        <Stat label="Units in stock" value={ready ? stats.units.toLocaleString() : "—"} icon={Layers} />
        <Stat label="Inventory value" value={ready ? formatMoney(stats.value) : "—"} icon={Wallet} />
        <Stat label="Low / Out of stock" value={ready ? `${stats.low} / ${stats.out}` : "—"} icon={AlertTriangle} tone="bg-warning/20 text-warning-foreground dark:text-warning" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Inventory value by category</CardTitle></CardHeader>
          <CardContent className="h-72">
            {stats.chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chart} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} interval={0} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickFormatter={(v) => formatMoney(v)} width={70} />
                  <Tooltip formatter={(v) => formatMoney(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {stats.chart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length] ?? "var(--chart-1)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="grid h-full place-items-center text-sm text-muted-foreground">No items yet.</p>}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-warning" /> Low stock alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!stats.alerts.length && <p className="py-8 text-center text-sm text-muted-foreground">Everything is well stocked.</p>}
            {stats.alerts.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <Link to="/items/$id" params={{ id: i.id }} className="block truncate font-medium hover:underline">{i.name}</Link>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={getStatus(i)} /> {i.quantity} left · reorder at {i.reorderLevel}
                  </p>
                  {i.itemType !== "asset" && <p className="mt-1 text-xs text-muted-foreground">Suggested reorder: {suggestedReorder(i)} units</p>}
                </div>
                <StockActions item={i} compact />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <WarrantyAlerts items={items} />
    </>
  );
}
