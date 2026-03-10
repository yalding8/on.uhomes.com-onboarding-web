/**
 * Manually invite a supplier — BD direct invite (bypasses applications table)
 *
 * POST /api/admin/invite-supplier
 * Auth: Session-based, requires role='bd'
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildPartnershipConfirmedEmail } from "@/lib/email/templates/partnership-confirmed";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface InvitePayload {
  email: string;
  company_name: string;
  supplier_type?: string;
  phone?: string;
  website?: string;
  /** P1-G8: BD can pre-fill contract fields */
  contractFields?: Record<string, unknown>;
}

function validatePayload(
  payload: Record<string, unknown>,
): { valid: true; data: InvitePayload } | { valid: false; error: string } {
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const companyName =
    typeof payload.company_name === "string" ? payload.company_name.trim() : "";

  if (!email) {
    return { valid: false, error: "Email is required" };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }
  if (!companyName) {
    return { valid: false, error: "Company name is required" };
  }

  return {
    valid: true,
    data: {
      email,
      company_name: companyName,
      supplier_type:
        typeof payload.supplier_type === "string"
          ? payload.supplier_type.trim() || undefined
          : undefined,
      phone:
        typeof payload.phone === "string"
          ? payload.phone.trim() || undefined
          : undefined,
      website:
        typeof payload.website === "string"
          ? payload.website.trim() || undefined
          : undefined,
      contractFields:
        payload.contractFields &&
        typeof payload.contractFields === "object" &&
        !Array.isArray(payload.contractFields)
          ? (payload.contractFields as Record<string, unknown>)
          : undefined,
    },
  };
}

export async function POST(request: Request) {
  try {
    // 1. Verify BD role
    const authResult = await verifyBdRole();
    if (isBdAuthError(authResult)) {
      return authResult;
    }

    const payload = await request.json();
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const {
      email,
      company_name,
      supplier_type,
      phone,
      website,
      contractFields,
    } = validation.data;

    const supabaseAdmin = createAdminClient();

    // 2. Check for duplicate email in suppliers table
    const { data: existing } = await supabaseAdmin
      .from("suppliers")
      .select("id")
      .eq("contact_email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "This email is already registered as a supplier" },
        { status: 409 },
      );
    }

    // 3. P0-G9: Create Auth user with email_confirm (OTP login, no invite)
    let userId: string;
    const { data: createResult, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { role: "supplier" },
      });

    if (createError || !createResult.user) {
      const errMsg = createError?.message ?? "";
      if (errMsg.toLowerCase().includes("already")) {
        const { data: listed } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000,
        });
        const found = listed?.users?.find(
          (u: { email?: string }) => u.email === email,
        );
        if (found) {
          userId = found.id;
        } else {
          console.error("[invite-supplier]", createError);
          return NextResponse.json(
            { error: "Failed to create auth user" },
            { status: 500 },
          );
        }
      } else {
        console.error("[invite-supplier]", createError);
        return NextResponse.json(
          { error: "Failed to create auth user" },
          { status: 500 },
        );
      }
    } else {
      userId = createResult.user.id;
    }

    // 4. Guard: user_id may already exist in suppliers (e.g. BD/Admin account)
    const { data: existingByUserId } = await supabaseAdmin
      .from("suppliers")
      .select("id, role, contact_email")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingByUserId) {
      return NextResponse.json(
        {
          error: `This email is already associated with a ${existingByUserId.role} account (${existingByUserId.contact_email})`,
        },
        { status: 409 },
      );
    }

    // 5. Create supplier record — rollback Auth user on failure
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .insert({
        user_id: userId,
        company_name,
        supplier_type: supplier_type ?? null,
        contact_email: email,
        contact_phone: phone ?? null,
        website: website ?? null,
        status: "PENDING_CONTRACT",
        role: "supplier",
        bd_user_id: authResult.supplier.id,
      })
      .select()
      .single();

    if (supplierError || !supplier) {
      console.error("[invite-supplier]", supplierError);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Failed to create supplier record" },
        { status: 500 },
      );
    }

    // 6. Create contract — P1-G8: use pre-filled fields if provided
    const hasPreFill = contractFields && Object.keys(contractFields).length > 0;
    const { error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        supplier_id: supplier.id,
        status: hasPreFill ? "PENDING_REVIEW" : "DRAFT",
        signature_provider: "DOCUSIGN",
        contract_fields: contractFields ?? {},
        provider_metadata: {
          type: "STANDARD_PROMOTION_2026",
          source: "manual_invite",
        },
      });

    if (contractError) {
      console.error("[invite-supplier]", contractError);
      await supabaseAdmin.from("suppliers").delete().eq("id", supplier.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Failed to create contract record" },
        { status: 500 },
      );
    }

    // 7. Send partnership notification email (non-blocking)
    try {
      const emailData = buildPartnershipConfirmedEmail({ company_name });
      await sendEmail({
        to: email,
        subject: emailData.subject,
        html: emailData.html,
      });
    } catch (emailErr) {
      console.error("[invite-supplier] notification email failed", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Supplier invited and notification sent",
      supplier_id: supplier.id,
    });
  } catch (error) {
    console.error("[invite-supplier]", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
