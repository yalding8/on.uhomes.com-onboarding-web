/**
 * 环境变量加载与校验
 *
 * 启动时校验必需变量，缺失则立即报错退出。
 */

interface Config {
  port: number;
  supabaseServiceRoleKey: string;
  jobTimeoutMs: number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    port: parseInt(process.env.PORT ?? "3000", 10),
    supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    jobTimeoutMs: parseInt(process.env.JOB_TIMEOUT_MS ?? "300000", 10),
  };

  return cachedConfig;
}

/** 用于测试：重置缓存 */
export function resetConfig(): void {
  cachedConfig = null;
}
