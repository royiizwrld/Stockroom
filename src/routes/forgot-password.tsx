import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/PublicShell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Stockroom" },
      { name: "description", content: "Get a link to reset your Stockroom password." },
      { property: "og:title", content: "Reset your password — Stockroom" },
      { property: "og:description", content: "Get a link to reset your Stockroom password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
      {sent ? (
        <p className="rounded-lg border bg-card p-4 text-sm">If an account exists for {email}, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <Link to="/login" className="text-center text-sm text-primary hover:underline">Back to sign in</Link>
    </div>
  );
}
