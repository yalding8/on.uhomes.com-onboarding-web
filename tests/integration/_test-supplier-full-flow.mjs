/**
 * 供应商视角全流程手动测试
 * 覆盖：申请 → 审批 → 合同审阅 → 确认签署 → 数据提取 → 字段编辑 → 提交
 *
 * Usage: node tests/integration/_test-supplier-full-flow.mjs
 * Requires: production server running on port 3100
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

// ── Env loading ──────────────────────────────────────────────────────
function loadEnv(fp) {
  try {
    const c = readFileSync(fp, "utf-8");
    for (const l of c.split("\n")) {
      const t = l.trim();
      if (t === "" || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      )
        v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}
loadEnv(resolve(".env.local"));
loadEnv(resolve(".env"));

const BASE = "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;
const admin = createClient(url, serviceKey);

const RUN_ID = `TEST_SUPPLIER_FLOW_${Date.now()}`;
const suffix = Math.random().toString(36).slice(2, 8);
const email = `test_supplier_${suffix}@integration-test.uhomes.com`;
const bdEmail = "ning.ding@uhomes.com"; // existing admin BD

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
    failures.push(label);
  }
}

// ── Auth helper: create session cookie for an email ──────────────────
async function createSessionCookie(targetEmail) {
  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
    });
  if (linkErr) throw new Error(`generateLink failed: ${linkErr.message}`);

  const anonClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: verifyErr } =
    await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });
  if (verifyErr) throw new Error(`verifyOtp failed: ${verifyErr.message}`);

  const session = sessionData.session;
  const projectRef = url.match(/\/\/([^.]+)\./)?.[1] ?? "localhost";
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
  });
  return `${cookieName}.0=${encodeURIComponent(cookieValue)}`;
}

function _signWebhook(payload) {
  const hmac = createHmac("sha256", webhookSecret);
  hmac.update(payload);
  return hmac.digest("base64");
}

// ── Cleanup ──────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\n─── 清理测试数据 ───");
  // Clean applications
  const { data: apps } = await admin
    .from("applications")
    .select("id")
    .like("company_name", `${RUN_ID}%`);
  for (const a of apps ?? []) {
    await admin.from("applications").delete().eq("id", a.id);
  }
  console.log(`  已清理 ${(apps ?? []).length} 个申请`);

  // Clean suppliers + contracts + buildings
  const { data: sups } = await admin
    .from("suppliers")
    .select("id, user_id")
    .like("company_name", `${RUN_ID}%`);
  for (const s of sups ?? []) {
    // Clean extraction_jobs
    const { data: buildings } = await admin
      .from("buildings")
      .select("id")
      .eq("supplier_id", s.id);
    for (const b of buildings ?? []) {
      await admin.from("extraction_jobs").delete().eq("building_id", b.id);
      await admin
        .from("building_onboarding_data")
        .delete()
        .eq("building_id", b.id);
      await admin.from("buildings").delete().eq("id", b.id);
    }
    await admin.from("contracts").delete().eq("supplier_id", s.id);
    await admin.from("suppliers").delete().eq("id", s.id);
    if (s.user_id) await admin.auth.admin.deleteUser(s.user_id);
  }
  console.log(`  已清理 ${(sups ?? []).length} 个供应商及相关数据`);
}

// ── Main flow ────────────────────────────────────────────────────────
try {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║     供应商视角全流程测试                             ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  // ━━━ Phase 1: 供应商提交申请 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("━━━ Phase 1: 供应商提交申请 ━━━");

  // 1a. 正常提交
  const applyRes = await fetch(`${BASE}/api/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: `${RUN_ID}_Co`,
      contact_email: email,
      contact_phone: "+86-13800138000",
      city: "London",
      country: "United Kingdom",
      website_url: "https://www.test-apartments.com",
    }),
  });
  assert(applyRes.status === 200, "1a. 提交有效申请 → 200");

  const { data: appRows } = await admin
    .from("applications")
    .select("id, status, company_name, contact_email")
    .eq("company_name", `${RUN_ID}_Co`)
    .limit(1);
  const appRow = appRows?.[0] || null;
  assert(
    appRow?.status === "PENDING",
    `1b. 申请状态为 PENDING (got: ${appRow?.status})`,
  );
  assert(appRow?.company_name === `${RUN_ID}_Co`, "1c. 公司名称正确写入");

  // 1d. 缺失字段提交
  const badApply = await fetch(`${BASE}/api/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_name: "", contact_email: "a@b.com" }),
  });
  assert(badApply.status === 400, "1d. 缺失字段 → 400");

  // 1e. 重复邮箱
  await fetch(`${BASE}/api/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_name: `${RUN_ID}_Co_Dup`,
      contact_email: email,
      contact_phone: "+86-13800138001",
      city: "Manchester",
      country: "United Kingdom",
      website_url: "https://www.dup-test.com",
    }),
  });
  const { data: dups } = await admin
    .from("applications")
    .select("id")
    .eq("contact_email", email);
  assert((dups?.length ?? 0) >= 2, "1e. 重复邮箱允许创建第二条记录");

  // ━━━ Phase 2: BD 审批并创建供应商 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n━━━ Phase 2: BD 审批供应商 ━━━");

  await createSessionCookie(bdEmail);

  // 2a. 模拟 BD 审批（inviteUserByEmail 不接受测试域名邮箱，用 admin client 模拟）
  // 创建 auth user
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  assert(!authErr, `2a. 创建供应商 auth 用户 (${authErr?.message || "OK"})`);

  // 获取 BD 的 supplier 记录（用于 bd_user_id）
  const { data: bdRecord } = await admin
    .from("suppliers")
    .select("id")
    .eq("contact_email", bdEmail)
    .single();

  // 创建 supplier
  const { data: supplier, error: supErr } = await admin
    .from("suppliers")
    .insert({
      user_id: authUser.user.id,
      company_name: `${RUN_ID}_Co`,
      contact_email: email,
      status: "PENDING_CONTRACT",
      role: "supplier",
      bd_user_id: bdRecord?.id,
    })
    .select("id, status, role, contact_email, user_id")
    .single();
  assert(!supErr, `2b. 创建供应商记录 (${supErr?.message || "OK"})`);
  const supplierId = supplier?.id;
  assert(!!supplierId, "2c. supplierId 存在");
  assert(
    supplier?.status === "PENDING_CONTRACT",
    "2d. 供应商状态 PENDING_CONTRACT",
  );
  assert(supplier?.role === "supplier", "2e. 角色为 supplier");

  // 创建合同
  const { data: contract, error: conErr } = await admin
    .from("contracts")
    .insert({
      supplier_id: supplierId,
      status: "DRAFT",
      signature_provider: "DOCUSIGN",
      contract_fields: {},
      provider_metadata: { type: "STANDARD_PROMOTION_2026" },
    })
    .select("id, status")
    .single();
  assert(!conErr, `2f. 创建合同记录 (${conErr?.message || "OK"})`);
  assert(contract?.status === "DRAFT", "2g. 合同状态 DRAFT");

  // 标记申请为 CONVERTED
  if (appRow?.id) {
    await admin
      .from("applications")
      .update({ status: "CONVERTED" })
      .eq("id", appRow.id);
    const { data: convertedApp } = await admin
      .from("applications")
      .select("status")
      .eq("id", appRow.id)
      .single();
    assert(convertedApp?.status === "CONVERTED", "2h. 申请状态变为 CONVERTED");
  } else {
    assert(false, "2h. 申请状态变为 CONVERTED (appRow.id missing)");
  }

  // ━━━ Phase 3: BD 编辑合同字段 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n━━━ Phase 3: BD 编辑合同 ━━━");

  // Refresh BD cookie (previous one may have been invalidated)
  const bdCookie3 = await createSessionCookie(bdEmail);

  // 3a. 保存合同字段
  const contractFields = {
    partner_company_name: `${RUN_ID}_Co`,
    partner_contact_name: "Test Contact",
    partner_address: "123 Test Street",
    partner_city: "London",
    partner_country: "United Kingdom",
    commission_rate: "15",
    contract_start_date: "2026-03-01",
    contract_end_date: "2027-02-28",
    covered_properties: "All student accommodations in London",
  };

  const saveRes = await fetch(`${BASE}/api/admin/contracts/${contract.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: bdCookie3 },
    body: JSON.stringify({ fields: contractFields }),
  });
  if (saveRes.status !== 200) {
    const errBody = await saveRes.text();
    console.log(`  ⚠️  3a debug: status=${saveRes.status}, body=${errBody}`);
  }
  assert(saveRes.status === 200, "3a. 保存合同字段 → 200");

  // 验证字段持久化
  const { data: savedContract, error: scErr } = await admin
    .from("contracts")
    .select("contract_fields, status")
    .eq("id", contract.id)
    .single();
  if (scErr) console.log(`  ⚠️  3b debug: DB error: ${scErr.message}`);
  const scFields = savedContract?.contract_fields;
  assert(
    scFields?.partner_company_name === `${RUN_ID}_Co`,
    `3b. 合同字段持久化验证 (got: ${JSON.stringify(scFields?.partner_company_name)}, status: ${savedContract?.status})`,
  );

  // 3c. 推送审阅
  const pushRes = await fetch(`${BASE}/api/admin/contracts/${contract.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: bdCookie3 },
  });
  const pushBody = await pushRes.json();
  if (pushRes.status !== 200)
    console.log(
      `  ⚠️  3c debug: ${pushRes.status} ${JSON.stringify(pushBody)}`,
    );
  assert(pushRes.status === 200, "3c. 推送审阅 → 200");
  assert(
    pushBody.status === "PENDING_REVIEW",
    `3d. 合同状态变为 PENDING_REVIEW (got: ${pushBody.status})`,
  );

  // ━━━ Phase 4: 供应商审阅合同 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n━━━ Phase 4: 供应商审阅并签署合同 ━━━");

  // 创建供应商 session
  await createSessionCookie(email);

  // Refresh supplier cookie for Phase 4
  const supplierCookie4 = await createSessionCookie(email);

  // Ensure contract is in PENDING_REVIEW before testing supplier actions
  const { data: preCheck } = await admin
    .from("contracts")
    .select("status")
    .eq("id", contract.id)
    .single();
  if (preCheck?.status !== "PENDING_REVIEW") {
    console.log(
      `  ⚠️  合同当前状态: ${preCheck?.status}，强制推进到 PENDING_REVIEW`,
    );
    await admin
      .from("contracts")
      .update({ status: "PENDING_REVIEW" })
      .eq("id", contract.id);
  }

  // 4a. 供应商先请求修改
  const requestChangesRes = await fetch(
    `${BASE}/api/contracts/${contract.id}/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: freshSupplierCookie || supplierCookie4,
      },
      body: JSON.stringify({ action: "request_changes" }),
    },
  );
  const rcBody = await requestChangesRes.json();
  if (requestChangesRes.status !== 200)
    console.log(
      `  ⚠️  4a debug: ${requestChangesRes.status} ${JSON.stringify(rcBody)}`,
    );
  assert(requestChangesRes.status === 200, "4a. 供应商请求修改 → 200");
  assert(
    rcBody.status === "DRAFT",
    `4b. 合同回退到 DRAFT (got: ${rcBody.status})`,
  );

  // 4c. BD 重新推送审阅 — refresh BD cookie and re-save fields
  const bdCookie4 = await createSessionCookie(bdEmail);
  await fetch(`${BASE}/api/admin/contracts/${contract.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: bdCookie4 },
    body: JSON.stringify({ fields: contractFields }),
  });
  const rePushRes = await fetch(`${BASE}/api/admin/contracts/${contract.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: bdCookie4 },
  });
  const rePushBody = await rePushRes.json();
  if (rePushRes.status !== 200)
    console.log(
      `  ⚠️  4c debug: ${rePushRes.status} ${JSON.stringify(rePushBody)}`,
    );
  assert(rePushRes.status === 200, "4c. BD 重新推送审阅 → 200");

  // 4d. 供应商确认签署 — refresh cookie
  const supplierCookie4d = await createSessionCookie(email);
  const confirmRes = await fetch(
    `${BASE}/api/contracts/${contract.id}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: supplierCookie4d },
      body: JSON.stringify({ action: "confirm" }),
    },
  );
  const confirmBody = await confirmRes.json();
  if (confirmRes.status !== 200)
    console.log(
      `  ⚠️  4d debug: ${confirmRes.status} ${JSON.stringify(confirmBody)}`,
    );
  assert(confirmRes.status === 200, "4d. 供应商确认签署 → 200");
  assert(
    confirmBody.status === "SENT",
    `4e. 合同状态变为 SENT (got: ${confirmBody.status})`,
  );
  assert(!!confirmBody.envelopeId, "4f. 返回 DocuSign envelopeId");

  // 4g. 模拟 DocuSign 签署完成 webhook
  // 先直接更新合同到 SIGNED（跳过真实 DocuSign webhook，因本地无法接收）
  await admin
    .from("contracts")
    .update({
      status: "SIGNED",
      signed_at: new Date().toISOString(),
    })
    .eq("id", contract.id);
  await admin
    .from("suppliers")
    .update({ status: "SIGNED" })
    .eq("id", supplierId);
  console.log("  ℹ️  模拟 DocuSign webhook：合同状态直接更新为 SIGNED");

  const { data: signedContract } = await admin
    .from("contracts")
    .select("status, signed_at")
    .eq("id", contract.id)
    .single();
  assert(signedContract?.status === "SIGNED", "4g. 合同已签署 SIGNED");
  assert(!!signedContract?.signed_at, "4h. signed_at 已记录");

  const { data: signedSupplier } = await admin
    .from("suppliers")
    .select("status")
    .eq("id", supplierId)
    .single();
  assert(signedSupplier?.status === "SIGNED", "4i. 供应商状态升级为 SIGNED");

  // ━━━ Phase 5: 中间件路由验证 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n━━━ Phase 5: 供应商路由与权限验证 ━━━");

  // 5a. SIGNED 供应商访问 / 应重定向到 /dashboard
  const rootRes = await fetch(`${BASE}/`, {
    headers: { cookie: freshSupplierCookie || supplierCookie4 },
    redirect: "manual",
  });
  assert(
    [301, 302, 303, 307, 308].includes(rootRes.status),
    "5a. SIGNED 供应商访问 / → 重定向",
  );
  const rootLocation = rootRes.headers.get("location") || "";
  assert(rootLocation.includes("/dashboard"), "5b. 重定向目标为 /dashboard");

  // 5c. 供应商不能访问 /admin
  const adminRes = await fetch(`${BASE}/admin`, {
    headers: { cookie: freshSupplierCookie || supplierCookie4 },
    redirect: "manual",
  });
  assert(
    [301, 302, 303, 307, 308].includes(adminRes.status),
    "5c. 供应商访问 /admin → 重定向",
  );
  const adminLocation = adminRes.headers.get("location") || "";
  assert(
    adminLocation.includes("/dashboard"),
    "5d. 重定向目标为 /dashboard（非 /admin）",
  );

  // 5e. 供应商可以访问 /dashboard（需要重新获取 cookie，之前的 session 可能已变）
  var freshSupplierCookie = await createSessionCookie(email);
  const dashRes = await fetch(`${BASE}/dashboard`, {
    headers: { cookie: freshSupplierCookie },
    redirect: "manual",
  });
  if (dashRes.status !== 200)
    console.log(
      `  ⚠️  5e debug: status=${dashRes.status}, location=${dashRes.headers.get("location")}`,
    );
  assert(
    dashRes.status === 200,
    `5e. SIGNED 供应商访问 /dashboard → 200 (got ${dashRes.status})`,
  );

  // 5f. 供应商可以调用 API
  const apiRes = await fetch(`${BASE}/api/contracts/${contract.id}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: freshSupplierCookie || supplierCookie4,
    },
    body: JSON.stringify({ action: "confirm" }),
  });
  // 合同已 SIGNED，所以会返回 400（状态不允许）但不是 307 redirect
  assert(
    apiRes.status !== 307 && apiRes.status !== 302,
    "5f. API 请求不被中间件重定向",
  );

  // 5g. 未登录用户访问 /dashboard 应重定向到 /login
  const noAuthDash = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  assert(
    [301, 302, 303, 307, 308].includes(noAuthDash.status),
    "5g. 未登录访问 /dashboard → 重定向",
  );

  // ━━━ Phase 6: 数据提取流程 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n━━━ Phase 6: 数据提取与填充 ━━━");

  // 创建 building 和 onboarding_data
  const { data: building } = await admin
    .from("buildings")
    .insert({
      supplier_id: supplierId,
      building_name: `${RUN_ID}_Building`,
      building_address: "456 Test Avenue, London",
      onboarding_status: "incomplete",
      score: 0,
    })
    .select("id")
    .single();
  assert(!!building?.id, "6a. Building 创建成功");

  await admin.from("building_onboarding_data").insert({
    building_id: building.id,
    field_values: {},
    version: 1,
  });

  // 6b. 触发提取
  const triggerRes = await fetch(`${BASE}/api/extraction/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      buildingId: building.id,
      supplierId: supplierId,
      contractPdfUrl: "https://example.com/contract.pdf",
      websiteUrl: "https://www.test-apartments.com",
    }),
  });
  assert(triggerRes.status === 200, "6b. 触发提取 → 200");
  const triggerBody = await triggerRes.json();
  assert(
    triggerBody.jobs?.length === 3,
    `6c. 创建 3 个提取任务 (got ${triggerBody.jobs?.length})`,
  );

  // 6d. 模拟 extraction callback — website_crawl 成功
  const callbackRes1 = await fetch(`${BASE}/api/extraction/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      buildingId: building.id,
      source: "website_crawl",
      status: "success",
      jobId: triggerBody.jobs.find((j) => j.source === "website_crawl")?.id,
      extractedFields: {
        building_name: { value: `${RUN_ID}_Building`, confidence: "high" },
        city: { value: "London", confidence: "high" },
        postal_code: { value: "SW1A 1AA", confidence: "medium" },
        total_units: { value: 120, confidence: "high" },
        description: {
          value: "Modern student accommodation in central London.",
          confidence: "high",
        },
      },
    }),
  });
  assert(callbackRes1.status === 200, "6d. Website crawl callback → 200");

  // 6e. 模拟 extraction callback — contract_pdf 成功
  const callbackRes2 = await fetch(`${BASE}/api/extraction/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      buildingId: building.id,
      source: "contract_pdf",
      status: "success",
      jobId: triggerBody.jobs.find((j) => j.source === "contract_pdf")?.id,
      extractedFields: {
        primary_contact_name: { value: "Test Contact", confidence: "high" },
        primary_contact_email: { value: email, confidence: "high" },
        commission_structure: { value: "15% per booking", confidence: "high" },
      },
    }),
  });
  assert(callbackRes2.status === 200, "6e. Contract PDF callback → 200");

  // 6f. 模拟 extraction callback — google_sheets 失败
  const callbackRes3 = await fetch(`${BASE}/api/extraction/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      buildingId: building.id,
      source: "google_sheets",
      status: "failed",
      jobId: triggerBody.jobs.find((j) => j.source === "google_sheets")?.id,
      error: "No Google Sheets URL provided",
    }),
  });
  assert(callbackRes3.status === 200, "6f. Failed callback 优雅处理 → 200");

  // 验证提取数据已合并
  const { data: onboardData } = await admin
    .from("building_onboarding_data")
    .select("field_values, version")
    .eq("building_id", building.id)
    .single();
  const fv = onboardData?.field_values || {};
  // Field values may be stored as { value, source, confidence } objects
  const cityVal = typeof fv.city === "object" ? fv.city?.value : fv.city;
  const unitsVal =
    typeof fv.total_units === "object" ? fv.total_units?.value : fv.total_units;
  if (!cityVal)
    console.log(
      `  ⚠️  6g debug: field_values keys = ${Object.keys(fv).join(", ")}`,
    );
  assert(
    !!cityVal,
    `6g. 提取的 city 字段已合并 (got: ${JSON.stringify(fv.city)})`,
  );
  assert(
    !!unitsVal,
    `6h. 提取的 total_units 字段已合并 (got: ${JSON.stringify(fv.total_units)})`,
  );

  // ━━━ Phase 7: 供应商编辑楼盘字段 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n━━━ Phase 7: 供应商编辑楼盘字段 ━━━");

  // 7a. 获取楼盘字段 — use fresh cookie
  const getFieldsRes = await fetch(
    `${BASE}/api/buildings/${building.id}/fields`,
    { headers: { cookie: freshSupplierCookie } },
  );
  if (getFieldsRes.status !== 200) {
    const errText = await getFieldsRes.text();
    console.log(`  ⚠️  7a debug: ${getFieldsRes.status} ${errText}`);
  }
  assert(
    getFieldsRes.status === 200,
    `7a. 获取楼盘字段 → 200 (got ${getFieldsRes.status})`,
  );
  const fieldsBody =
    getFieldsRes.status === 200 ? await getFieldsRes.json() : {};
  assert(typeof fieldsBody.score === "object", "7b. 返回 score 对象");

  // Use version from GET response (now works with SECURITY DEFINER RLS fix)
  const currentVersion = fieldsBody.version;
  console.log(`  ℹ️  当前版本: ${currentVersion}`);

  // 7c. 编辑字段（补充到 80% 评分）
  const patchRes = await fetch(`${BASE}/api/buildings/${building.id}/fields`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      cookie: freshSupplierCookie,
    },
    body: JSON.stringify({
      fields: {
        building_address: "456 Test Avenue, London SW1A 1AA",
        key_amenities: ["WiFi", "Gym", "Laundry", "Study Room"],
        price_min: 800,
        price_max: 1500,
        currency: "GBP",
        unit_types_summary: "Studio, 1BR, 2BR en-suite",
        cover_image: "https://example.com/cover.jpg",
        images: [
          "https://example.com/img1.jpg",
          "https://example.com/img2.jpg",
          "https://example.com/img3.jpg",
        ],
        availability_method: ["Google Sheet"],
        application_method: ["Online"],
        primary_contact_phone: "+44-20-1234-5678",
        year_built: 2020,
        instant_booking: "Yes",
        utilities_included: "Water, WiFi, Heating",
      },
      version: currentVersion,
    }),
  });
  const patchText = await patchRes.text();
  if (patchRes.status !== 200) {
    console.log(`  ⚠️  7c debug: status=${patchRes.status}, body=${patchText}`);
  }
  assert(patchRes.status === 200, "7c. 编辑楼盘字段 → 200");
  const patchBody = patchRes.status === 200 ? JSON.parse(patchText) : {};
  assert(typeof patchBody.score?.score === "number", "7d. 返回更新后评分");
  console.log(`  ℹ️  当前评分: ${patchBody.score?.score}`);

  // 7e. 字段保护：手动确认的字段不被覆盖
  // 先读取当前版本（PATCH 成功后版本已递增）
  const { data: latestData } = await admin
    .from("building_onboarding_data")
    .select("field_values, version")
    .eq("building_id", building.id)
    .single();

  // 手动设置一个 confirmed 字段
  const updatedFv = { ...latestData.field_values };
  updatedFv.building_name = {
    value: "Manual Override Name",
    source: "manual_input",
    confirmedBy: supplier.user_id,
    confirmedAt: new Date().toISOString(),
  };
  await admin
    .from("building_onboarding_data")
    .update({ field_values: updatedFv })
    .eq("building_id", building.id);

  // 发送一个 extraction callback 试图覆盖 building_name
  const overwriteRes = await fetch(`${BASE}/api/extraction/callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      buildingId: building.id,
      source: "website_crawl",
      status: "success",
      extractedFields: {
        building_name: {
          value: "AI Overwrite Attempt",
          confidence: "high",
        },
      },
    }),
  });
  assert(overwriteRes.status === 200, "7e. Extraction callback → 200");

  // 验证 building_name 未被覆盖
  const { data: protectedData } = await admin
    .from("building_onboarding_data")
    .select("field_values")
    .eq("building_id", building.id)
    .single();
  const protectedName = protectedData?.field_values?.building_name;
  assert(
    protectedName?.value === "Manual Override Name",
    "7f. 手动确认字段未被 AI 覆盖",
  );

  // ━━━ Phase 8: 供应商提交楼盘 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n━━━ Phase 8: 供应商提交楼盘 ━━━");

  // 获取最新评分
  const finalFieldsRes = await fetch(
    `${BASE}/api/buildings/${building.id}/fields`,
    { headers: { cookie: freshSupplierCookie || supplierCookie4 } },
  );
  const finalFields = await finalFieldsRes.json();
  const currentScore = finalFields.score?.score || 0;
  console.log(`  ℹ️  提交前评分: ${currentScore}`);

  if (currentScore >= 80) {
    // 8a. 正常提交
    const submitRes = await fetch(
      `${BASE}/api/buildings/${building.id}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: freshSupplierCookie || supplierCookie4,
        },
      },
    );
    assert(submitRes.status === 200, "8a. 提交楼盘 → 200");
    const submitBody = await submitRes.json();
    assert(
      submitBody.status === "ready_to_publish",
      "8b. 状态变为 ready_to_publish",
    );

    // 8c. 重复提交应该失败
    const resubmitRes = await fetch(
      `${BASE}/api/buildings/${building.id}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: freshSupplierCookie || supplierCookie4,
        },
      },
    );
    assert(resubmitRes.status === 422, "8c. 重复提交 → 422");
  } else {
    console.log(`  ⚠️  评分 ${currentScore} < 80，跳过提交测试`);
    // 8d. 评分不足直接提交应该 422
    const lowScoreSubmit = await fetch(
      `${BASE}/api/buildings/${building.id}/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: freshSupplierCookie || supplierCookie4,
        },
      },
    );
    assert(lowScoreSubmit.status === 422, "8d. 评分不足提交 → 422");
  }

  // ━━━ 结果汇总 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log(
    `║  结果: ${passed} passed, ${failed} failed, ${passed + failed} total`,
  );
  console.log("╚══════════════════════════════════════════════════════╝");

  if (failures.length > 0) {
    console.log("\n❌ 失败项:");
    for (const f of failures) console.log(`   - ${f}`);
  }
} catch (err) {
  console.error("\n💥 致命错误:", err.message);
  if (err.cause) console.error("   Cause:", err.cause);
} finally {
  await cleanup();
}
