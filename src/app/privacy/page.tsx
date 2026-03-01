import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — uhomes.com Partners",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)]">
      <nav className="w-full border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center">
          <Link
            href="/"
            className="font-bold text-lg tracking-tight text-[var(--color-primary)]"
          >
            uhomes.com
            <span className="text-[var(--color-text-primary)] ml-2">
              Partners
            </span>
          </Link>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-16 prose-sm text-[var(--color-text-secondary)]">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-10">
          Effective Date: March 1, 2026 &middot; Last Updated: March 1, 2026
        </p>

        <Section title="1. Introduction">
          <p>
            UHOMES INTERNATIONAL CO., LIMITED (&quot;we&quot;, &quot;us&quot;,
            or &quot;our&quot;), operating as uhomes.com, operates the Partner
            Onboarding Portal at <strong>on.pylospay.com</strong> (the
            &quot;Service&quot;). This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you use our
            Service. By accessing or using the Service, you agree to the terms
            of this Privacy Policy.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <h4 className="font-semibold text-[var(--color-text-primary)] mt-4 mb-1">
            2.1 Information You Provide
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Company information: company name, address, city, country/region
            </li>
            <li>
              Contact details: name, work email, phone number of authorized
              representatives
            </li>
            <li>Property data: building details, pricing, amenities, images</li>
            <li>
              Contract information: commission terms, contract dates, covered
              properties
            </li>
            <li>Website URL and other business-related information</li>
          </ul>

          <h4 className="font-semibold text-[var(--color-text-primary)] mt-4 mb-1">
            2.2 Information Collected Automatically
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Log data: IP address, browser type, operating system, referring
              URLs, pages visited, and timestamps
            </li>
            <li>
              Device information: device type, screen resolution, and language
              preferences
            </li>
            <li>
              Cookies and similar technologies for session management and
              analytics
            </li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              To process and manage your partner onboarding application and
              contract
            </li>
            <li>To list your properties on the uhomes.com platform</li>
            <li>
              To communicate with you regarding your account, contracts, and
              service updates
            </li>
            <li>To improve and optimize our Service</li>
            <li>To comply with legal obligations and enforce our agreements</li>
            <li>To detect, prevent, and address fraud or security issues</li>
          </ul>
        </Section>

        <Section title="4. Information Sharing and Disclosure">
          <p>
            We do not sell your personal information. We may share your
            information with:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Service providers:</strong> third-party vendors who assist
              in operating our Service (e.g., hosting, analytics, e-signature
              services)
            </li>
            <li>
              <strong>Platform users:</strong> property information you submit
              may be displayed to students and renters on uhomes.com
            </li>
            <li>
              <strong>Legal requirements:</strong> when required by law,
              regulation, or legal process
            </li>
            <li>
              <strong>Business transfers:</strong> in connection with a merger,
              acquisition, or sale of assets
            </li>
          </ul>
        </Section>

        <Section title="5. Data Security">
          <p>
            We implement industry-standard security measures including
            encryption in transit (TLS), secure authentication (OTP-based), and
            row-level security policies to protect your data. However, no method
            of transmission over the Internet is 100% secure, and we cannot
            guarantee absolute security.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your information for as long as your account is active or
            as needed to provide the Service, comply with legal obligations,
            resolve disputes, and enforce our agreements. You may request
            deletion of your data by contacting us.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
            <li>Withdraw consent where processing is based on consent</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, please contact us at{" "}
            <a
              href="mailto:contact@uhomes.com"
              className="text-[var(--color-primary)] hover:underline"
            >
              contact@uhomes.com
            </a>
            .
          </p>
          <p className="mt-2">
            If you are located in the European Economic Area (EEA) or the United
            Kingdom, you may also contact our Data Protection Officer (DPO) at{" "}
            <a
              href="mailto:Privacy@uhomes.com"
              className="text-[var(--color-primary)] hover:underline"
            >
              Privacy@uhomes.com
            </a>{" "}
            for any GDPR-related inquiries. You also have the right to lodge a
            complaint with your local data protection supervisory authority.
          </p>
        </Section>

        <Section title="8. International Data Transfers">
          <p>
            Your information may be transferred to and processed in countries
            other than your country of residence. We take appropriate safeguards
            to ensure your data is protected in accordance with this Privacy
            Policy and applicable laws.
          </p>
          <p className="mt-2">
            Our primary data processing is governed by the laws of the Hong Kong
            Special Administrative Region. Where we transfer data outside of
            Hong Kong, we ensure that adequate protections are in place as
            required by applicable data protection legislation.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            We use essential cookies for authentication and session management.
            We may also use analytics cookies to understand how the Service is
            used. You can control cookies through your browser settings.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by posting the updated policy on this page
            and updating the &quot;Last Updated&quot; date. Your continued use
            of the Service after changes constitutes acceptance of the updated
            policy.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p>
            If you have questions or concerns about this Privacy Policy, please
            contact us at:
          </p>
          <p className="mt-2">
            <strong className="text-[var(--color-text-primary)]">
              UHOMES INTERNATIONAL CO., LIMITED
            </strong>
            <br />
            ROOM 605, 6/F, FA YUEN COMMERCIAL BUILDING, 75-77 FA YUEN STREET,
            MONGKOK, KOWLOON, HONG KONG
            <br />
            Email:{" "}
            <a
              href="mailto:contact@uhomes.com"
              className="text-[var(--color-primary)] hover:underline"
            >
              contact@uhomes.com
            </a>
            <br />
            Data Protection Officer:{" "}
            <a
              href="mailto:Privacy@uhomes.com"
              className="text-[var(--color-primary)] hover:underline"
            >
              Privacy@uhomes.com
            </a>
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
        {title}
      </h2>
      <div className="space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}
