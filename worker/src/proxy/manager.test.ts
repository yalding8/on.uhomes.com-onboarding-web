/**
 * proxy/manager.ts 单元测试
 *
 * 场景：域名粘性、失败上报、禁用模式
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

describe("proxy/manager", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getProxy — disabled mode", () => {
    it("should return null when PROXY_ENABLED is not set", async () => {
      delete process.env.PROXY_ENABLED;
      const { getProxy } = await import("./manager.js");
      expect(getProxy("example.com")).toBeNull();
    });

    it("should return null when PROXY_ENABLED is false", async () => {
      process.env.PROXY_ENABLED = "false";
      const { getProxy } = await import("./manager.js");
      expect(getProxy("example.com")).toBeNull();
    });
  });

  describe("getProxy — enabled mode", () => {
    it("should return ProxyConfig when enabled and configured", async () => {
      process.env.PROXY_ENABLED = "true";
      process.env.PROXY_URL = "http://proxy.example.com:8080";
      process.env.PROXY_USERNAME = "user";
      process.env.PROXY_PASSWORD = "pass";

      const { getProxy } = await import("./manager.js");
      const proxy = getProxy("apartments.com");

      expect(proxy).not.toBeNull();
      expect(proxy!.server).toBe("http://proxy.example.com:8080");
      expect(proxy!.password).toBe("pass");
    });

    it("should return null when enabled but PROXY_URL not set", async () => {
      process.env.PROXY_ENABLED = "true";
      delete process.env.PROXY_URL;

      const { getProxy } = await import("./manager.js");
      expect(getProxy("example.com")).toBeNull();
    });
  });

  describe("domain stickiness", () => {
    it("should return same proxy for same domain", async () => {
      process.env.PROXY_ENABLED = "true";
      process.env.PROXY_URL = "http://proxy.example.com:8080";

      const { getProxy } = await import("./manager.js");
      const first = getProxy("apartments.com");
      const second = getProxy("apartments.com");

      expect(first).toEqual(second);
    });
  });

  describe("reportProxyFailure", () => {
    it("should return null after failure reported", async () => {
      process.env.PROXY_ENABLED = "true";
      process.env.PROXY_URL = "http://proxy.example.com:8080";

      const { getProxy, reportProxyFailure } = await import("./manager.js");

      const proxy = getProxy("bad-domain.com");
      expect(proxy).not.toBeNull();

      reportProxyFailure("bad-domain.com", proxy!);
      expect(getProxy("bad-domain.com")).toBeNull();
    });

    it("should not affect other domains", async () => {
      process.env.PROXY_ENABLED = "true";
      process.env.PROXY_URL = "http://proxy.example.com:8080";

      const { getProxy, reportProxyFailure } = await import("./manager.js");

      const proxyB = getProxy("bad-domain.com");
      getProxy("good-domain.com");

      reportProxyFailure("bad-domain.com", proxyB!);

      expect(getProxy("good-domain.com")).not.toBeNull();
      expect(getProxy("bad-domain.com")).toBeNull();
    });
  });
});
