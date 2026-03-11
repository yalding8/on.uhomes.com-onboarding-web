import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
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
    // 1. Authorization: all BD users can approve (was admin-only, relaxed per business requirement)
    const authResult = await verifyBdRole();
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
      await supabaseAdmin
        .from("applications")
        .update({ status: "PENDING" })
        .eq("id", application.id);
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
          console.error(
            "[approve-supplier] user exists but not found in list",
            {
              email: application.contact_email,
              createError,
            },
          );
          await supabaseAdmin
            .from("applications")
            .update({ status: "PENDING" })
            .eq("id", application.id);
          return NextResponse.json(
            { error: "Failed to create auth user" },
            { status: 500 },
          );
        }
      } else {
        console.error("[approve-supplier] createUser failed", {
          email: application.contact_email,
          message: errorMsg,
          createError,
        });
        await supabaseAdmin
          .from("applications")
          .update({ status: "PENDING" })
          .eq("id", application.id);
        return NextResponse.json(
          {
            error: `Failed to create auth user: ${errorMsg || "unknown error"}`,
          },
          { status: 500 },
        );
      }
    } else {
      userId = createResult.user.id;
    }

    // 5. Atomic transaction: create supplier + contract + mark CONVERTED
    const { data: txResult, error: txError } = await supabaseAdmin.rpc(
      "approve_supplier_tx",
      {
        p_application_id: application.id,
        p_user_id: userId,
        p_company_name: application.company_name,
        p_supplier_type: application.supplier_type ?? null,
        p_contact_email: application.contact_email,
        p_bd_user_id: application.assigned_bd_id ?? authResult.supplier.id,
        p_contract_type: resolvedContractType,
      },
    );

    if (txError || !txResult) {
      console.error("[approve-supplier] transaction failed", txError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin
        .from("applications")
        .update({ status: "PENDING" })
        .eq("id", application.id);
      return NextResponse.json(
        { error: "Failed to provision supplier" },
        { status: 500 },
      );
    }

    const supplier = { id: txResult.supplier_id as string };

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
