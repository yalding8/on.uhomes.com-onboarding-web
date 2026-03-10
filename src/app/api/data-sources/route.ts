/**
 * Data Sources API — GET + POST /api/data-sources
 *
 * P1-G4: Supplier uploads data sources (Google Sheets, Dropbox, API docs, files).
 * Auth: Supabase Session (supplier role)
 */

import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SourceType = "api_doc" | "google_sheets" | "dropbox" | "file_upload";

const VALID_SOURCE_TYPES: SourceType[] = [
  "api_doc",
  "google_sheets",
  "dropbox",
  "file_upload",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "video/mp4",
]);

async function getSupplier() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("suppliers")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "supplier")
    .single();
  return data;
}

/** GET /api/data-sources — list supplier's data sources */
export async function GET() {
  try {
    const supplier = await getSupplier();
    if (!supplier) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("supplier_data_sources")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[data-sources] list failed", error);
      return NextResponse.json(
        { error: "Failed to fetch data sources" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[data-sources]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/data-sources — submit a new data source */
export async function POST(request: Request) {
  try {
    const supplier = await getSupplier();
    if (!supplier) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    const admin = createAdminClient();

    // File upload via FormData
    if (contentType.includes("multipart/form-data")) {
      return handleFileUpload(request, supplier.id, admin);
    }

    // URL/API doc via JSON
    const body = await request.json();
    const sourceType = body.sourceType as SourceType;

    if (!VALID_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: "Invalid sourceType" },
        { status: 400 },
      );
    }

    if (sourceType === "file_upload") {
      return NextResponse.json(
        { error: "File uploads must use multipart/form-data" },
        { status: 400 },
      );
    }

    const record: Record<string, unknown> = {
      supplier_id: supplier.id,
      source_type: sourceType,
      building_id: body.buildingId ?? null,
    };

    if (sourceType === "google_sheets" || sourceType === "dropbox") {
      if (!body.url || typeof body.url !== "string") {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
      }
      try {
        new URL(body.url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 },
        );
      }
      record.url = body.url;
    }

    if (sourceType === "api_doc") {
      record.api_endpoint = body.apiEndpoint ?? null;
      record.api_notes = body.apiNotes ?? null;
      if (body.url) record.url = body.url;
    }

    const { data, error } = await admin
      .from("supplier_data_sources")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      console.error("[data-sources] insert failed", error);
      return NextResponse.json(
        { error: "Failed to create data source" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (err) {
    console.error("[data-sources]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function handleFileUpload(
  request: Request,
  supplierId: string,
  admin: ReturnType<typeof createAdminClient>,
) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const buildingId = formData.get("buildingId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 50MB limit" },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `File type ${file.type} is not allowed` },
      { status: 400 },
    );
  }

  // Store with UUID filename, keep original name in DB
  const ext = file.name.split(".").pop() ?? "bin";
  const uuid = crypto.randomUUID();
  const storagePath = `${supplierId}/${uuid}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await admin.storage
    .from("data-sources")
    .upload(storagePath, buffer, { contentType: file.type });

  if (uploadErr) {
    console.error("[data-sources] upload failed", uploadErr);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }

  const { data, error } = await admin
    .from("supplier_data_sources")
    .insert({
      supplier_id: supplierId,
      building_id: buildingId,
      source_type: "file_upload",
      file_path: storagePath,
      file_name: file.name,
      file_size_bytes: file.size,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[data-sources] insert failed", error);
    return NextResponse.json(
      { error: "Failed to create data source record" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, id: data.id }, { status: 201 });
}
