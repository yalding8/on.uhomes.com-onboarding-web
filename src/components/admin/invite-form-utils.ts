export interface InviteFormData {
  email: string;
  company_name: string;
  supplier_type: string;
  phone: string;
  website: string;
}

export interface InviteFormErrors {
  email?: string;
  company_name?: string;
  supplier_type?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const INITIAL_FORM: InviteFormData = {
  email: "",
  company_name: "",
  supplier_type: "",
  phone: "",
  website: "",
};

/** Front-end form validation */
export function validateInviteForm(data: InviteFormData): InviteFormErrors {
  const errors: InviteFormErrors = {};
  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(data.email.trim())) {
    errors.email = "Invalid email format";
  }
  if (!data.company_name.trim()) {
    errors.company_name = "Company name is required";
  }
  if (!data.supplier_type) {
    errors.supplier_type = "Supplier type is required";
  }
  return errors;
}
