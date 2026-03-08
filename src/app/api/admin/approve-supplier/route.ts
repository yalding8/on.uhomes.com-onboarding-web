import { NextResponse } from "next/server";
import { verifyAdminRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_CONTRACT_TYPES = [
  "STANDARD_PROMOTION_2026",
  "PREMIUM_PROMOTION_2026",
] as const;

export async function POST(request: Request) {
  let claimedApplicationId: string | null = null;
  try {
    // 1. Authorization: verify admin role (H-03 fix)
    const authResult = await verifyAdminRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const payload = await request.json();
    const { application_id, contract_type } = payload;

    if (!application_id) {
      return NextResponse.json(
        { error: "application_id is required" },
        { status: 400 },
      );
    }

    // Validate contract_type against allowlist
    const resolvedContractType =
      contract_type && VALID_CONTRACT_TYPES.includes(contract_type)
        ? contract_type
        : "STANDARD_PROMOTION_2026";

    const supabaseAdmin = createAdminClient();

    // 2. Atomic claim: set PENDING → CONVERTING to prevent race conditions (C-05 fix)
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("applications")
      .update({ status: "CONVERTING" })
      .eq("id", application_id)
      .eq("status", "PENDING")
      .select("*")
      .single();

    if (claimError || !claimed) {
      return NextResponse.json(
        {
          error:
            "Application not found or already being processed by another admin",
        },
        { status: 409 },
      );
    }

    claimedApplicationId = claimed.id as string;
    const application = claimed;

    // 3. Check if a supplier already exists for this email
    const { data: existingSupplier } = await supabaseAdmin
      .from("suppliers")
      .select("id")
      .eq("contact_email", application.contact_email)
      .maybeSingle();

    if (existingSupplier) {
      return NextResponse.json(
        { error: "A supplier with this email already exists" },
        { status: 409 },
      );
    }

    // 4. Create Auth user — must happen first as supplier requires user_id
    // Try invite; if the email already exists in auth (e.g. user triggered OTP
    // before approval), reuse the existing auth user instead of failing.
    let userId: string;
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        application.contact_email,
      );

    if (authError || !authUser.user) {
      // Attempt to find existing auth user by creating with existing email
      const { data: createResult, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: application.contact_email,
          email_confirm: true,
        });

      if (createError || !createResult.user) {
        // Both invite and create failed — check if "already registered" style error
        const errorMsg =
          (authError?.message ?? "") + (createError?.message ?? "");
        if (errorMsg.toLowerCase().includes("already")) {
          // Find the existing user via admin list (paginated to limit scope)
          const { data: listed } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 1000,
          });
          const found = listed?.users?.find(
            (u: { email?: string }) => u.email === application.contact_email,
          );
          if (found) {
            userId = found.id;
          } else {
            console.error("[approve-supplier]", authError, createError);
            return NextResponse.json(
              { error: "Failed to create auth user" },
              { status: 500 },
            );
          }
        } else {
          console.error("[approve-supplier]", authError, createError);
          return NextResponse.json(
            { error: "Failed to create auth user" },
            { status: 500 },
          );
        }
      } else {
        userId = createResult.user.id;
      }
    } else {
      userId = authUser.user.id;
    }

    // 5. Create supplier record — rollback Auth user on failure
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .insert({
        user_id: userId,
        company_name: application.company_name,
        supplier_type: application.supplier_type ?? null,
        contact_email: application.contact_email,
        status: "PENDING_CONTRACT",
        role: "supplier",
        bd_user_id: application.assigned_bd_id ?? authResult.supplier.id,
      })
      .select()
      .single();

    if (supplierError || !supplier) {
      console.error("[approve-supplier]", supplierError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      // Reset application status so it can be retried
      await supabaseAdmin
        .from("applications")
        .update({ status: "PENDING" })
        .eq("id", application.id);
      return NextResponse.json(
        { error: "Failed to create supplier record" },
        { status: 500 },
      );
    }

    // 6. Create contract record — rollback supplier + Auth user on failure
    const { error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        supplier_id: supplier.id,
        status: "DRAFT",
        signature_provider: "DOCUSIGN",
        contract_fields: {},
        provider_metadata: {
          type: resolvedContractType,
          source_application: application.id,
        },
      });

    if (contractError) {
      console.error("[approve-supplier]", contractError);
      await supabaseAdmin.from("suppliers").delete().eq("id", supplier.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      // Reset application status so it can be retried
      await supabaseAdmin
        .from("applications")
        .update({ status: "PENDING" })
        .eq("id", application.id);
      return NextResponse.json(
        { error: "Failed to create contract record" },
        { status: 500 },
      );
    }

    // 7. Mark application as converted to prevent duplicate approvals
    await supabaseAdmin
      .from("applications")
      .update({ status: "CONVERTED" })
      .eq("id", application.id);

    return NextResponse.json({
      success: true,
      message: "Supplier provisioned and invitation sent",
      supplier_id: supplier.id,
    });
  } catch (error) {
    console.error("[approve-supplier]", error);
    // BUG-NEW-08 fix: reset CONVERTING → PENDING on unexpected crash
    if (claimedApplicationId) {
      try {
        const rollbackClient = createAdminClient();
        await rollbackClient
          .from("applications")
          .update({ status: "PENDING" })
          .eq("id", claimedApplicationId)
          .eq("status", "CONVERTING");
      } catch (rollbackErr) {
        console.error("[approve-supplier] rollback failed", rollbackErr);
      }
    }
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
