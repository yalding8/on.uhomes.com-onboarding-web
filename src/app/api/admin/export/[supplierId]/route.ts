/**
 * Export Supplier Data — GET /api/admin/export/[supplierId]
 *
 * P3-G7: Export building data for uhomes.com integration.
 * Supports ?format=json (default) and ?format=csv.
 *
 * Auth: Session (BD/admin role)
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import type { FieldValue } from "@/lib/onboarding/field-value";

interface RouteContext {
  params: Promise<{ supplierId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) return authResult;

    const { supplierId } = await context.params;
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";

    const admin = createAdminClient();

    const { data: supplier } = await admin
      .from("suppliers")
      .select("id, company_name, contact_email, website, status")
      .eq("id", supplierId)
      .single();

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 404 },
      );
    }

    const { data: contract } = await admin
      .from("contracts")
      .select("id, status, contract_fields")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const { data: buildings } = await admin
      .from("buildings")
      .select("id, building_name, onboarding_status")
      .eq("supplier_id", supplierId);

    const buildingExports = [];

    for (const b of buildings ?? []) {
      const { data: onboarding } = await admin
        .from("building_onboarding_data")
        .select("field_values")
        .eq("building_id", b.id)
        .single();

      const fv = (onboarding?.field_values ?? {}) as Record<string, FieldValue>;
      const scoreResult = calculateScore(FIELD_SCHEMA, fv);

      // Extract raw values for export
      const fields: Record<string, unknown> = {};
      for (const [key, fieldValue] of Object.entries(fv)) {
        fields[key] = fieldValue.value;
      }

      buildingExports.push({
        id: b.id,
        name: b.building_name,
        status: b.onboarding_status,
        score: scoreResult.score,
        missingFields: scoreResult.missingFields,
        fields,
      });
    }

    const exportData = {
      supplier: {
        id: supplier.id,
        company_name: supplier.company_name,
        contact_email: supplier.contact_email,
        website: supplier.website,
        status: supplier.status,
      },
      contract: contract
        ? {
            id: contract.id,
            status: contract.status,
            fields: contract.contract_fields,
          }
        : null,
      buildings: buildingExports,
      exportedAt: new Date().toISOString(),
    };

    if (format === "csv") {
      return buildCsvResponse(exportData);
    }

    return NextResponse.json(exportData);
  } catch (err) {
    console.error("[export]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

interface ExportData {
  supplier: Record<string, unknown>;
  buildings: Array<{
    id: string;
    name: string;
    status: string;
    score: number;
    fields: Record<string, unknown>;
  }>;
}

function buildCsvResponse(data: ExportData): NextResponse {
  const rows: string[] = [];

  // Collect all field keys
  const allKeys = new Set<string>();
  for (const b of data.buildings) {
    for (const key of Object.keys(b.fields)) {
      allKeys.add(key);
    }
  }
  const keys = Array.from(allKeys).sort();

  // Header
  rows.push(
    ["building_id", "building_name", "status", "score", ...keys]
      .map(csvEscape)
      .join(","),
  );

  // Rows
  for (const b of data.buildings) {
    const values = keys.map((k) => {
      const v = b.fields[k];
      return v === null || v === undefined ? "" : String(v);
    });
    rows.push(
      [b.id, b.name, b.status, String(b.score), ...values]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${data.supplier.id}.csv"`,
    },
  });
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
