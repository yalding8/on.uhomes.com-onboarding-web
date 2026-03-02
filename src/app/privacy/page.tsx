import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section } from "@/components/legal/Section";

export const metadata: Metadata = {
  title: "Privacy Policy — uhomes.com Partners",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout currentPage="privacy">
      <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
        UHOMES Privacy Policy
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-10">
        Effective Date: March 1, 2026 &middot; Last Updated: March 1, 2026
      </p>

      <Section title="1. Introduction">
        <p>
          UHOMES INTERNATIONAL CO., LIMITED (&quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;), operating as uhomes.com, operates the Partner
          Onboarding Portal (the &quot;Service&quot;).
        </p>
        <p className="mt-2">
          This Privacy Policy explains how we collect, use, disclose, and
          safeguard information when you access or use the Service.
        </p>
        <p className="mt-2">
          By using the Service, you agree to the terms of this Privacy Policy.
        </p>
      </Section>

      <Section title="1.1 Data Controller">
        <p>
          For the purposes of applicable data protection laws, UHOMES
          INTERNATIONAL CO., LIMITED acts as the data controller for personal
          data collected and processed in connection with partner onboarding,
          account management, and operation of the Service.
        </p>
        <p className="mt-2">
          Where we process data on behalf of partners or users as a service
          provider, we act as a data processor in accordance with applicable
          agreements and laws.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <h4 className="font-semibold text-[var(--color-text-primary)] mt-4 mb-1">
          2.1 Information You Provide
        </h4>
        <p>We may collect information including:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>
            Company information (company name, address, city, country/region)
          </li>
          <li>
            Contact details (name, work email, phone number of authorized
            representatives)
          </li>
          <li>Property data (building details, pricing, amenities, images)</li>
          <li>
            Contract information (commission terms, contract dates, covered
            properties)
          </li>
          <li>Website URLs and related business information</li>
        </ul>

        <h4 className="font-semibold text-[var(--color-text-primary)] mt-4 mb-1">
          2.2 Information Collected Automatically
        </h4>
        <p>We may automatically collect:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>
            Log data (IP address, browser type, operating system, referring
            URLs, pages visited, timestamps)
          </li>
          <li>
            Device information (device type, screen resolution, language
            preferences)
          </li>
          <li>
            Cookies and similar technologies used for authentication, session
            management, and analytics
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use collected information to:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>
            Process and manage partner onboarding applications and contracts
          </li>
          <li>List and manage properties on the uhomes.com platform</li>
          <li>
            Communicate regarding accounts, contracts, and service updates
          </li>
          <li>Improve and optimize our Service</li>
          <li>Comply with legal obligations</li>
          <li>Detect, prevent, and address fraud or security issues</li>
        </ul>
      </Section>

      <Section title="3.1 Legal Basis for Processing (EEA and UK Users)">
        <p>
          Where applicable under the General Data Protection Regulation (GDPR)
          and UK data protection laws, we process personal data under the
          following legal bases:
        </p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>
            <strong>Performance of a contract</strong> &ndash; providing
            onboarding and platform services
          </li>
          <li>
            <strong>Legitimate interests</strong> &ndash; operating, improving,
            and securing our platform
          </li>
          <li>
            <strong>Legal obligations</strong> &ndash; compliance with
            applicable laws and regulations
          </li>
          <li>
            <strong>Consent</strong> &ndash; where required for optional
            communications or analytics
          </li>
        </ul>
      </Section>

      <Section title="4. Information Sharing and Disclosure">
        <p>We do not sell personal information.</p>
        <p className="mt-2">We may share information with:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>
            <strong>Service providers:</strong> third-party vendors assisting
            operation of the Service (hosting, analytics, e-signature services)
          </li>
          <li>
            <strong>Sub-processors:</strong> trusted infrastructure and
            operational partners engaged under contractual confidentiality and
            data protection obligations
          </li>
          <li>
            <strong>Platform users:</strong> property information submitted may
            be displayed to students and renters on uhomes.com
          </li>
          <li>
            <strong>Legal requirements:</strong> when required by law or legal
            process
          </li>
          <li>
            <strong>Business transfers:</strong> in connection with mergers,
            acquisitions, or asset sales
          </li>
        </ul>
      </Section>

      <Section title="5. Data Security">
        <p>
          We implement industry-standard technical and organizational measures
          designed to protect personal data against unauthorized access,
          alteration, disclosure, or destruction.
        </p>
        <p className="mt-2">
          These measures include access controls, encryption where appropriate,
          monitoring systems, and internal security policies aligned with
          industry best practices. However, no method of transmission over the
          Internet can be guaranteed to be completely secure.
        </p>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We retain personal data only for as long as necessary to fulfill the
          purposes described in this Privacy Policy, including providing the
          Service, complying with legal obligations, resolving disputes, and
          enforcing agreements.
        </p>
        <p className="mt-2">
          Retention periods may vary depending on contractual, regulatory, and
          operational requirements.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>Access personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Object to or restrict processing</li>
          <li>Data portability</li>
          <li>Withdraw consent where processing is based on consent</li>
        </ul>
        <p className="mt-2">
          To exercise these rights, contact us at:{" "}
          <a
            href="mailto:contact@uhomes.com"
            className="text-[var(--color-primary)] hover:underline"
          >
            contact@uhomes.com
          </a>
        </p>
        <p className="mt-2">
          If you are located in the European Economic Area (EEA) or the United
          Kingdom, you may also contact our Data Protection contact below or
          lodge a complaint with your local supervisory authority.
        </p>
      </Section>

      <Section title="8. International Data Transfers">
        <p>
          Your information may be transferred to and processed in countries
          outside your country of residence.
        </p>
        <p className="mt-2">
          Where personal data is transferred internationally, we implement
          appropriate safeguards designed to ensure an adequate level of
          protection, including Standard Contractual Clauses or other lawful
          transfer mechanisms where required.
        </p>
        <p className="mt-2">
          We take reasonable steps to ensure recipients provide protections
          consistent with applicable data protection laws.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          We use essential cookies for authentication and session management.
          Analytics cookies may also be used to understand how the Service is
          used.
        </p>
        <p className="mt-2">
          You may control cookies through your browser settings.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy periodically. Material changes will
          be notified by posting the updated policy and revising the &quot;Last
          Updated&quot; date.
        </p>
        <p className="mt-2">
          Continued use of the Service constitutes acceptance of the updated
          policy.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <p>
          If you have questions regarding this Privacy Policy, please contact:
        </p>
        <p className="mt-2">
          <strong className="text-[var(--color-text-primary)]">
            UHOMES INTERNATIONAL CO., LIMITED
          </strong>
          <br />
          ROOM 605, 6/F, FA YUEN COMMERCIAL BUILDING, 75&ndash;77 FA YUEN
          STREET, MONGKOK, KOWLOON, HONG KONG
          <br />
          Email:{" "}
          <a
            href="mailto:contact@uhomes.com"
            className="text-[var(--color-primary)] hover:underline"
          >
            contact@uhomes.com
          </a>
          <br />
          Data Protection Contact:{" "}
          <a
            href="mailto:privacy@uhomes.com"
            className="text-[var(--color-primary)] hover:underline"
          >
            privacy@uhomes.com
          </a>
        </p>
      </Section>
    </LegalLayout>
  );
}
