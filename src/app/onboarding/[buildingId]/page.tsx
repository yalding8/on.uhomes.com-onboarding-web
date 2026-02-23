/**
 * Building Onboarding 编辑页面 — Server Component。
 * 获取 building 数据、score、gap report，传递给 OnboardingForm 客户端组件。
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { FIELD_SCHEMA } from '@/lib/onboarding/field-schema';
import { calculateScore } from '@/lib/onboarding/scoring-engine';
import { generateGapReport } from '@/lib/onboarding/gap-report';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';
import type { FieldValue } from '@/lib/onboarding/field-value';
import type { BuildingStatus } from '@/lib/onboarding/status-engine';

interface PageProps {
  params: Promise<{ buildingId: string }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { buildingId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 查询 building 基本信息（RLS 自动过滤权限）
  const { data: building, error: buildingErr } = await supabase
    .from('buildings')
    .select('id, building_name, building_address, onboarding_status, supplier_id')
    .eq('id', buildingId)
    .single();

  if (buildingErr || !building) notFound();

  // 查询 onboarding 数据
  const { data: onboardingData } = await supabase
    .from('building_onboarding_data')
    .select('field_values, version')
    .eq('building_id', buildingId)
    .single();

  const fieldValues: Record<string, FieldValue> = onboardingData?.field_values ?? {};
  const version = onboardingData?.version ?? 0;

  const score = calculateScore(FIELD_SCHEMA, fieldValues);
  const gapReport = generateGapReport(FIELD_SCHEMA, fieldValues, buildingId);
  const status = (building.onboarding_status ?? 'incomplete') as BuildingStatus;

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* 返回 Dashboard */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <OnboardingForm
          buildingId={buildingId}
          buildingName={building.building_name ?? 'Unnamed Building'}
          initialFields={fieldValues}
          initialScore={score}
          initialGapReport={gapReport}
          initialVersion={version}
          initialStatus={status}
        />
      </div>
    </div>
  );
}
