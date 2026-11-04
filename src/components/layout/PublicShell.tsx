import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { useAppearance } from "./SettingsDialog";

const PUBLIC = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/terms", "/privacy"];
export const isPublicPath = (p: string) => PUBLIC.includes(p.replace(/\/$/, "") || "/");

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-md font-display text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Boxes className="h-4 w-4" aria-hidden /></span>
      Stockroom
    </Link>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  useAppearance();
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <nav aria-label="Legal" className="flex flex-wrap gap-4">
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <a href="mailto:royfrank028@gmail.com" className="hover:text-foreground">royfrank028@gmail.com</a>
        </nav>
        <p>© {new Date().getFullYear()} Stockroom</p>
      </div>
    </footer>
  );
}
