import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, Boxes, Bot, FileSpreadsheet, History, Layers, LayoutDashboard,
  Lock, Menu, QrCode, Search, Users, Wallet, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StatusBadge } from "@/components/inventory/StatusBadge";
import { Logo, SiteFooter } from "@/components/layout/PublicShell";
import { useAuth } from "@/hooks/useAuth";

const TITLE = "Stockroom — Simple inventory & asset tracking for shops and offices";
const DESC = "Keep stock and assets organized: low-stock alerts, AI bulk entry, barcode and QR scanning, movement history and shared team workspaces.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#teams", label: "For teams" },
  { href: "#faq", label: "FAQ" },
];

const FEATURES = [
  { icon: LayoutDashboard, title: "Clear dashboard", text: "Total items, units and inventory value at a glance, with value by category." },
  { icon: AlertTriangle, title: "Low-stock alerts", text: "See what's running low or out, and restock in one click with undo." },
  { icon: Search, title: "Searchable table", text: "Find items by name, SKU, location or code, and filter by category and status." },
  { icon: Wand2, title: "Smart AI bulk entry", text: "Paste a messy list, upload a CSV, or a photo of an invoice or shelf list — review before saving." },
  { icon: Bot, title: "AI inventory assistant", text: "Ask what to reorder this week or what's tying up money. It answers from your data only." },
  { icon: QrCode, title: "Barcodes & QR codes", text: "Store barcodes and asset tags, print QR labels, and scan with your device camera." },
  { icon: History, title: "Stock movement history", text: "Every restock, sale, loss or correction is logged with date, amount and reason." },
  { icon: FileSpreadsheet, title: "CSV import & export", text: "Bring in your existing list with a preview step, and export filtered items any time." },
];

const ROLES: [string, string][] = [
  ["Owner", "Full control of the workspace, including deleting it."],
  ["Admin", "Manages members, settings and all items."],
  ["Manager", "Adds and edits items, orders stock."],
  ["Staff", "Records restocks and removals."],
  ["Viewer", "Can look, can't change anything."],
];

const FAQ: [string, string][] = [
  ["Is it free?", "Yes, you can create an account and start using Stockroom for free."],
  ["Can my staff use it on their phones?", "Yes. It works in any modern phone browser, has a bottom menu on small screens, and can be added to your home screen like an app."],
  ["Can I control what staff can see and do?", "Yes. Each member gets a role (Owner, Admin, Manager, Staff or Viewer), and you can hide prices from staff."],
  ["Can I import my existing list?", "Yes. Import a CSV with a preview that flags problems and duplicate SKUs, or use Smart Bulk Entry to turn pasted text, a PDF or a photo into items."],
  ["Does it scan barcodes?", "Yes. The Scan button uses your device camera to read barcodes and QR codes to look up an item or add stock. You can also type a code by hand or use a USB scanner."],
  ["Who owns my data?", "You do. A workspace's data is visible only to its members, you can export it to CSV at any time, and you can delete your account."],
];

const SAMPLE = [
  { name: "USB-C Hub", sku: "EL-104", qty: 3, status: "low" as const },
  { name: "Printer Paper A4", sku: "OS-220", qty: 0, status: "out" as const },
  { name: "Office Chair", sku: "FU-031", qty: 14, status: "in" as const },
];

function Landing() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  useEffect(() => {
    // Signed-in visitors and the installed app open straight into the dashboard.
    if ((!loading && user) || window.matchMedia("(display-mode: standalone)").matches) navigate({ to: "/dashboard", replace: true });
  }, [navigate, user, loading]);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Logo />
          <nav aria-label="Sections" className="hidden flex-1 justify-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">{l.label}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/signup">Get started</Link></Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetTitle>Menu</SheetTitle>
                <nav aria-label="Sections" className="mt-6 flex flex-col gap-1">
                  {LINKS.map((l) => (
                    <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 hover:bg-muted">{l.label}</a>
                  ))}
                  <Link to="/login" className="rounded-md px-3 py-2 hover:bg-muted">Sign in</Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Keep your stock and assets organized.</h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">For a shop, an office or your own things — know what you have, where it is, and what to reorder next.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg"><Link to="/signup">Get started free <ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
              <Link to="/login" className="text-sm font-medium underline-offset-4 hover:underline">Sign in</Link>
            </div>
          </div>
          <DashboardPreview />
        </section>

        <section id="features" className="scroll-mt-16 border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-display text-3xl font-semibold">Everything you need to track stock</h2>
            <p className="mt-2 text-muted-foreground">The same tools you'll use every day inside the app.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <Card key={title}>
                  <CardContent className="p-5">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="h-5 w-5" aria-hidden /></div>
                    <h3 className="mt-4 font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="teams" className="scroll-mt-16 py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-semibold">Built for teams</h2>
              <p className="mt-3 text-muted-foreground">Create a shared workspace for your shop or office so everyone works from the same list.</p>
              <ul className="mt-6 space-y-3 text-sm">
                <li className="flex gap-3"><Users className="h-5 w-5 shrink-0 text-primary" aria-hidden /> Invite people by email.</li>
                <li className="flex gap-3"><History className="h-5 w-5 shrink-0 text-primary" aria-hidden /> An activity log shows who changed what, and when.</li>
                <li className="flex gap-3"><Wallet className="h-5 w-5 shrink-0 text-primary" aria-hidden /> Hide prices and stock value from staff.</li>
              </ul>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Roles</CardTitle></CardHeader>
              <CardContent>
                <dl className="divide-y text-sm">
                  {ROLES.map(([r, d]) => (
                    <div key={r} className="flex gap-4 py-2.5"><dt className="w-20 shrink-0 font-medium">{r}</dt><dd className="text-muted-foreground">{d}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="how" className="scroll-mt-16 border-t bg-muted/30 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-display text-3xl font-semibold">How it works</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {["Create your account and workspace", "Add or import your items", "Invite your team and track stock"].map((s, i) => (
                <li key={s}>
                  <Card className="h-full"><CardContent className="p-5">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-primary font-display font-semibold text-primary-foreground">{i + 1}</span>
                    <p className="mt-4 font-semibold">{s}</p>
                  </CardContent></Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="privacy-h" className="py-16">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <Lock className="mx-auto h-8 w-8 text-primary" aria-hidden />
            <h2 id="privacy-h" className="mt-3 font-display text-3xl font-semibold">Your data stays yours</h2>
            <p className="mt-3 text-muted-foreground">Each workspace's data is private to its members. What people can see and change is controlled by their role. You can export your items at any time, and you can delete your account.</p>
          </div>
        </section>

        <section id="faq" className="scroll-mt-16 border-t py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="font-display text-3xl font-semibold">Questions</h2>
            <Accordion type="single" collapsible className="mt-6">
              {FAQ.map(([q, a]) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger>{q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-4xl rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground">
            <h2 className="font-display text-3xl font-semibold">Ready to get organized?</h2>
            <p className="mt-2 opacity-90">Set up your workspace in a few minutes.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary"><Link to="/signup">Get started free</Link></Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"><Link to="/login">Sign in</Link></Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function DashboardPreview() {
  const stats = [
    { label: "Total items", value: "128", icon: Boxes },
    { label: "Total units", value: "2,430", icon: Layers },
    { label: "Inventory value", value: "KSh 412,800", icon: Wallet },
    { label: "Low / out", value: "6", icon: AlertTriangle },
  ];
  return (
    <figure aria-label="Dashboard preview with sample data" className="relative rounded-2xl border bg-card p-4 shadow-lg">
      <figcaption className="absolute -top-3 right-4 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Sample data</figcaption>
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="h-4 w-4" aria-hidden /></div>
            <div className="min-w-0"><p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="truncate font-display font-semibold">{value}</p></div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border">
        <p className="border-b px-3 py-2 text-sm font-medium">Low stock alerts</p>
        <ul className="divide-y text-sm">
          {SAMPLE.map((s) => (
            <li key={s.sku} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0"><span className="block truncate font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{s.sku} · {s.qty} left</span></span>
              <StatusBadge status={s.status} />
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
