/**
 * Authentication helpers for contract confirm/resend API.
 *
 * Supports supplier (ownership), admin BD (full access), and regular BD (assigned only).
 */

import { NextResponse } from "next/server";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin as checkAdmin } from "@/lib/admin/permissions";
import type { ContractFields, ContractStatus } from "@/lib/contracts/types";

export interface ContractRow {
  id: string;
  supplier_id: string;
  status: ContractStatus;
  contract_fields: ContractFields | null;
}

export interface SupplierRow {
  id: string;
  contact_email: string;
  company_name: string;
}

export interface AuthResult {
  supplier: SupplierRow;
  isBd: boolean;
  isAdmin: boolean;
}

/**
 * Authenticate current user. Returns their supplier record, BD flag, and admin flag.
 */
export async function authenticateUser(): Promise<
  { auth: AuthResult; error: null } | { auth: null; error: NextResponse }
> {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      auth: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const adminClient = createAdminClient();
  const { data: supplier, error: dbError } = await adminClient
    .from("suppliers")
    .select("id, contact_email, company_name, role")
    .eq("user_id", user.id)
    .single();

  if (dbError || !supplier) {
    return {
      auth: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const isBd = supplier.role === "bd";
  return {
    auth: {
      supplier: supplier as SupplierRow & { role: string },
      isBd,
      isAdmin: isBd && checkAdmin(supplier.contact_email),
    },
    error: null,
  };
}

/**
 * Fetch contract record.
 * - Supplier: must own the contract.
 * - Admin BD: full access to any contract.
 * - Regular BD: only contracts for suppliers assigned to them (bd_user_id).
 */
export async function fetchContract(
  contractId: string,
  auth: AuthResult,
): Promise<
  | { contract: ContractRow; contractSupplier: SupplierRow; error: null }
  | { contract: null; contractSupplier: null; error: NextResponse }
> {
  const adminClient = createAdminClient();
  const { data, error: dbError } = await adminClient
    .from("contracts")
    .select("id, supplier_id, status, contract_fields")
    .eq("id", contractId)
    .single();

  if (dbError || !data) {
    return {
      contract: null,
      contractSupplier: null,
      error: NextResponse.json(
        { error: "Contract not found" },
        { status: 404 },
      ),
    };
  }

  const contract = data as ContractRow;

  // Supplier: must own the contract
  if (!auth.isBd && contract.supplier_id !== auth.supplier.id) {
    return {
      contract: null,
      contractSupplier: null,
      error: NextResponse.json(
        { error: "Contract does not belong to current user" },
        { status: 403 },
      ),
    };
  }

  // Regular BD: check assignment via bd_user_id
  if (auth.isBd && !auth.isAdmin && contract.supplier_id !== auth.supplier.id) {
    const { data: target } = await adminClient
      .from("suppliers")
      .select("bd_user_id")
      .eq("id", contract.supplier_id)
      .single();
    if (target?.bd_user_id !== auth.supplier.id) {
      return {
        contract: null,
        contractSupplier: null,
        error: NextResponse.json(
          { error: "Contract supplier not assigned to you" },
          { status: 403 },
        ),
      };
    }
  }

  // Resolve the contract's actual supplier for DocuSign operations
  let contractSupplier: SupplierRow;
  if (auth.isBd && contract.supplier_id !== auth.supplier.id) {
    const { data: ownerSupplier } = await adminClient
      .from("suppliers")
      .select("id, contact_email, company_name")
      .eq("id", contract.supplier_id)
      .single();
    if (!ownerSupplier) {
      return {
        contract: null,
        contractSupplier: null,
        error: NextResponse.json(
          { error: "Contract supplier not found" },
          { status: 404 },
        ),
      };
    }
    contractSupplier = ownerSupplier as SupplierRow;
  } else {
    contractSupplier = auth.supplier;
  }

  return { contract, contractSupplier, error: null };
}
