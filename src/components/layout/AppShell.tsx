import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useInventory } from "@/context/InventoryContext";
import { ROLE_LABEL } from "@/lib/workspace-roles";
import { arePricesHidden } from "@/lib/currency";
import { LogOut, Boxes, Users, Cloud, CloudOff, LayoutDashboard, Package, ScanLine, Settings, ShoppingCart, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { ScanDialog } from "@/components/inventory/ScanDialog";
import { SettingsDialog, useAppearance, useCurrency } from "./SettingsDialog";
import { loadCurrency } from "@/lib/currency";

const NAV = [
  { to: "/dashboard", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard },
  { to: "/items", label: "Items", short: "Items", icon: Package },
  { to: "/bulk", label: "Smart Bulk Entry", short: "Bulk Entry", icon: Wand2 },
  { to: "/reorder", label: "Supplier order", short: "Order", icon: ShoppingCart },
] as const;

function AccountMenu() {
  const { user, signOut } = useAuth();
  const { current, workspaces, switchTo } = useWorkspace();
  if (!user) return null;
  const label = (user.user_metadata?.["display_name"] as string | undefined) || user.email || "Account";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account" title={label}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-semibold uppercase text-primary-foreground">{label.charAt(0)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-56 truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        {current && <DropdownMenuLabel className="max-w-56 truncate text-xs">{current.name} · {ROLE_LABEL[current.role]}</DropdownMenuLabel>}
        {workspaces.filter((w) => w.id !== current?.id).map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => switchTo(w.id)}>Switch to {w.name}</DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild><Link to="/team"><Users className="mr-2 h-4 w-4" />Team & workspace</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SyncBadge() {
  const { syncStatus, canEdit } = useInventory();
  const label = { loading: "Loading…", saving: "Saving…", saved: "Synced", offline: "Offline — changes not saved", error: "Sync problem" }[syncStatus];
  const bad = syncStatus === "offline" || syncStatus === "error";
  return (
    <span className={`hidden items-center gap-1 px-2 text-xs sm:flex ${bad ? "text-destructive" : "text-muted-foreground"}`} title={label}>
      {bad ? <CloudOff className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />}{label}{!canEdit && " · View only"}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [scanOpen, setScanOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const appearance = useAppearance();
  const currency = useCurrency();
  useEffect(() => { loadCurrency(); }, []);
  return (
    <div className="min-h-screen pb-36 md:pb-24">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Boxes className="h-4 w-4" /></span>
            <span className="truncate">Stockroom</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} activeOptions={{ exact: to === "/dashboard" }}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}>
                <Icon className="h-4 w-4" /><span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center">
            <SyncBadge />
            <Button variant="ghost" size="icon" aria-label="Scan barcode or QR code" title="Scan barcode or QR code" onClick={() => setScanOpen(true)}><ScanLine className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Settings" title="Settings" onClick={() => setSettingsOpen(true)}><Settings className="h-4 w-4" /></Button>
            <AccountMenu />
          </div>
        </div>
      </header>
      <main key={`${currency}-${arePricesHidden()}`} className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ to, short, icon: Icon }) => (
          <Link key={to} to={to} activeOptions={{ exact: to === "/dashboard" }}
            className="flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground"
            activeProps={{ className: "text-primary font-medium" }}>
            <Icon className="h-5 w-5" /><span>{short}</span>
          </Link>
        ))}
      </nav>
      <AssistantPanel />
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} appearance={appearance} />
    </div>
  );
}
