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

    // 3. Create Auth user — must happen first as supplier requires user_id
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        application.contact_email,
      );

    if (authError || !authUser.user) {
      console.error("[approve-supplier]", authError);
      return NextResponse.json(
        { error: "Failed to create auth user" },
        { status: 500 },
      );
    }
    const userId = authUser.user.id;

    // 4. Create supplier record — rollback Auth user on failure
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .insert({
        user_id: userId,
        company_name: application.company_name,
        contact_email: application.contact_email,
        status: "PENDING_CONTRACT",
        role: "supplier",
        bd_user_id: authResult.supplier.id,
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

    // 5. Create contract record — rollback supplier + Auth user on failure
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

    // 6. Mark application as converted to prevent duplicate approvals
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
