interface NewApplicationData {
  company_name: string;
  contact_email: string;
  city: string;
  country: string;
}

export function buildNewApplicationEmail(app: NewApplicationData): {
  subject: string;
  html: string;
} {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://on.uhomes.com";
  const adminLink = `${appUrl}/admin/applications`;

  return {
    subject: `[uhomes Partners] New Application: ${app.company_name}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
        <div style="border-bottom: 3px solid #FF5A5F; padding-bottom: 16px; margin-bottom: 24px;">
          <span style="font-weight: 700; font-size: 18px; color: #FF5A5F;">uhomes.com</span>
          <span style="font-weight: 700; font-size: 18px; color: #222222; margin-left: 8px;">Partners</span>
        </div>
        <h2 style="font-size: 20px; color: #222222; margin: 0 0 16px;">New Supplier Application</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #555;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #222;">Company</td>
            <td style="padding: 8px 0;">${escapeHtml(app.company_name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #222;">Email</td>
            <td style="padding: 8px 0;">${escapeHtml(app.contact_email)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600; color: #222;">Location</td>
            <td style="padding: 8px 0;">${escapeHtml(app.city)}, ${escapeHtml(app.country)}</td>
          </tr>
        </table>
        <div style="margin-top: 24px;">
          <a href="${adminLink}" style="display: inline-block; background: #FF5A5F; color: #fff; font-weight: 600; font-size: 14px; padding: 10px 24px; border-radius: 8px; text-decoration: none;">
            Review in Admin
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
