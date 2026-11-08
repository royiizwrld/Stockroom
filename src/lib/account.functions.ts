import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the caller's account, the workspaces they own, and their memberships. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    await supabaseAdmin.from("workspaces").delete().eq("owner_id", uid);
    await supabaseAdmin.from("workspace_members").delete().eq("user_id", uid);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error("Could not delete the account. Please try again.");
    return { ok: true };
  });
