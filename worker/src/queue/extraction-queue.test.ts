/**
 * extraction-queue.ts 单元测试
 *
 * 测试 Redis 配置解析、队列启用检测、优先级逻辑
 * 不测试实际 Redis 连接（需要 integration test）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseRedisUrl,
  getRedisConfig,
  isQueueEnabled,
  resetQueue,
} from "./extraction-queue.js";

const originalEnv = { ...process.env };

describe("parseRedisUrl", () => {
  it("should parse standard Redis URL", () => {
    const config = parseRedisUrl("redis://localhost:6379/0");
    expect(config).toEqual({
      host: "localhost",
      port: 6379,
      password: undefined,
      db: 0,
    });
  });

  it("should parse Redis URL with password", () => {
    const config = parseRedisUrl(
      "redis://:mypassword@redis.example.com:6380/2",
    );
    expect(config).toEqual({
      host: "redis.example.com",
      port: 6380,
      password: "mypassword",
      db: 2,
    });
  });

  it("should default to port 6379 and db 0", () => {
    const config = parseRedisUrl("redis://myhost");
    expect(config.host).toBe("myhost");
    expect(config.port).toBe(6379);
    expect(config.db).toBe(0);
  });
});

describe("getRedisConfig", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use REDIS_URL when set", () => {
    process.env.REDIS_URL = "redis://:secret@prod-redis:6380/1";
    const config = getRedisConfig();
    expect(config.host).toBe("prod-redis");
    expect(config.port).toBe(6380);
    expect(config.password).toBe("secret");
    expect(config.db).toBe(1);
  });

  it("should fall back to individual env vars", () => {
    delete process.env.REDIS_URL;
    process.env.REDIS_HOST = "my-redis";
    process.env.REDIS_PORT = "6381";
    process.env.REDIS_PASSWORD = "pw123";
    process.env.REDIS_DB = "3";
    const config = getRedisConfig();
    expect(config).toEqual({
      host: "my-redis",
      port: 6381,
      password: "pw123",
      db: 3,
    });
  });

  it("should use defaults when no env vars set", () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
    const config = getRedisConfig();
    expect(config).toEqual({
      host: "localhost",
      port: 6379,
      password: undefined,
      db: 0,
    });
  });
});

describe("isQueueEnabled", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return true when REDIS_URL is set", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    expect(isQueueEnabled()).toBe(true);
  });

  it("should return true when REDIS_HOST is set", () => {
    delete process.env.REDIS_URL;
    process.env.REDIS_HOST = "my-redis";
    expect(isQueueEnabled()).toBe(true);
  });

  it("should return false when no Redis env vars", () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    expect(isQueueEnabled()).toBe(false);
  });
});

describe("resetQueue", () => {
  it("should not throw", () => {
    expect(() => resetQueue()).not.toThrow();
  });
});
