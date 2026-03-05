import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildNewApplicationEmail } from "@/lib/email/templates/new-application";
import { ADMIN_EMAILS } from "@/lib/admin/permissions";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const {
      company_name,
      supplier_type,
      contact_email,
      contact_phone,
      country,
      website_url,
      referral_code,
    } = payload;

    if (
      !company_name ||
      !supplier_type ||
      !contact_email ||
      !contact_phone ||
      !country
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: company_name, supplier_type, contact_email, contact_phone, and country are all required.",
        },
        { status: 400 },
      );
    }

    // Basic email format check
    if (!/\S+@\S+\.\S+/.test(contact_email)) {
      return NextResponse.json(
        { error: "Invalid email format." },
        { status: 400 },
      );
    }

    // Connect via service role to bypass RLS during system-level insert
    const supabase = createAdminClient();

    // Duplicate submission guard — prevent multiple PENDING applications for the same email
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id")
      .eq("contact_email", contact_email)
      .eq("status", "PENDING")
      .limit(1);

    if (existingApp && existingApp.length > 0) {
      return NextResponse.json(
        { error: "An application with this email is already under review." },
        { status: 409 },
      );
    }

    // Also check if this email is already a registered supplier
    const { data: existingSupplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("contact_email", contact_email)
      .limit(1);

    if (existingSupplier && existingSupplier.length > 0) {
      return NextResponse.json(
        { error: "This email is already registered as a supplier." },
        { status: 409 },
      );
    }

    // Resolve referral code to BD supplier id
    let assignedBdId: string | null = null;
    if (referral_code && typeof referral_code === "string") {
      const { data: referrer } = await supabase
        .from("suppliers")
        .select("id")
        .eq("referral_code", referral_code.trim())
        .eq("role", "bd")
        .single();
      if (referrer) {
        assignedBdId = referrer.id;
      }
    }

    const { error } = await supabase.from("applications").insert([
      {
        company_name,
        supplier_type,
        contact_email,
        contact_phone,
        country,
        website_url: website_url || null,
        status: "PENDING",
        assigned_bd_id: assignedBdId,
      },
    ]);

    if (error) {
      return NextResponse.json(
        { error: "Internal database error saving application." },
        { status: 500 },
      );
    }

    // Non-blocking email notification to admin group
    if (process.env.RESEND_API_KEY) {
      const emailPayload = buildNewApplicationEmail({
        company_name,
        supplier_type,
        contact_email,
        country,
      });
      sendEmail({
        to: [...ADMIN_EMAILS],
        subject: emailPayload.subject,
        html: emailPayload.html,
      }).catch((err: unknown) => {
        console.error("[apply] email notification failed", err);
      });
    }

    return NextResponse.json(
      { success: true, message: "Application submitted." },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Server error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
