/**
 * Building Preview Page — /dashboard/preview/[buildingId]
 *
 * P2-G6: uhomes.com-style preview of a building listing.
 * Shows all fields with placeholders for missing data.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIELD_SCHEMA } from "@/lib/onboarding/field-schema";
import { calculateScore } from "@/lib/onboarding/scoring-engine";
import type { FieldValue } from "@/lib/onboarding/field-value";
import PreviewContent from "./preview-content";

interface PageProps {
  params: Promise<{ buildingId: string }>;
}

export default async function PreviewPage({ params }: PageProps) {
  const { buildingId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!supplier) redirect("/login");

  const { data: building } = await admin
    .from("buildings")
    .select("id, supplier_id, building_name, onboarding_status")
    .eq("id", buildingId)
    .eq("supplier_id", supplier.id)
    .single();

  if (!building) redirect("/dashboard");

  const { data: onboardingData } = await admin
    .from("building_onboarding_data")
    .select("field_values")
    .eq("building_id", buildingId)
    .single();

  const fieldValues = (onboardingData?.field_values ?? {}) as Record<
    string,
    FieldValue
  >;
  const scoreResult = calculateScore(FIELD_SCHEMA, fieldValues);

  return (
    <PreviewContent
      buildingId={buildingId}
      fieldValues={fieldValues}
      score={scoreResult.score}
      missingCount={scoreResult.missingFields.length}
    />
  );
}
