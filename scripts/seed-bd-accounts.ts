/**
 * Seed 脚本：创建 BD 测试账号
 *
 * 1. 通过 Supabase Admin RPC 确保 suppliers 表有 role 列
 * 2. 创建 auth 用户（如不存在）
 * 3. 在 suppliers 表插入 role='bd' 的记录
 *
 * 用法：npx tsx scripts/seed-bd-accounts.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// 手动解析 .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) {
    process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "缺少环境变量：请确保 .env.local 中配置了 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY",
  );
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Admin accounts (also have role='bd' in DB; admin is code-level via permissions.ts)
// Regular BD accounts — add new BDs here and rerun script
const BD_ACCOUNTS = [
  { email: "ning.ding@uhomes.com", company_name: "异乡好居 Admin - Ning" },
  { email: "abby.zhang@uhomes.com", company_name: "异乡好居 Admin - Abby" },
  { email: "lei.tian@uhomes.com", company_name: "异乡好居 Admin - Lei" },
  // BD accounts
  { email: "lorenzo.pisano@uhomes.com", company_name: "异乡好居 BD - Lorenzo" },
  { email: "larry.satkoski@uhomes.com", company_name: "异乡好居 BD - Larry" },
  { email: "weitao.wang@uhomes.com", company_name: "异乡好居 BD - Weitao" },
  {
    email: "victoria.mackay@uhomes.com",
    company_name: "异乡好居 BD - Victoria",
  },
  { email: "ben.vermillion@uhomes.com", company_name: "异乡好居 BD - Ben" },
  { email: "shuxuan.an@uhomes.com", company_name: "异乡好居 BD - Shuxuan" },
];

async function ensureRoleColumn() {
  console.log("📦 检查 suppliers 表 role 列...");

  // 通过 REST API 执行 SQL（使用 Supabase 的 rpc 或直接 POST /rest/v1/rpc）
  // 更简单的方式：直接用 fetch 调 Supabase SQL endpoint
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  // 如果 rpc 不可用，尝试直接插入带 role 字段看是否报错
  // 先尝试一次查询来检测 role 列是否存在
  const { error: testError } = await supabaseAdmin
    .from("suppliers")
    .select("role")
    .limit(1);

  if (testError?.message?.includes("role")) {
    console.log("⚠️  role 列不存在，通过 Supabase SQL Editor 添加...");
    console.log("");
    console.log("请在 Supabase Dashboard → SQL Editor 中执行以下 SQL：");
    console.log("─".repeat(60));
    console.log(`ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS role text
  DEFAULT 'supplier'
  CHECK (role IN ('supplier', 'bd', 'data_team'));`);
    console.log("─".repeat(60));
    console.log("");
    console.log("执行完后重新运行本脚本。");
    process.exit(1);
  }

  console.log("✅ role 列已存在");
}

async function seedBdAccount(email: string, companyName: string) {
  // 1. 检查 suppliers 表是否已有该邮箱
  const { data: existing } = await supabaseAdmin
    .from("suppliers")
    .select("id, contact_email, role")
    .eq("contact_email", email)
    .maybeSingle();

  if (existing) {
    if (existing.role === "bd") {
      console.log(`⏭️  ${email} 已是 BD 角色，跳过`);
      return;
    }
    // 已存在但不是 BD，更新 role
    const { error } = await supabaseAdmin
      .from("suppliers")
      .update({ role: "bd" })
      .eq("id", existing.id);
    if (error) {
      console.error(`❌ 更新 role 失败 (${email}):`, error.message);
    } else {
      console.log(`✅ ${email} 已更新为 BD 角色`);
    }
    return;
  }

  // 2. 查找或创建 auth 用户
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = userList?.users?.find((u) => u.email === email);

  let userId: string;

  if (existingUser) {
    console.log(
      `ℹ️  ${email} 已存在于 auth.users (user_id=${existingUser.id})`,
    );
    userId = existingUser.id;
  } else {
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError || !authUser.user) {
      console.error(`❌ 创建 auth 用户失败 (${email}):`, authError?.message);
      return;
    }
    userId = authUser.user.id;
    console.log(`✅ 创建 auth 用户: ${email} (user_id=${userId})`);
  }

  // 3. 检查是否已有该 user_id 的 supplier 记录（可能 contact_email 不同）
  const { data: existingByUserId } = await supabaseAdmin
    .from("suppliers")
    .select("id, contact_email, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingByUserId) {
    // 已有记录，更新 role 为 bd
    const { error } = await supabaseAdmin
      .from("suppliers")
      .update({ role: "bd" })
      .eq("id", existingByUserId.id);
    if (error) {
      console.error(`❌ 更新 role 失败 (${email}):`, error.message);
    } else {
      console.log(
        `✅ ${email} (已有 supplier 记录, contact_email=${existingByUserId.contact_email}) 已更新为 BD 角色`,
      );
    }
    return;
  }

  // 4. 插入 suppliers 记录
  const { error: supplierError } = await supabaseAdmin
    .from("suppliers")
    .insert({
      user_id: userId,
      company_name: companyName,
      contact_email: email,
      status: "SIGNED",
      role: "bd",
    });

  if (supplierError) {
    console.error(`❌ 插入 supplier 失败 (${email}):`, supplierError.message);
    return;
  }

  console.log(`✅ BD 账号配置完成: ${email}`);
}

async function main() {
  console.log("🚀 开始配置 BD 测试账号...\n");

  await ensureRoleColumn();
  console.log("");

  for (const account of BD_ACCOUNTS) {
    await seedBdAccount(account.email, account.company_name);
    console.log("");
  }

  console.log("🎉 BD 账号配置完毕！");
  console.log("📝 登录方式：访问 /login，输入邮箱接收 OTP 验证码");
}

main().catch(console.error);
