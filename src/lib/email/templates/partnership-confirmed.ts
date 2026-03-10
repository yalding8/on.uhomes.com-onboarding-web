interface PartnershipConfirmedData {
  company_name: string;
}

export function buildPartnershipConfirmedEmail(
  data: PartnershipConfirmedData,
): {
  subject: string;
  html: string;
} {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://on.uhomes.com";
  const loginLink = `${appUrl}/login`;

  return {
    subject: `Your uhomes.com partnership is confirmed — Review your contract`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="border-bottom: 3px solid #FF5A5F; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-weight: 700; font-size: 18px; color: #FF5A5F;">uhomes.com</span>
          <span style="font-weight: 700; font-size: 18px; color: #222222; margin-inline-start: 8px;">Partners</span>
        </div>
        <h2 style="font-size: 20px; color: #222222; margin: 0 0 16px;">Partnership Confirmed</h2>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px;">
          Hi ${escapeHtml(data.company_name)},
        </p>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 16px;">
          Your partnership with uhomes.com has been confirmed!
          Please log in to review and confirm your contract details.
        </p>
        <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">
          You'll receive a one-time code via email to sign in — no password needed.
        </p>
        <div style="margin-bottom: 32px;">
          <a href="${loginLink}" style="display: inline-block; background: #FF5A5F; color: #fff; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
            Log in to your portal
          </a>
        </div>
        <p style="margin-top: 32px; font-size: 12px; color: #999;">
          This is an automated notification from uhomes Partners.
        </p>
      </div>
    `.trim(),
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
