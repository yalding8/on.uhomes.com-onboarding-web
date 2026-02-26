/**
 * Test DocuSign integration end-to-end:
 * 1. JWT authentication
 * 2. Envelope creation (dry-run with draft status)
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import jwt from "jsonwebtoken";

// Load env
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (process.env[key] === undefined) process.env[key] = val;
}

async function main() {
  console.log("=== Step 1: Check env vars ===");
  const required = [
    "DOCUSIGN_CLIENT_ID",
    "DOCUSIGN_USER_ID",
    "DOCUSIGN_ACCOUNT_ID",
    "DOCUSIGN_AUTH_SERVER",
    "DOCUSIGN_TEMPLATE_ID",
    "DOCUSIGN_WEBHOOK_SECRET",
    "DOCUSIGN_PRIVATE_KEY",
  ];

  let allPresent = true;
  for (const key of required) {
    const val = process.env[key];
    if (val === undefined || val === "") {
      console.error(`  MISSING: ${key}`);
      allPresent = false;
    } else {
      console.log(`  OK: ${key} (${val.length} chars)`);
    }
  }
  if (allPresent === false) {
    console.error("Missing env vars, aborting.");
    return;
  }

  console.log("\n=== Step 2: Decode private key ===");
  const rawKey = process.env.DOCUSIGN_PRIVATE_KEY as string;
  let privateKey: string;
  try {
    privateKey = Buffer.from(rawKey, "base64").toString("utf-8");
    const firstLine = privateKey.split("\n")[0];
    console.log(`  First line: ${firstLine}`);
    console.log(`  Key length: ${privateKey.length} chars`);
    if (privateKey.includes("BEGIN") === false) {
      console.error("  ERROR: Decoded key doesn't look like a PEM key");
      return;
    }
    console.log("  OK: Key decoded successfully");
  } catch (e) {
    console.error("  ERROR: Failed to decode Base64 key:", e);
    return;
  }

  console.log("\n=== Step 3: JWT authentication ===");
  try {
    console.log("  Signing JWT...");
    const assertion = jwt.sign(
      {
        iss: process.env.DOCUSIGN_CLIENT_ID,
        sub: process.env.DOCUSIGN_USER_ID,
        aud: process.env.DOCUSIGN_AUTH_SERVER,
        scope: "signature impersonation",
      },
      privateKey,
      {
        algorithm: "RS256",
        expiresIn: 3600,
        notBefore: 0,
        header: { typ: "JWT", alg: "RS256" },
      },
    );
    console.log(`  JWT created: ${assertion.slice(0, 50)}...`);

    const tokenUrl = `https://${process.env.DOCUSIGN_AUTH_SERVER}/oauth/token`;
    console.log(`  Token URL: ${tokenUrl}`);
    console.log("  Fetching access token...");

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(15000),
    });

    console.log(`  Response status: ${res.status}`);

    if (res.ok === false) {
      const text = await res.text();
      console.error(`  FAILED: ${res.status} ${text}`);
      return;
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    console.log(`  OK: Got access_token (expires in ${data.expires_in}s)`);

    console.log("\n=== Step 4: Test template access ===");
    const baseUrl = "https://demo.docusign.net/restapi";
    const templateUrl = `${baseUrl}/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}/templates/${process.env.DOCUSIGN_TEMPLATE_ID}`;

    const templateRes = await fetch(templateUrl, {
      headers: { Authorization: `Bearer ${data.access_token}` },
      signal: AbortSignal.timeout(15000),
    });

    if (templateRes.ok === false) {
      const text = await templateRes.text();
      console.error(`  FAILED: ${templateRes.status} ${text}`);
      return;
    }

    const template = (await templateRes.json()) as {
      name: string;
      templateId: string;
    };
    console.log(`  OK: Template found: "${template.name}"`);

    console.log("\n=== Step 5: Create test envelope (DRAFT, won't send) ===");
    const envelopeUrl = `${baseUrl}/v2.1/accounts/${process.env.DOCUSIGN_ACCOUNT_ID}/envelopes`;

    const envelopeBody = {
      templateId: process.env.DOCUSIGN_TEMPLATE_ID,
      templateRoles: [
        {
          email: "zhangabby265@gmail.com",
          name: "house 4 you",
          roleName: "signer",
          tabs: {
            textTabs: [
              {
                tabLabel: "partner_company_name",
                value: "house 4 you",
              },
              {
                tabLabel: "partner_contact_name",
                value: "Li SHUHUI",
              },
            ],
          },
        },
      ],
      status: "created", // DRAFT - won't send email
    };

    const envRes = await fetch(envelopeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopeBody),
      signal: AbortSignal.timeout(15000),
    });

    if (envRes.ok === false) {
      const text = await envRes.text();
      console.error(`  FAILED: ${envRes.status} ${text}`);
      return;
    }

    const envelope = (await envRes.json()) as { envelopeId: string };
    console.log(`  OK: Draft envelope created: ${envelope.envelopeId}`);

    // Void the test draft so it doesn't linger
    console.log("\n=== Step 6: Void test envelope ===");
    const voidRes = await fetch(`${envelopeUrl}/${envelope.envelopeId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "voided",
        voidedReason: "Test envelope - auto cleanup",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (voidRes.ok) {
      console.log("  OK: Test envelope voided");
    } else {
      console.log(
        `  Note: Could not void (${voidRes.status}), draft will expire`,
      );
    }

    console.log("\n=== ALL TESTS PASSED ===");
    console.log(
      "DocuSign integration is working. JWT auth, template, and envelope creation all verified.",
    );
  } catch (e) {
    console.error("  ERROR:", e);
  }
}

main().catch(console.error);
