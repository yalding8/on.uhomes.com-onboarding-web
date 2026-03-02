import { Resend } from "resend";

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const resend = getClient();
  const { error } = await resend.emails.send({
    from: "uhomes Partners <noreply@uhomes.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });
  if (error) {
    console.error("[resend]", error);
    throw error;
  }
}
