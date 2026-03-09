/**
 * stealth.ts 单元测试
 *
 * 场景：上下文创建、代理注入、webdriver 隐藏配置
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Browser, BrowserContext } from "playwright";

// Mock playwright browser
const mockContext = {
  addInitScript: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  route: vi.fn().mockResolvedValue(undefined),
} as unknown as BrowserContext;

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
} as unknown as Browser;

describe("createStealthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create context with randomized viewport", async () => {
    const { createStealthContext } = await import("./stealth.js");
    await createStealthContext(mockBrowser);

    expect(mockBrowser.newContext).toHaveBeenCalledTimes(1);
    const options = (mockBrowser.newContext as ReturnType<typeof vi.fn>).mock
      .calls[0][0];

    expect(options.viewport.width).toBeGreaterThanOrEqual(1280);
    expect(options.viewport.width).toBeLessThanOrEqual(1920);
    expect(options.viewport.height).toBeGreaterThanOrEqual(720);
    expect(options.viewport.height).toBeLessThanOrEqual(1080);
  });

  it("should inject proxy config when provided", async () => {
    const { createStealthContext } = await import("./stealth.js");
    const proxyConfig = {
      server: "http://proxy.example.com:8080",
      username: "user",
      password: "pass",
    };

    await createStealthContext(mockBrowser, proxyConfig);

    const options = (mockBrowser.newContext as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(options.proxy).toEqual({
      server: "http://proxy.example.com:8080",
      username: "user",
      password: "pass",
    });
  });

  it("should not include proxy when none provided", async () => {
    const { createStealthContext } = await import("./stealth.js");
    await createStealthContext(mockBrowser);

    const options = (mockBrowser.newContext as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(options.proxy).toBeUndefined();
  });

  it("should add webdriver-hiding init script", async () => {
    const { createStealthContext } = await import("./stealth.js");
    await createStealthContext(mockBrowser);

    expect(mockContext.addInitScript).toHaveBeenCalled();
    const script = (mockContext.addInitScript as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(script).toContain("webdriver");
  });

  it("should block tracking scripts", async () => {
    const { createStealthContext } = await import("./stealth.js");
    await createStealthContext(mockBrowser);

    expect(mockContext.route).toHaveBeenCalled();
  });

  it("should set locale from supported list", async () => {
    const { createStealthContext } = await import("./stealth.js");
    await createStealthContext(mockBrowser);

    const options = (mockBrowser.newContext as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    const supportedLocales = ["en-US", "en-GB", "en-AU"];
    expect(supportedLocales).toContain(options.locale);
  });
});
