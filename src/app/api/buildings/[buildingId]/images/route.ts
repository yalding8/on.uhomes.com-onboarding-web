/**
 * POST /api/buildings/[buildingId]/images
 *
 * Upload building onboarding images to Supabase Storage.
 * Returns the public URL of the uploaded image.
 *
 * Auth: Session-based (Supabase Auth + RLS ownership check)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "building-images";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface RouteParams {
  params: Promise<{ buildingId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { buildingId } = await params;

    // 1. Auth check via Supabase session
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify building ownership via RLS
    const { data: building, error: buildingErr } = await supabase
      .from("buildings")
      .select("id")
      .eq("id", buildingId)
      .single();

    if (buildingErr || !building) {
      return NextResponse.json(
        { error: "Building not found or access denied" },
        { status: 404 },
      );
    }

    // 3. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 4. Validate file type and size
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5 MB" },
        { status: 400 },
      );
    }

    // 5. Upload to Supabase Storage using admin client
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${buildingId}/${crypto.randomUUID()}.${ext}`;
    const supabaseAdmin = createAdminClient();

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[building-images]", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }

    // 6. Get public URL
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl, fileName });
  } catch (error) {
    console.error("[building-images]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
