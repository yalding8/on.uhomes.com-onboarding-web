import { NextResponse } from "next/server";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Authorization: verify BD role via cookie session
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

    const supabaseAdmin = createAdminClient();

    // 2. Fetch and validate application
    const { data: application, error: fetchAppError } = await supabaseAdmin
      .from("applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (fetchAppError || !application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (application.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Cannot approve application with status: ${application.status}`,
        },
        { status: 400 },
      );
    }

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
          type: contract_type || "STANDARD_PROMOTION_2026",
          source_application: application.id,
        },
      });

    if (contractError) {
      console.error("[approve-supplier]", contractError);
      await supabaseAdmin.from("suppliers").delete().eq("id", supplier.id);
      await supabaseAdmin.auth.admin.deleteUser(userId);
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
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
