import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { InventoryState, Item, ItemInput, Movement, MovementReason, MovementSource } from "@/lib/types";
import { DEFAULT_CATEGORIES, DEFAULT_LOCATIONS, getStatus, uid } from "@/lib/inventory";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { canEditInventory } from "@/lib/workspace-roles";

export type SyncStatus = "loading" | "saving" | "saved" | "offline" | "error";

const empty: InventoryState = { items: [], categories: [...DEFAULT_CATEGORIES], locations: [...DEFAULT_LOCATIONS], movements: [] };

interface Ctx extends InventoryState {
  ready: boolean;
  canEdit: boolean;
  syncStatus: SyncStatus;
  hasSample: boolean;
  addItem: (input: ItemInput, source?: MovementSource) => Item;
  updateItem: (id: string, input: ItemInput, reason?: MovementReason) => void;
  deleteItem: (id: string) => void;
  adjustStock: (id: string, delta: number, opts?: { reason?: MovementReason | undefined; source?: MovementSource; note?: string }) => string | null;
  undoMovement: (movementId: string) => void;
  addCategory: (c: string) => void;
  addLocation: (l: string) => void;
  clearSample: () => void;
  isSkuTaken: (sku: string, exceptId?: string) => boolean;
  getStatus: typeof getStatus;
}

const InventoryContext = createContext<Ctx | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const wsId = current?.id ?? null;
  const canEdit = canEditInventory(current?.role);
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const [state, setState] = useState<InventoryState>(empty);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const stateRef = useRef(state);
  stateRef.current = state;
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const loadedWs = useRef<string | null>(null);

  // Load the workspace's shared inventory from the cloud.
  const pull = useCallback(async (force = false) => {
    if (!wsId) return;
    const { data, error } = await supabase.from("workspace_inventory").select("data, version").eq("workspace_id", wsId).maybeSingle();
    if (error) { setSyncStatus(navigator.onLine ? "error" : "offline"); return; }
    if (!data || dirtyRef.current) return;
    if (force || data.version > versionRef.current) {
      versionRef.current = data.version;
      setState({ ...empty, ...(data.data as object as Partial<InventoryState>) });
    }
    setSyncStatus("saved");
  }, [wsId]);

  useEffect(() => {
    if (!wsId) { setReady(false); return; }
    setReady(false); setSyncStatus("loading"); dirtyRef.current = false; versionRef.current = 0;
    loadedWs.current = null;
    void pull(true).then(() => { loadedWs.current = wsId; setReady(true); });
    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    const t = window.setInterval(() => void pull(), 20000);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.clearInterval(t); };
  }, [wsId, pull]);

  // Save local changes to the cloud shortly after they happen.
  useEffect(() => {
    if (!ready || !dirtyRef.current || !wsId || loadedWs.current !== wsId) return;
    setSyncStatus("saving");
    const t = window.setTimeout(async () => {
      const next = versionRef.current + 1;
      const { error } = await supabase.from("workspace_inventory")
        .update({ data: stateRef.current as unknown as Json, version: next, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
        .eq("workspace_id", wsId);
      if (error) { setSyncStatus(navigator.onLine ? "error" : "offline"); return; }
      versionRef.current = next; dirtyRef.current = false; setSyncStatus("saved");
    }, 700);
    return () => window.clearTimeout(t);
  }, [state, ready, wsId, user]);

  const logActivity = useCallback((action: string, details?: string) => {
    if (!wsId || !user) return;
    const actor = (user.user_metadata?.["display_name"] as string | undefined) || user.email || "Someone";
    void supabase.from("activity_log").insert({ workspace_id: wsId, user_id: user.id, actor_name: actor, action, details: details ?? null });
  }, [wsId, user]);

  /** Applies a local change if this member may edit; marks it for cloud save. */
  const edit = useCallback((fn: (s: InventoryState) => InventoryState) => {
    if (!canEditRef.current) { toast.error("You have view-only access to this workspace."); return false; }
    dirtyRef.current = true;
    setState(fn);
    return true;
  }, []);

  const mkMove = (item: Item, change: number, resultingQty: number, source: MovementSource, reason?: MovementReason, note?: string): Movement => ({
    id: uid(), itemId: item.id, itemName: item.name, date: new Date().toISOString(), change, resultingQty, source, reason, note,
  });

  const addItem = useCallback((input: ItemInput, source: MovementSource = "create") => {
    const now = new Date().toISOString();
    const item: Item = { ...input, id: uid(), createdAt: now, updatedAt: now };
    edit((s) => ({
      ...s,
      items: [item, ...s.items],
      movements: item.quantity
        ? [...s.movements, mkMove(item, item.quantity, item.quantity, source, source === "create" ? undefined : "Purchase")]
        : s.movements,
      categories: s.categories.includes(item.category) || !item.category ? s.categories : [...s.categories, item.category],
      locations: s.locations.includes(item.location) || !item.location ? s.locations : [...s.locations, item.location],
    }));
    logActivity("Added item", `${item.name} (qty ${item.quantity})`);
    return item;
  }, [edit, logActivity]);

  const updateItem = useCallback((id: string, input: ItemInput, reason?: MovementReason) => {
    edit((s) => {
      const old = s.items.find((i) => i.id === id);
      if (!old) return s;
      const next: Item = { ...old, ...input, sample: old.sample, updatedAt: new Date().toISOString() };
      const diff = next.quantity - old.quantity;
      return {
        ...s,
        items: s.items.map((i) => (i.id === id ? next : i)),
        movements: diff ? [...s.movements, mkMove(next, diff, next.quantity, "manual", reason ?? "Correction")] : s.movements,
        categories: s.categories.includes(next.category) || !next.category ? s.categories : [...s.categories, next.category],
        locations: s.locations.includes(next.location) || !next.location ? s.locations : [...s.locations, next.location],
      };
    });
    logActivity("Edited item", input.name);
  }, [edit, logActivity]);

  const deleteItem = useCallback((id: string) => {
    const name = stateRef.current.items.find((i) => i.id === id)?.name ?? "item";
    if (edit((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))) logActivity("Deleted item", name);
  }, [edit, logActivity]);

  const adjustStock: Ctx["adjustStock"] = useCallback((id, delta, opts = {}) => {
    const item = stateRef.current.items.find((i) => i.id === id);
    if (!item || !delta) return null;
    const qty = Math.max(0, item.quantity + delta);
    const change = qty - item.quantity;
    if (!change || !canEditRef.current) { if (!canEditRef.current) toast.error("You have view-only access to this workspace."); return null; }
    const mv = mkMove(item, change, qty, opts.source ?? (change > 0 ? "restock" : "remove"), opts.reason, opts.note);
    edit((s) => ({
      ...s,
      items: s.items.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, i.quantity + change), updatedAt: mv.date } : i)),
      movements: [...s.movements, mv],
    }));
    logActivity(change > 0 ? "Added stock" : "Removed stock", `${item.name}: ${change > 0 ? "+" : ""}${change} → ${qty}${opts.reason ? ` (${opts.reason})` : ""}`);
    return mv.id;
  }, [edit, logActivity]);

  const undoMovement = useCallback((movementId: string) => {
    edit((s) => {
      const mv = s.movements.find((m) => m.id === movementId);
      if (!mv) return s;
      return {
        ...s,
        items: s.items.map((i) => (i.id === mv.itemId ? { ...i, quantity: Math.max(0, i.quantity - mv.change) } : i)),
        movements: s.movements.filter((m) => m.id !== movementId),
      };
    });
    logActivity("Undid stock change");
  }, [edit, logActivity]);

  const addCategory = useCallback((c: string) => {
    const v = c.trim();
    if (v) edit((s) => (s.categories.some((x) => x.toLowerCase() === v.toLowerCase()) ? s : { ...s, categories: [...s.categories, v] }));
  }, [edit]);
  const addLocation = useCallback((l: string) => {
    const v = l.trim();
    if (v) edit((s) => (s.locations.some((x) => x.toLowerCase() === v.toLowerCase()) ? s : { ...s, locations: [...s.locations, v] }));
  }, [edit]);

  const clearSample = useCallback(() => {
    edit((s) => {
      const ids = new Set(s.items.filter((i) => i.sample).map((i) => i.id));
      return { ...s, items: s.items.filter((i) => !ids.has(i.id)), movements: s.movements.filter((m) => !ids.has(m.itemId)) };
    });
    logActivity("Cleared sample data");
  }, [edit, logActivity]);

  const isSkuTaken = useCallback(
    (sku: string, exceptId?: string) =>
      stateRef.current.items.some((i) => i.id !== exceptId && i.sku.trim().toLowerCase() === sku.trim().toLowerCase()),
    [],
  );

  const value = useMemo<Ctx>(
    () => ({
      ...state, ready, canEdit, syncStatus, hasSample: state.items.some((i) => i.sample),
      addItem, updateItem, deleteItem, adjustStock, undoMovement, addCategory, addLocation, clearSample, isSkuTaken, getStatus,
    }),
    [state, ready, canEdit, syncStatus, addItem, updateItem, deleteItem, adjustStock, undoMovement, addCategory, addLocation, clearSample, isSkuTaken],
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used inside InventoryProvider");
  return ctx;
}
