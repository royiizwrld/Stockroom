import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/PublicShell";
import { safeRedirect, useAuth } from "@/hooks/useAuth";

const NEXT_KEY = "stockroom:after-login";

export function AuthForm({ mode, redirect }: { mode: "login" | "signup"; redirect?: string | undefined }) {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const target = safeRedirect(redirect);

  useEffect(() => {
    if (!loading && user) {
      const stored = sessionStorage.getItem(NEXT_KEY);
      sessionStorage.removeItem(NEXT_KEY);
      void navigate({ to: safeRedirect(stored ?? target), replace: true });
    }
  }, [loading, user, navigate, target]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Enter a valid email address.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return toast.error(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}${target}`, data: { display_name: name.trim() || undefined } },
        });
        if (error) return toast.error(error.message);
        if (!data.session) setSent(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "lovable") => {
    sessionStorage.setItem(NEXT_KEY, target);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/login" });
    if (result.error) toast.error("Couldn't sign in. Please try again.");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <Logo />
      <div>
        <h1 className="font-display text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Welcome back to Stockroom." : "Start tracking stock and assets in minutes."}</p>
      </div>
      {sent ? (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-muted-foreground">We sent a confirmation link to {email}. Open it to finish creating your account.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={() => void oauth("google")}>Continue with Google</Button>
            <button type="button" className="lovable-auth-button" onClick={() => void oauth("lovable")}>Continue with Lovable</button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>
          <form onSubmit={submit} className="grid gap-4">
            {mode === "signup" && (
              <div className="grid gap-1.5"><Label htmlFor="name">Your name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
            )}
            <div className="grid gap-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>}
              </div>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
          </form>
        </>
      )}
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? <>New here? <Link to="/signup" search={{ redirect }} className="text-primary hover:underline">Create an account</Link></> : <>Already have an account? <Link to="/login" search={{ redirect }} className="text-primary hover:underline">Sign in</Link></>}
      </p>
    </div>
  );
}
