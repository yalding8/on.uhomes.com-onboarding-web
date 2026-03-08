/**
 * Supplier confirm/request changes API — POST /api/contracts/[contractId]/confirm
 *
 * action=confirm:  PENDING_REVIEW → CONFIRMED → DocuSign create envelope → SENT
 * action=request_changes: PENDING_REVIEW → DRAFT
 * action=resend: SENT → create new DocuSign envelope → SENT
 *
 * Auth: Supabase Session + contract ownership verification
 */

import { NextResponse } from "next/server";
import { authenticateUser, fetchContract } from "./auth";
import {
  handleConfirm,
  handleResend,
  handleRequestChanges,
  type HandlerResult,
} from "@/lib/contracts/confirm-handlers";

type Action = "confirm" | "request_changes" | "resend";

interface RouteContext {
  params: Promise<{ contractId: string }>;
}

function toResponse(result: HandlerResult): NextResponse {
  if (result.success) {
    return NextResponse.json(result);
  }
  return NextResponse.json(
    { error: result.error },
    { status: result.httpStatus },
  );
}

/**
 * POST /api/contracts/[contractId]/confirm
 *
 * Body: { action: "confirm" | "request_changes" | "resend" }
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await authenticateUser();
    if (authResult.error) return authResult.error;
    const { auth } = authResult;

    const body = (await request.json()) as { action?: string };
    const action = body.action as Action | undefined;

    if (!action || !["confirm", "request_changes", "resend"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // BD can only resend, not confirm or request_changes on behalf
    if (auth.isBd && action !== "resend") {
      return NextResponse.json(
        { error: "BD can only resend signing emails" },
        { status: 403 },
      );
    }

    const { contractId } = await context.params;
    const contractResult = await fetchContract(contractId, auth);
    if (contractResult.error) return contractResult.error;
    const { contract, contractSupplier } = contractResult;

    if (action === "confirm") {
      return toResponse(await handleConfirm(contract, contractSupplier));
    }
    if (action === "resend") {
      return toResponse(await handleResend(contract, contractSupplier));
    }

    return toResponse(await handleRequestChanges(contract));
  } catch (err: unknown) {
    console.error("[contracts/confirm]", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
