import { describe, expect, it } from "vitest";
import { canEditInventory, canManageTeam, pricesHiddenFor } from "./workspace-roles";

describe("workspace roles", () => {
  it("viewers cannot edit stock, staff can", () => {
    expect(canEditInventory("viewer")).toBe(false);
    expect(canEditInventory("staff")).toBe(true);
  });
  it("only owners and admins manage the team", () => {
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("manager")).toBe(false);
  });
  it("hide-prices setting hides prices from staff but not managers", () => {
    expect(pricesHiddenFor("staff", true)).toBe(true);
    expect(pricesHiddenFor("staff", false)).toBe(false);
    expect(pricesHiddenFor("manager", true)).toBe(false);
  });
});
