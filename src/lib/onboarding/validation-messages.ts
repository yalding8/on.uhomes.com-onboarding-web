/**
 * Validation Messages — 将技术错误翻译为用户友好的业务指引。
 */

export interface UserFriendlyError {
  field: string;
  label: string;
  message: string;
  userMessage: string;
  suggestion?: string;
}

const FIELD_HINTS: Record<
  string,
  { userMessage: string; suggestion?: string }
> = {
  "price_min:Must be a finite number": {
    userMessage: "Please enter the minimum rental price as a number",
    suggestion: "For example: 800 (without currency symbol)",
  },
  "price_max:Must be a finite number": {
    userMessage: "Please enter the maximum rental price as a number",
    suggestion: "For example: 2500 (without currency symbol)",
  },
  "price_min:Must be a non-negative number": {
    userMessage: "The minimum price cannot be negative",
  },
  "price_max:Must be a non-negative number": {
    userMessage: "The maximum price cannot be negative",
  },
  "primary_contact_email:Must be a valid email address": {
    userMessage: "Please enter a valid email address for the primary contact",
    suggestion: "For example: leasing@yourproperty.com",
  },
  "cover_image:Must be a valid URL starting with http:// or https://": {
    userMessage: "Please provide a direct link to your property's main photo",
    suggestion:
      "The URL should start with https:// — you can right-click an image on your website and copy the image address",
  },
  "application_link:Must be a valid URL starting with http:// or https://": {
    userMessage: "Please provide a valid link to your application form",
    suggestion: "The URL should start with https://",
  },
};

export function toUserFriendlyErrors(
  errors: Array<{ key: string; label: string; message: string }>,
): UserFriendlyError[] {
  return errors.map((e) => {
    const hintKey = `${e.key}:${e.message}`;
    const hint = FIELD_HINTS[hintKey];
    return {
      field: e.key,
      label: e.label,
      message: e.message,
      userMessage: hint?.userMessage ?? `Please check the "${e.label}" field`,
      suggestion: hint?.suggestion,
    };
  });
}
