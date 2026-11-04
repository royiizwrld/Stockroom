import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/PublicShell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Stockroom" },
      { name: "description", content: "Set a new password for your Stockroom account." },
      { property: "og:title", content: "Choose a new password — Stockroom" },
      { property: "og:description", content: "Set a new password for your Stockroom account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error("This reset link has expired. Request a new one.");
    toast.success("Password updated.");
    await navigate({ to: "/dashboard", replace: true });
  };
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <h1 className="font-display text-2xl font-semibold">Choose a new password</h1>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-1.5"><Label htmlFor="pw">New password</Label><Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></div>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </div>
  );
}
