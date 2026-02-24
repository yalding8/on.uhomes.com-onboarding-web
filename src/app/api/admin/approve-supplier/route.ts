import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyBdRole, isBdAuthError } from "@/lib/admin/auth";

export async function POST(request: Request) {
  try {
    // 1. Authorization: Verify BD role via cookie session
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

    // 2. Init Admin-level Supabase client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // 3. Fetch Application details
    const { data: application, error: fetchAppError } = await supabaseAdmin
      .from("applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (fetchAppError || !application) {
      return NextResponse.json(
        { error: "Application not found or database error" },
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

    // 4. Create proper Auth User using generateLink (Magic Link invitation)
    // We send an admin invite link, enabling the user to set up and securely login.
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        application.contact_email,
      );

    if (authError || !authUser.user) {
      return NextResponse.json(
        { error: "Failed to create auth user", details: authError?.message },
        { status: 500 },
      );
    }
    const userId = authUser.user.id;

    // 5. Port application data over to true `suppliers` identity
    const { data: supplier, error: supplierError } = await supabaseAdmin
      .from("suppliers")
      .insert({
        user_id: userId,
        company_name: application.company_name,
        contact_email: application.contact_email,
        status: "PENDING_CONTRACT",
      })
      .select()
      .single();

    if (supplierError || !supplier) {
      // Rollback strategy theoretically needed here against auth creation divergence
      return NextResponse.json(
        {
          error: "Failed to provision supplier entity",
          details: supplierError?.message,
        },
        { status: 500 },
      );
    }

    // 6. Generate an awaiting Contract record mapped to this supplier
    // Contract starts as DRAFT; BD will edit fields and push for review before DocuSign envelope creation
    const { error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        supplier_id: supplier.id,
        status: "DRAFT",
        signature_provider: "DOCUSIGN",
        provider_metadata: {
          type: contract_type || "STANDARD_PROMOTION_2026",
          source_application: application.id,
        },
      });

    if (contractError) {
      return NextResponse.json(
        {
          error: "Failed to stage contract details",
          details: contractError.message,
        },
        { status: 500 },
      );
    }

    // 7. Update original application status to block repeated conversion
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
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
