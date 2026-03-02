/**
 * Manually invite a supplier — BD direct invite (bypasses applications table)
 *
 * POST /api/admin/invite-supplier
 * Auth: Session-based, requires role='bd'
 */

import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface InvitePayload {
  email: string;
  company_name: string;
  phone?: string;
  city?: string;
  website?: string;
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
      phone:
        typeof payload.phone === "string"
          ? payload.phone.trim() || undefined
          : undefined,
      city:
        typeof payload.city === "string"
          ? payload.city.trim() || undefined
          : undefined,
      website:
        typeof payload.website === "string"
          ? payload.website.trim() || undefined
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
    const { email, company_name, phone, city, website } = validation.data;

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

    // 3. Create Auth user — must happen first as supplier requires user_id
    // Try invite; reuse existing auth user if the email is already registered
    let userId: string;
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (authError || !authUser.user) {
      const { data: createResult, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
        });
      if (createError || !createResult.user) {
        const errMsg =
          (authError?.message ?? "") + (createError?.message ?? "");
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
            console.error("[invite-supplier]", authError, createError);
            return NextResponse.json(
              { error: "Failed to create auth user" },
              { status: 500 },
            );
          }
        } else {
          console.error("[invite-supplier]", authError, createError);
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

    // 4. Create supplier record — rollback Auth user on failure
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .insert({
        user_id: userId,
        company_name,
        contact_email: email,
        contact_phone: phone ?? null,
        city: city ?? null,
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

    // 5. Create contract record — rollback supplier + Auth user on failure
    const { error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        supplier_id: supplier.id,
        status: "DRAFT",
        signature_provider: "DOCUSIGN",
        contract_fields: {},
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

    return NextResponse.json({
      success: true,
      message: "Supplier invitation sent",
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
