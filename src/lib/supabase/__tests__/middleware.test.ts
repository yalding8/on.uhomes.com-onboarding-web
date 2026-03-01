import { describe, it, expect } from "vitest";

/**
 * 中间件路由决策的纯逻辑提取，便于测试。
 * 与 middleware.ts 中的 updateSession 保持同步。
 */
type RouteDecision =
  | { action: "redirect"; target: string }
  | { action: "pass" };

interface RouteInput {
  isAuthenticated: boolean;
  role: string;
  status: string;
  pathname: string;
}

function resolveRoute(input: RouteInput): RouteDecision {
  const { isAuthenticated, role, status, pathname } = input;

  if (isAuthenticated) {
    // BD role routing
    if (role === "bd") {
      if (
        !pathname.startsWith("/admin") &&
        !pathname.startsWith("/auth") &&
        !pathname.startsWith("/api/")
      ) {
        return { action: "redirect", target: "/admin" };
      }
      return { action: "pass" };
    }

    // Non-BD users cannot access /admin
    if (pathname.startsWith("/admin")) {
      return { action: "redirect", target: "/dashboard" };
    }

    // Original 3-stage supplier routing
    if (status === "SIGNED") {
      if (pathname === "/" || pathname.startsWith("/login")) {
        return { action: "redirect", target: "/dashboard" };
      }
    }

    if (
      status === "PENDING_CONTRACT" &&
      pathname !== "/dashboard" &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/api/")
    ) {
      return { action: "redirect", target: "/dashboard" };
    }

    if (
      status === "NEW" &&
      pathname !== "/" &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/api/")
    ) {
      return { action: "redirect", target: "/" };
    }

    return { action: "pass" };
  }

  // Unauthenticated
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/");
  if (!isPublicRoute) {
    return { action: "redirect", target: "/login" };
  }

  return { action: "pass" };
}

describe("中间件路由决策逻辑", () => {
  describe("BD 角色路由 (Requirements 1.1, 1.2)", () => {
    it("BD 用户访问 / 时重定向到 /admin", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "bd",
        status: "PENDING_CONTRACT",
        pathname: "/",
      });
      expect(result).toEqual({ action: "redirect", target: "/admin" });
    });

    it("BD 用户访问 /dashboard 时重定向到 /admin", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "bd",
        status: "PENDING_CONTRACT",
        pathname: "/dashboard",
      });
      expect(result).toEqual({ action: "redirect", target: "/admin" });
    });

    it("BD 用户访问 /login 时重定向到 /admin", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "bd",
        status: "PENDING_CONTRACT",
        pathname: "/login",
      });
      expect(result).toEqual({ action: "redirect", target: "/admin" });
    });

    it("BD 用户访问 /admin 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "bd",
        status: "PENDING_CONTRACT",
        pathname: "/admin",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("BD 用户访问 /admin/applications 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "bd",
        status: "PENDING_CONTRACT",
        pathname: "/admin/applications",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("BD 用户访问 /auth/callback 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "bd",
        status: "PENDING_CONTRACT",
        pathname: "/auth/callback",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("BD 用户访问 /api/xxx 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "bd",
        status: "PENDING_CONTRACT",
        pathname: "/api/admin/approve-supplier",
      });
      expect(result).toEqual({ action: "pass" });
    });
  });

  describe("非 BD 用户禁止访问 /admin (Requirement 1.3)", () => {
    it("supplier 用户访问 /admin 时重定向到 /dashboard", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "PENDING_CONTRACT",
        pathname: "/admin",
      });
      expect(result).toEqual({ action: "redirect", target: "/dashboard" });
    });

    it("supplier 用户访问 /admin/suppliers 时重定向到 /dashboard", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "SIGNED",
        pathname: "/admin/suppliers",
      });
      expect(result).toEqual({ action: "redirect", target: "/dashboard" });
    });

    it("data_team 用户访问 /admin 时重定向到 /dashboard", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "data_team",
        status: "PENDING_CONTRACT",
        pathname: "/admin/applications",
      });
      expect(result).toEqual({ action: "redirect", target: "/dashboard" });
    });
  });

  describe("未认证用户访问 /admin (Requirement 1.4)", () => {
    it("未认证用户访问 /admin 时重定向到 /login", () => {
      const result = resolveRoute({
        isAuthenticated: false,
        role: "supplier",
        status: "NEW",
        pathname: "/admin",
      });
      expect(result).toEqual({ action: "redirect", target: "/login" });
    });

    it("未认证用户访问 /admin/applications 时重定向到 /login", () => {
      const result = resolveRoute({
        isAuthenticated: false,
        role: "supplier",
        status: "NEW",
        pathname: "/admin/applications",
      });
      expect(result).toEqual({ action: "redirect", target: "/login" });
    });
  });

  describe("原有三态路由逻辑不变", () => {
    it("SIGNED supplier 访问 / 时重定向到 /dashboard", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "SIGNED",
        pathname: "/",
      });
      expect(result).toEqual({ action: "redirect", target: "/dashboard" });
    });

    it("SIGNED supplier 访问 /dashboard 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "SIGNED",
        pathname: "/dashboard",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("PENDING_CONTRACT supplier 访问 / 时重定向到 /dashboard", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "PENDING_CONTRACT",
        pathname: "/",
      });
      expect(result).toEqual({ action: "redirect", target: "/dashboard" });
    });

    it("PENDING_CONTRACT supplier 访问 /dashboard 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "PENDING_CONTRACT",
        pathname: "/dashboard",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("PENDING_CONTRACT supplier 访问 /api/ 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "PENDING_CONTRACT",
        pathname: "/api/contracts/123/confirm",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("NEW supplier 访问 /api/ 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "NEW",
        pathname: "/api/apply",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("NEW supplier 访问 /dashboard 时重定向到 /", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "NEW",
        pathname: "/dashboard",
      });
      expect(result).toEqual({ action: "redirect", target: "/" });
    });

    it("NEW supplier 访问 / 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: true,
        role: "supplier",
        status: "NEW",
        pathname: "/",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("未认证用户访问 / 时放行", () => {
      const result = resolveRoute({
        isAuthenticated: false,
        role: "supplier",
        status: "NEW",
        pathname: "/",
      });
      expect(result).toEqual({ action: "pass" });
    });

    it("未认证用户访问 /dashboard 时重定向到 /login", () => {
      const result = resolveRoute({
        isAuthenticated: false,
        role: "supplier",
        status: "NEW",
        pathname: "/dashboard",
      });
      expect(result).toEqual({ action: "redirect", target: "/login" });
    });
  });
});
