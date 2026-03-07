import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { buildNewApplicationEmail } from "@/lib/email/templates/new-application";
import { ADMIN_EMAILS } from "@/lib/admin/permissions";
import { SUPPLIER_TYPES } from "@/lib/constants/supplier-types";

/** Server-side validation schema — mirrors client schema with added sanitization */
const serverApplicantSchema = z
  .object({
    company_name: z.string().trim().min(2).max(200),
    supplier_type: z.enum(SUPPLIER_TYPES),
    contact_email: z.string().trim().toLowerCase().email(),
    contact_phone: z
      .string()
      .trim()
      .regex(/^\+\d{1,4}[\s\-]?\d[\d\s\-]{3,15}$/),
    country: z.string().trim().min(2).max(100),
    website_url: z
      .string()
      .trim()
      .transform((val) => {
        if (!val) return val;
        if (!/^https?:\/\//i.test(val)) return `https://${val}`;
        return val;
      })
      .pipe(z.string().url())
      .optional()
      .or(z.literal("")),
    referral_code: z.string().trim().max(50).optional().or(z.literal("")),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Validate and sanitize input using Zod
    const parsed = serverApplicantSchema.safeParse(payload);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const {
      company_name,
      supplier_type,
      contact_email,
      contact_phone,
      country,
      website_url,
      referral_code,
    } = parsed.data;

    // Connect via service role to bypass RLS during system-level insert
    const supabase = createAdminClient();

    // Duplicate submission guard — case-insensitive (email already lowercased by Zod)
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id")
      .ilike("contact_email", contact_email)
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
      .ilike("contact_email", contact_email)
      .limit(1);

    if (existingSupplier && existingSupplier.length > 0) {
      return NextResponse.json(
        { error: "This email is already registered as a supplier." },
        { status: 409 },
      );
    }

    // Resolve referral code to BD supplier id
    let assignedBdId: string | null = null;
    if (referral_code) {
      const { data: referrer } = await supabase
        .from("suppliers")
        .select("id")
        .eq("referral_code", referral_code)
        .eq("role", "bd")
        .single();
      if (referrer) {
        assignedBdId = referrer.id;
      }
    }

    // Use validated/sanitized data for insert
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
