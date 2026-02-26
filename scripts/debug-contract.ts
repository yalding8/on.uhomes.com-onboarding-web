import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // Check the specific contract for zhangabby265@gmail.com
  const { data: contract, error: cErr } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", "df75d573-ff2d-4e50-96f8-71b0163094de")
    .single();

  if (cErr) {
    console.error("contract error:", cErr);
    return;
  }

  console.log("=== CONTRACT ===");
  console.log(JSON.stringify(contract, null, 2));

  // Check supplier
  const { data: supplier, error: sErr } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", contract.supplier_id)
    .single();

  if (sErr) {
    console.error("supplier error:", sErr);
    return;
  }

  console.log("\n=== SUPPLIER ===");
  console.log(JSON.stringify(supplier, null, 2));

  // Check DocuSign env vars
  console.log("\n=== DOCUSIGN ENV VARS ===");
  const keys = [
    "DOCUSIGN_CLIENT_ID",
    "DOCUSIGN_USER_ID",
    "DOCUSIGN_ACCOUNT_ID",
    "DOCUSIGN_AUTH_SERVER",
    "DOCUSIGN_TEMPLATE_ID",
    "DOCUSIGN_WEBHOOK_SECRET",
    "DOCUSIGN_PRIVATE_KEY",
    "NEXT_PUBLIC_APP_URL",
  ];
  for (const key of keys) {
    const val = process.env[key];
    if (val) {
      console.log(
        `  ${key}: ${val.length > 20 ? val.slice(0, 20) + "..." : val}`,
      );
    } else {
      console.log(`  ${key}: *** MISSING ***`);
    }
  }
}

main().catch(console.error);
