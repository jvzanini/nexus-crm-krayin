/**
 * Fase 5 T14/34 — settings UI /settings/custom-attributes (page RED tests).
 *
 * Cobre:
 *  - Flag OFF => notFound()
 *  - Flag ON + user sem permission (viewer-only fallback) => redirect("/dashboard")
 *    (viewer da matriz default possui "custom-attributes:view")
 *  - Flag ON + admin => renderiza <AttrsContent canManage /> (canManage=true)
 *  - Flag ON + viewer => renderiza <AttrsContent /> com canManage=false
 *  - Flag ON + platformRole desconhecido => canManage=false (fallback seguro)
 *  - Sem sessão => redirect("/login")
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// Mocks
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/flags/index", () => ({
  getFlag: vi.fn(),
}));

vi.mock(
  "./_components/attrs-content",
  () => ({
    AttrsContent: ({ canManage }: { canManage: boolean }) =>
      React.createElement("div", {
        "data-testid": "attrs-content",
        "data-can-manage": String(canManage),
      }),
  }),
);

import CustomAttributesPage from "./page";
import { getCurrentUser } from "@/lib/auth";
import { getFlag } from "@/lib/flags/index";

const adminUser = {
  id: "u1",
  name: "Admin",
  email: "admin@x.com",
  isSuperAdmin: false,
  platformRole: "admin",
  avatarUrl: null,
  theme: "dark",
};

const viewerUser = {
  id: "u2",
  name: "Viewer",
  email: "v@x.com",
  isSuperAdmin: false,
  platformRole: "viewer",
  avatarUrl: null,
  theme: "dark",
};

const sellerUser = {
  // seller NÃO tem custom-attributes:view
  id: "u3",
  name: "Seller",
  email: "s@x.com",
  isSuperAdmin: false,
  platformRole: "seller",
  avatarUrl: null,
  theme: "dark",
};

describe("CustomAttributesPage (T14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flag OFF => notFound()", async () => {
    (getFlag as any).mockResolvedValue(false);
    (getCurrentUser as any).mockResolvedValue(adminUser);

    await expect(CustomAttributesPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("flag ON sem sessão => redirect /login", async () => {
    (getFlag as any).mockResolvedValue(true);
    (getCurrentUser as any).mockResolvedValue(null);

    await expect(CustomAttributesPage()).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
  });

  it("flag ON + seller (sem view perm) => redirect /dashboard", async () => {
    (getFlag as any).mockResolvedValue(true);
    (getCurrentUser as any).mockResolvedValue(sellerUser);

    await expect(CustomAttributesPage()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("flag ON + viewer => renderiza AttrsContent canManage=false", async () => {
    (getFlag as any).mockResolvedValue(true);
    (getCurrentUser as any).mockResolvedValue(viewerUser);

    const el = (await CustomAttributesPage()) as React.ReactElement<{
      canManage: boolean;
    }>;
    expect(el).toBeTruthy();
    expect(el.props.canManage).toBe(false);
  });

  it("flag ON + admin => renderiza AttrsContent canManage=true", async () => {
    (getFlag as any).mockResolvedValue(true);
    (getCurrentUser as any).mockResolvedValue(adminUser);

    const el = (await CustomAttributesPage()) as React.ReactElement<{
      canManage: boolean;
    }>;
    expect(el).toBeTruthy();
    expect(el.props.canManage).toBe(true);
  });

  it("flag ON + platformRole desconhecido (fallback viewer) => canManage=false", async () => {
    (getFlag as any).mockResolvedValue(true);
    (getCurrentUser as any).mockResolvedValue({
      ...viewerUser,
      platformRole: "unknown_role",
    });

    // `userRole` faz fallback para viewer → possui custom-attributes:view
    // mas NÃO custom-attributes:manage.
    const el = (await CustomAttributesPage()) as React.ReactElement<{
      canManage: boolean;
    }>;
    expect(el).toBeTruthy();
    expect(el.props.canManage).toBe(false);
  });
});
