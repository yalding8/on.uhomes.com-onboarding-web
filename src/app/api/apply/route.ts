import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Server-side validation (double check)
    if (!payload.contact_email || !payload.company_name) {
      return NextResponse.json(
        { error: "Missing required application fields." },
        { status: 400 },
      );
    }

    // Connect via service role to bypass RLS during system-level insert
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Ensure we don't crash from duplicate inserts before an auth user binds
    // If the same email submits twice, we can log it separately or just update
    // Assuming this flows into the BD CRM for processing:
    const { error } = await supabase.from("applications").insert([
      {
        company_name: payload.company_name,
        contact_email: payload.contact_email,
        contact_phone: payload.contact_phone,
        city: payload.city,
        country: payload.country,
        website_url: payload.website_url || null,
        status: "PENDING",
      },
    ]);

    if (error) {
      console.error("Supabase application insertion error", error);
      return NextResponse.json(
        { error: "Internal database error saving application." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Application submitted." },
      { status: 200 },
    );
  } catch (error: Error | unknown) {
    return NextResponse.json(
      { error: (error as Error).message || "Server error occurred" },
      { status: 500 },
    );
  }
}
