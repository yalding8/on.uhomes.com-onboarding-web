import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    const {
      company_name,
      contact_email,
      contact_phone,
      city,
      country,
      website_url,
    } = payload;

    if (
      !company_name ||
      !contact_email ||
      !contact_phone ||
      !city ||
      !country
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: company_name, contact_email, contact_phone, city, and country are all required.",
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
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("contact_email", contact_email)
      .eq("status", "PENDING")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "An application with this email is already under review." },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("applications").insert([
      {
        company_name,
        contact_email,
        contact_phone,
        city,
        country,
        website_url: website_url || null,
        status: "PENDING",
      },
    ]);

    if (error) {
      return NextResponse.json(
        { error: "Internal database error saving application." },
        { status: 500 },
      );
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
