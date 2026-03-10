import { NextResponse } from "next/server";
import { verifyAdminRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildPartnershipConfirmedEmail } from "@/lib/email/templates/partnership-confirmed";

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
      console.error("[approve-supplier] claim failed", {
        application_id,
        claimError,
        claimed,
      });
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

    // 4. Create Auth user — P0-G9: use createUser with email_confirm: true
    // so user logs in via OTP (no password/invitation needed).
    // If email already exists in auth, reuse that user.
    let userId: string;
    const { data: createResult, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: application.contact_email,
        email_confirm: true,
        user_metadata: { role: "supplier" },
      });

    if (createError || !createResult.user) {
      const errorMsg = createError?.message ?? "";
      if (errorMsg.toLowerCase().includes("already")) {
        // Email already registered — find existing user
        const { data: listed } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000,
        });
        const found = listed?.users?.find(
          (u: { email?: string }) => u.email === application.contact_email,
        );
        if (found) {
          userId = found.id;
        } else {
          console.error("[approve-supplier]", createError);
          return NextResponse.json(
            { error: "Failed to create auth user" },
            { status: 500 },
          );
        }
      } else {
        console.error("[approve-supplier]", createError);
        return NextResponse.json(
          { error: "Failed to create auth user" },
          { status: 500 },
        );
      }
    } else {
      userId = createResult.user.id;
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

    // 8. P0-G9: Send partnership confirmed email (non-blocking)
    try {
      const emailData = buildPartnershipConfirmedEmail({
        company_name: application.company_name,
      });
      await sendEmail({
        to: application.contact_email,
        subject: emailData.subject,
        html: emailData.html,
      });
    } catch (emailErr) {
      console.error("[approve-supplier] notification email failed", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Supplier provisioned and notification sent",
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
