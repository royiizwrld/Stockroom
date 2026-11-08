import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, History, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { canManageTeam, ROLE_HINT, ROLE_LABEL, ROLES, type WorkspaceRole } from "@/lib/workspace-roles";
import { deleteMyAccount } from "@/lib/account.functions";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & workspace — Stockroom" },
      { name: "description", content: "Manage your Stockroom workspace, team roles, invites and activity log." },
      { property: "og:title", content: "Team & workspace — Stockroom" },
      { property: "og:description", content: "Manage your Stockroom workspace, team roles, invites and activity log." },
    ],
  }),
  component: TeamPage,
});

type Member = { user_id: string; role: WorkspaceRole; email: string | null; display_name: string | null };
type Invite = { id: string; email: string; role: WorkspaceRole; created_at: string };
type Activity = { id: string; actor_name: string | null; action: string; details: string | null; created_at: string };
const ASSIGNABLE = ROLES.filter((r) => r !== "owner");

function TeamPage() {
  const { user, signOut } = useAuth();
  const { current, workspaces, switchTo, reload, createWorkspace } = useWorkspace();
  const manage = canManageTeam(current?.role);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("staff");
  const [newWs, setNewWs] = useState("");
  const del = useServerFn(deleteMyAccount);

  const load = useCallback(async () => {
    if (!current) return;
    setName(current.name);
    const [m, a] = await Promise.all([
      supabase.from("workspace_members").select("user_id, role, email, display_name").eq("workspace_id", current.id).order("created_at"),
      supabase.from("activity_log").select("id, actor_name, action, details, created_at").eq("workspace_id", current.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setMembers((m.data ?? []) as Member[]);
    setActivity(a.data ?? []);
    if (manage) {
      const i = await supabase.from("workspace_invites").select("id, email, role, created_at").eq("workspace_id", current.id).order("created_at");
      setInvites((i.data ?? []) as Invite[]);
    } else setInvites([]);
  }, [current, manage]);
  useEffect(() => { void load(); }, [load]);

  if (!current) return <p className="text-muted-foreground">Loading workspace…</p>;

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error } = await p;
    if (error) toast.error(error.message); else { toast.success(ok); await load(); }
  };

  const saveName = async () => { await run(supabase.from("workspaces").update({ name: name.trim() || "My workspace" }).eq("id", current.id), "Workspace renamed"); await reload(); };
  const toggleHide = async (v: boolean) => { await run(supabase.from("workspaces").update({ hide_prices_from_staff: v }).eq("id", current.id), v ? "Prices hidden from staff" : "Prices visible to staff"); await reload(); };
  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return toast.error("Enter a valid email address");
    if (members.some((m) => m.email?.toLowerCase() === em)) return toast.error("That person is already a member");
    await run(supabase.from("workspace_invites").insert({ workspace_id: current.id, email: em, role, invited_by: user!.id }), `Invite saved for ${em}`);
    setEmail("");
  };
  const copyInvite = (em: string) => {
    const text = `You've been invited to the "${current.name}" workspace on Stockroom. Sign up or sign in with ${em} at ${window.location.origin}/signup to join.`;
    void navigator.clipboard.writeText(text).then(() => toast.success("Invite message copied"));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Team & workspace" description="Everyone in a workspace shares the same inventory, synced to the cloud." />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" />Workspace</CardTitle>
          <CardDescription>Your role here: <Badge variant="secondary">{ROLE_LABEL[current.role]}</Badge> — {ROLE_HINT[current.role]}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {workspaces.length > 1 && (
            <div className="space-y-1.5"><Label>Switch workspace</Label>
              <Select value={current.id} onValueChange={switchTo}><SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{workspaces.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} ({ROLE_LABEL[w.role]})</SelectItem>)}</SelectContent></Select></div>
          )}
          {manage && (
            <div className="flex max-w-md items-end gap-2"><div className="flex-1 space-y-1.5"><Label htmlFor="ws-name">Name</Label><Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <Button variant="outline" onClick={() => void saveName()} disabled={name === current.name}>Save</Button></div>
          )}
          {manage && (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div><p className="text-sm font-medium">Hide prices from staff</p><p className="text-xs text-muted-foreground">Staff and viewers see "Hidden" instead of prices and values. Owners, admins and managers still see them.</p></div>
              <Switch checked={current.hide_prices_from_staff} onCheckedChange={(v) => void toggleHide(v)} aria-label="Hide prices from staff" />
            </div>
          )}
          <form className="flex max-w-md items-end gap-2" onSubmit={async (e) => { e.preventDefault(); try { await createWorkspace(newWs); setNewWs(""); toast.success("Workspace created"); } catch (err) { toast.error((err as Error).message); } }}>
            <div className="flex-1 space-y-1.5"><Label htmlFor="new-ws">Create another workspace</Label><Input id="new-ws" placeholder="e.g. Main shop" value={newWs} onChange={(e) => setNewWs(e.target.value)} /></div>
            <Button type="submit" variant="outline">Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Members ({members.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.display_name || m.email || "Member"}{m.user_id === user?.id && " (you)"}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
              {manage && m.role !== "owner" && m.user_id !== user?.id ? (
                <>
                  <Select value={m.role} onValueChange={(r) => void run(supabase.from("workspace_members").update({ role: r as WorkspaceRole }).eq("workspace_id", current.id).eq("user_id", m.user_id), "Role updated")}>
                    <SelectTrigger className="w-32" aria-label="Role"><SelectValue /></SelectTrigger>
                    <SelectContent>{ASSIGNABLE.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select>
                  <Button variant="ghost" size="icon" aria-label="Remove member" onClick={() => void run(supabase.from("workspace_members").delete().eq("workspace_id", current.id).eq("user_id", m.user_id), "Member removed")}><Trash2 className="h-4 w-4" /></Button>
                </>
              ) : <Badge variant="secondary">{ROLE_LABEL[m.role]}</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      {manage && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" />Invite by email</CardTitle>
            <CardDescription>They join automatically the next time they sign in (or sign up and confirm) with this email. Stockroom doesn't send the email for you — copy the invite message and send it yourself.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1 space-y-1.5"><Label htmlFor="inv-email">Email</Label><Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" /></div>
              <div className="space-y-1.5"><Label>Role</Label><Select value={role} onValueChange={(r) => setRole(r as WorkspaceRole)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{ASSIGNABLE.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select></div>
              <Button type="submit">Invite</Button>
            </form>
            {invites.length > 0 && <div className="space-y-2"><p className="text-sm font-medium">Pending invites</p>
              {invites.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.email}</span><Badge variant="outline">{ROLE_LABEL[i.role]}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => copyInvite(i.email)}><Mail className="mr-1 h-4 w-4" />Copy message</Button>
                  <Button variant="ghost" size="icon" aria-label="Cancel invite" onClick={() => void run(supabase.from("workspace_invites").delete().eq("id", i.id), "Invite cancelled")}><Trash2 className="h-4 w-4" /></Button>
                </div>))}</div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Activity log</CardTitle><CardDescription>Who changed what, newest first.</CardDescription></CardHeader>
        <CardContent>
          {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
            <ul className="divide-y text-sm">{activity.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 py-2"><span className="font-medium">{a.actor_name}</span><span>{a.action.toLowerCase()}</span>
                {a.details && <span className="text-muted-foreground">— {a.details}</span>}
                <time className="ml-auto text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</time></li>))}</ul>)}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-base">Danger zone</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {current.role !== "owner" && (
            <Button variant="outline" onClick={async () => { const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", current.id).eq("user_id", user!.id); if (error) toast.error(error.message); else { toast.success("You left the workspace"); await reload(); } }}>Leave this workspace</Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive">Delete my account</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>This permanently deletes your account and every workspace you own, including its inventory, for all its members. This can't be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { try { await del(); toast.success("Account deleted"); await signOut(); } catch (e) { toast.error((e as Error).message); } }}>Delete permanently</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
