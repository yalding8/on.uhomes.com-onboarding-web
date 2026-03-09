import { z } from "zod";

// Schema corresponding exactly to PRD section 3.4
export const applicantSchema = z.object({
  company_name: z.string().min(2, "Company Name is required"),
  supplier_type: z.string().min(1, "Supplier Type is required"),
  contact_email: z.string().email("Valid work email is required"),
  contact_phone: z
    .string()
    .regex(
      /^\+\d{1,4}[\s\-]?\d[\d\s\-]{3,15}$/,
      "Please select a country/region code and enter your phone number",
    ),
  country: z
    .string()
    .min(2, "Please enter the full country name (e.g. United Kingdom)"),
  website_url: z
    .string()
    .transform((val) => {
      if (!val) return val;
      if (!/^https?:\/\//i.test(val)) return `https://${val}`;
      return val;
    })
    .pipe(
      z
        .string()
        .url("Please enter a valid URL")
        .refine((val) => /^https?:\/\//i.test(val), {
          message: "Only http:// and https:// URLs are allowed",
        }),
    )
    .optional()
    .or(z.literal("")),
});

export type ApplicantFormValues = z.infer<typeof applicantSchema>;
