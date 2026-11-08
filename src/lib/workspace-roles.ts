export type WorkspaceRole = "owner" | "admin" | "manager" | "staff" | "viewer";
export const ROLES: WorkspaceRole[] = ["owner", "admin", "manager", "staff", "viewer"];
export const ROLE_LABEL: Record<WorkspaceRole, string> = { owner: "Owner", admin: "Admin", manager: "Manager", staff: "Staff", viewer: "Viewer" };
export const ROLE_HINT: Record<WorkspaceRole, string> = {
  owner: "Full control, including deleting the workspace",
  admin: "Manage team, invites and settings, edit stock",
  manager: "Edit items and stock, always sees prices",
  staff: "Edit items and stock; prices can be hidden",
  viewer: "Read-only access",
};
export const canEditInventory = (r: WorkspaceRole | null | undefined) => !!r && r !== "viewer";
export const canManageTeam = (r: WorkspaceRole | null | undefined) => r === "owner" || r === "admin";
export const pricesHiddenFor = (r: WorkspaceRole | null | undefined, hideFromStaff: boolean) =>
  r === "viewer" || (hideFromStaff && r === "staff");
