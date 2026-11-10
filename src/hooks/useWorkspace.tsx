import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { makeSeed } from "@/lib/seed";
import { setPricesHidden } from "@/lib/currency";
import { pricesHiddenFor, type WorkspaceRole } from "@/lib/workspace-roles";

export interface Workspace { id: string; name: string; owner_id: string; hide_prices_from_staff: boolean; role: WorkspaceRole }
interface Ctx {
  workspaces: Workspace[];
  current: Workspace | null;
  loading: boolean;
  error: string | null;
  switchTo: (id: string) => void;
  reload: () => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
}
const FALLBACK: Ctx = { workspaces: [], current: null, loading: true, error: null, switchTo: () => {}, reload: async () => {}, createWorkspace: async () => {} };
const WorkspaceContext = createContext<Ctx | null>(null);
const CURRENT_KEY = "stockroom:workspace";
const LEGACY_KEY = "inventory-logger:v1";

function legacyLocalData() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return makeSeed();
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const creating = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) { setWorkspaces([]); setCurrentId(null); setLoading(false); return; }
    setError(null);
    await supabase.rpc("accept_my_invites");
    const { data, error: e } = await supabase
      .from("workspace_members")
      .select("role, workspaces(id, name, owner_id, hide_prices_from_staff)")
      .eq("user_id", user.id);
    if (e) { setError(e.message); setLoading(false); return; }
    let list: Workspace[] = (data ?? []).flatMap((r) => (r.workspaces ? [{ ...r.workspaces, role: r.role as WorkspaceRole }] : []));
    if (!list.length && creating.current !== user.id) {
      // First sign-in: move this device's existing inventory (or sample data) into a new workspace.
      creating.current = user.id;
      const { error: ce } = await supabase.rpc("create_workspace", { _name: "My workspace", _data: legacyLocalData() });
      if (ce) { setError(ce.message); setLoading(false); return; }
      return reload();
    }
    list = list.sort((a, b) => a.name.localeCompare(b.name));
    setWorkspaces(list);
    const stored = localStorage.getItem(CURRENT_KEY);
    setCurrentId((prev) => [prev, stored].find((id) => id && list.some((w) => w.id === id)) ?? list[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { setLoading(true); void reload(); }, [reload]);

  const current = workspaces.find((w) => w.id === currentId) ?? null;
  useEffect(() => { setPricesHidden(pricesHiddenFor(current?.role, current?.hide_prices_from_staff ?? false)); }, [current]);

  const switchTo = useCallback((id: string) => { localStorage.setItem(CURRENT_KEY, id); setCurrentId(id); }, []);
  const createWorkspace = useCallback(async (name: string) => {
    const { data, error: e } = await supabase.rpc("create_workspace", { _name: name, _data: { items: [], movements: [] } });
    if (e) throw e;
    if (data) localStorage.setItem(CURRENT_KEY, data);
    setCurrentId(data);
    await reload();
  }, [reload]);

  return (
    <WorkspaceContext.Provider value={{ workspaces, current, loading, error, switchTo, reload, createWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  // Fallback keeps the page rendering (empty, loading) if a hot update briefly remounts providers out of order.
  return ctx ?? FALLBACK;
}
