/**
 * Field Definitions — 60+ 字段的纯数据定义。
 * 从 field-schema.ts 拆分出来以遵守 300 行限制。
 *
 * 字段来源参考：Onboarding Details for property-student housing.csv
 * extractTier: A = 可从合同/网站自动提取, B = 部分提取需确认, C = 必须手动填写
 * phase: 1 = Core Info, 2 = Enhanced, 3 = Optimized
 *
 * prettier-ignore — 保持紧凑格式避免行数膨胀
 */

import type { FieldDefinition } from "./field-schema";

// prettier-ignore
export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // ── Basic Information ──
  { key: "building_name", label: "Property Name", category: "basic_info", type: "text", weight: 10, extractTier: "A", required: true, phase: 1 },
  { key: "building_address", label: "Address", category: "basic_info", type: "text", weight: 10, extractTier: "A", required: true, phase: 1 },
  { key: "city", label: "City", category: "basic_info", type: "text", weight: 8, extractTier: "A", required: true, phase: 1 },
  { key: "country", label: "Country / Region", category: "basic_info", type: "text", weight: 8, extractTier: "A", required: true, phase: 1 },
  { key: "postal_code", label: "Postal Code", category: "basic_info", type: "text", weight: 5, extractTier: "A", required: true, phase: 1 },
  { key: "description", label: "Property Description", category: "basic_info", type: "text", weight: 4, extractTier: "B", required: false, phase: 2 },

  // ── Commission ──
  { key: "commission_structure", label: "Commission Structure", category: "commission", type: "text", weight: 6, extractTier: "A", required: true, phase: 1, description: "Commission rate and terms from contract" },
  { key: "commission_short_term", label: "Commission for Short-term Leases", category: "commission", type: "select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Yes", "No", "N/A"] },
  { key: "commission_renewals", label: "Commission for Renewals", category: "commission", type: "select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Yes", "No", "N/A"] },

  // ── Contacts ──
  { key: "primary_contact_name", label: "Primary Contact Name", category: "contacts", type: "text", weight: 7, extractTier: "A", required: true, phase: 1 },
  { key: "primary_contact_email", label: "Primary Contact Email", category: "contacts", type: "email", weight: 7, extractTier: "A", required: true, phase: 1 },
  { key: "primary_contact_phone", label: "Primary Contact Phone", category: "contacts", type: "phone", weight: 5, extractTier: "A", required: false, phase: 2 },
  { key: "leasing_manager_name", label: "Leasing / Property Manager", category: "contacts", type: "text", weight: 4, extractTier: "B", required: false, phase: 2 },
  { key: "accounting_contact", label: "Accounting / Billing Contact", category: "contacts", type: "text", weight: 4, extractTier: "C", required: false, phase: 3 },
  { key: "emergency_contact", label: "Emergency Maintenance Contact", category: "contacts", type: "phone", weight: 3, extractTier: "C", required: false, phase: 3 },

  // ── Availability ──
  { key: "availability_method", label: "Availability Checking Method", category: "availability", type: "multi_select", weight: 5, extractTier: "B", required: true, phase: 2, options: ["Google Sheet", "API Integration", "Official Website", "Other"] },
  { key: "instant_booking", label: "Instant Booking Available", category: "availability", type: "select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Yes", "No", "Open to discussion"] },
  { key: "move_in_dates", label: "Available Move-in Dates", category: "availability", type: "text", weight: 5, extractTier: "B", required: false, phase: 2 },
  { key: "academic_year_aligned", label: "Academic Year Aligned", category: "availability", type: "boolean", weight: 3, extractTier: "B", required: false, phase: 2 },

  // ── Booking Process ──
  { key: "application_method", label: "Application Method", category: "booking_process", type: "multi_select", weight: 5, extractTier: "B", required: true, phase: 2, options: ["Online", "Offline", "Both"] },
  { key: "application_link", label: "Application Link / Form", category: "booking_process", type: "url", weight: 4, extractTier: "B", required: false, phase: 2 },
  { key: "referral_tracking_method", label: "Referral Tracking Method", category: "booking_process", type: "multi_select", weight: 4, extractTier: "C", required: false, phase: 3, options: ["Referral email from uhomes", "Applicant selects uhomes.com", "Other"] },
  { key: "uhomes_hear_about_us", label: "Can uhomes be added to \"How did you hear about us?\"", category: "booking_process", type: "select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Yes", "No"] },
  { key: "lease_type", label: "Lease Type (Individual / Joint)", category: "booking_process", type: "select", weight: 4, extractTier: "B", required: false, phase: 2, options: ["Individual", "Joint", "Both"] },
  { key: "rental_method", label: "Rental Method (Per Unit / Per Bedroom)", category: "booking_process", type: "select", weight: 4, extractTier: "B", required: false, phase: 2, options: ["Per Unit", "Per Bedroom", "Both"] },

  // ── Lease Policy ──
  { key: "lease_duration", label: "Lease Duration", category: "lease_policy", type: "multi_select", weight: 6, extractTier: "B", required: true, phase: 2, options: ["3 months", "6 months", "9 months", "12 months", "24 months", "Flexible"] },
  { key: "cancellation_policy", label: "Lease Cancellation Policy", category: "lease_policy", type: "text", weight: 5, extractTier: "C", required: false, phase: 3 },
  { key: "early_termination_policy", label: "Early Termination / Lease Break Policy", category: "lease_policy", type: "text", weight: 5, extractTier: "C", required: false, phase: 3 },
  { key: "cancel_before_movein", label: "Can Cancel After Application Before Move-in", category: "lease_policy", type: "select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Yes", "No", "Case by case"] },
  { key: "sublease_policy", label: "Sublease Policy", category: "lease_policy", type: "select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Allowed", "Not allowed", "Case by case"] },
  { key: "relet_policy", label: "Re-let / Reassignment Policy", category: "lease_policy", type: "text", weight: 3, extractTier: "C", required: false, phase: 3 },
  { key: "lease_transfer_options", label: "Lease Transfer Options", category: "lease_policy", type: "multi_select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Lease takeover", "Sublease", "Lease transfer"] },

  // ── Tenant Qualification ──
  { key: "intl_required_docs", label: "International Applicant Required Documents", category: "tenant_qualification", type: "text", weight: 5, extractTier: "C", required: false, phase: 3 },
  { key: "i20_accepted", label: "Accept I-20 as Income Proof", category: "tenant_qualification", type: "select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Yes", "No", "N/A"], description: "US only: Does the property accept I-20 student visa documents? Select N/A if not in the US." },
  { key: "alternative_income_docs", label: "Alternative Income Documents", category: "tenant_qualification", type: "multi_select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["International proof of funds", "Sponsor letter", "Other"] },
  { key: "guarantor_options", label: "Guarantor Options", category: "tenant_qualification", type: "multi_select", weight: 3, extractTier: "C", required: false, phase: 3, options: ["Personal guarantor", "Third-party guarantor", "No guarantor required"] },
  { key: "local_required_docs", label: "Local Applicant Required Documents", category: "tenant_qualification", type: "text", weight: 3, extractTier: "C", required: false, phase: 3 },
  { key: "income_verification", label: "Income Verification Requirement", category: "tenant_qualification", type: "text", weight: 3, extractTier: "C", required: false, phase: 3 },

  // ── Building Details ──
  { key: "total_units", label: "Total Units / Bedspaces", category: "building_details", type: "number", weight: 5, extractTier: "B", required: false, phase: 2 },
  { key: "floor_plans", label: "Floor Plans / Building Layout", category: "building_details", type: "text", weight: 3, extractTier: "B", required: false, phase: 2 },
  { key: "number_of_floors", label: "Number of Floors", category: "building_details", type: "number", weight: 2, extractTier: "B", required: false, phase: 2 },
  { key: "elevator_available", label: "Elevator Available", category: "building_details", type: "boolean", weight: 2, extractTier: "B", required: false, phase: 2 },
  { key: "year_built", label: "Year Built", category: "building_details", type: "number", weight: 2, extractTier: "B", required: false, phase: 2 },
  { key: "shuttle_service", label: "Shuttle Service Available", category: "building_details", type: "boolean", weight: 2, extractTier: "B", required: false, phase: 2 },
  { key: "cover_image", label: "Cover Image URL", category: "building_details", type: "url", weight: 8, extractTier: "B", required: true, phase: 1, description: "At least 1 main image" },
  { key: "images", label: "Image Gallery", category: "building_details", type: "image_urls", weight: 5, extractTier: "B", required: false, phase: 2, description: "3+ images recommended" },
  { key: "key_amenities", label: "Key Amenities (up to 6 tags)", category: "building_details", type: "multi_select", weight: 6, extractTier: "B", required: true, phase: 1, options: ["Gym", "Pool", "Laundry", "Parking", "Study Room", "Rooftop", "Pet Friendly", "Furnished", "WiFi", "Security", "Bike Storage", "Game Room"], maxItems: 6 },
  { key: "unit_types_summary", label: "Unit Types Summary", category: "building_details", type: "text", weight: 6, extractTier: "B", required: true, phase: 1 },

  // ── Fees ──
  { key: "price_min", label: "Minimum Price", category: "fees", type: "number", weight: 8, extractTier: "C", required: true, phase: 1 },
  { key: "price_max", label: "Maximum Price", category: "fees", type: "number", weight: 8, extractTier: "C", required: true, phase: 1 },
  { key: "currency", label: "Currency", category: "fees", type: "select", weight: 6, extractTier: "A", required: true, phase: 1, options: ["USD", "CAD", "GBP", "EUR", "AUD", "JPY", "CNY", "NZD", "SGD", "HKD", "KRW", "TWD", "MYR", "THB", "INR", "AED", "SAR", "TRY", "PLN", "BRL", "MXN", "ZAR"] },
  { key: "rent_period", label: "Rent Period", category: "fees", type: "select", weight: 7, extractTier: "A", required: true, phase: 1, options: ["Weekly", "Monthly", "Per Semester", "Yearly"], description: "The billing period for the listed price range (e.g. UK properties often use weekly pricing)" },
  { key: "application_fee", label: "Application Fee", category: "fees", type: "number", weight: 3, extractTier: "C", required: false, phase: 2 },
  { key: "admin_fee", label: "Administrative Fee", category: "fees", type: "number", weight: 3, extractTier: "C", required: false, phase: 3 },
  { key: "deposit_intl", label: "Deposit for International Applicant", category: "fees", type: "text", weight: 4, extractTier: "C", required: false, phase: 2 },
  { key: "deposit_refund_process", label: "Deposit Refund Process", category: "fees", type: "text", weight: 3, extractTier: "C", required: false, phase: 3 },
  { key: "parking_fee", label: "Parking Fee", category: "fees", type: "text", weight: 2, extractTier: "C", required: false, phase: 3 },
  { key: "pet_fee", label: "Pet Fee (One-time)", category: "fees", type: "text", weight: 2, extractTier: "C", required: false, phase: 3 },
  { key: "pet_rent", label: "Pet Rent (Monthly)", category: "fees", type: "number", weight: 2, extractTier: "C", required: false, phase: 3 },
  { key: "other_premiums", label: "Other Premiums", category: "fees", type: "text", weight: 2, extractTier: "C", required: false, phase: 3 },
  { key: "room_transfer_policy", label: "Room Transfer Policy & Fees", category: "fees", type: "text", weight: 2, extractTier: "C", required: false, phase: 3 },
  { key: "renters_insurance", label: "Renter's Insurance Required", category: "fees", type: "text", weight: 2, extractTier: "C", required: false, phase: 3 },
  { key: "utilities_included", label: "Utilities Included in Rent", category: "fees", type: "text", weight: 3, extractTier: "B", required: false, phase: 2 },
  { key: "utilities_not_included", label: "Utilities Not Included & Pricing", category: "fees", type: "text", weight: 3, extractTier: "C", required: false, phase: 3 },

  // ── Furnishing & Room Details ──
  { key: "in_unit_washer_dryer", label: "In-unit Washer & Dryer", category: "furnishing_room", type: "boolean", weight: 2, extractTier: "B", required: false, phase: 3 },
  { key: "ac_heating_type", label: "AC / Heating Type", category: "furnishing_room", type: "select", weight: 2, extractTier: "B", required: false, phase: 3, options: ["Central thermostat", "Individual bedroom control", "Other"] },
  { key: "access_method", label: "Access Method", category: "furnishing_room", type: "select", weight: 1, extractTier: "C", required: false, phase: 3, options: ["Regular key", "Key fob", "Smart lock", "Other"] },
  { key: "furnished_options", label: "Furnished Options Available", category: "furnishing_room", type: "text", weight: 3, extractTier: "B", required: false, phase: 2 },
  { key: "bed_included", label: "Bed Included", category: "furnishing_room", type: "select", weight: 2, extractTier: "B", required: false, phase: 3, options: ["Yes - Twin", "Yes - Full", "Yes - Queen", "Yes - Other", "No"] },
];
