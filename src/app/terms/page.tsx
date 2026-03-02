import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Section } from "@/components/legal/Section";

export const metadata: Metadata = {
  title: "Terms of Service — uhomes.com Partners",
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout currentPage="terms">
      <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
        UHOMES Partner Onboarding Portal &mdash; Terms of Service
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-10">
        Effective Date: March 1, 2026 &middot; Last Updated: March 1, 2026
      </p>

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using the Partner Onboarding Portal operated by UHOMES
          INTERNATIONAL CO., LIMITED (&quot;uhomes.com&quot;, &quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;) at{" "}
          <strong>on.pylospay.com</strong> (the &quot;Service&quot;), you agree
          to be bound by these Terms of Service (&quot;Terms&quot;).
        </p>
        <p className="mt-2">
          If you do not agree, you may not use the Service.
        </p>
        <p className="mt-2">
          &quot;You&quot; refers to the entity or individual registering as a
          partner supplier.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          The Service provides accommodation suppliers with tools to onboard
          properties onto the uhomes.com platform, including:
        </p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>Partner application and registration</li>
          <li>Contract review and electronic signature</li>
          <li>Property data submission and management</li>
          <li>Automated data extraction and quality scoring</li>
        </ul>
      </Section>

      <Section title="2.1 Platform Role">
        <p>
          uhomes.com operates solely as a technology platform connecting
          accommodation suppliers with prospective tenants.
        </p>
        <p className="mt-2">
          UHOMES INTERNATIONAL CO., LIMITED is not a party to any rental
          agreement, lease, or housing contract entered into between suppliers
          and students or renters.
        </p>
        <p className="mt-2">Suppliers are solely responsible for:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>property accuracy,</li>
          <li>pricing,</li>
          <li>availability,</li>
          <li>contractual terms,</li>
          <li>and fulfillment of accommodation services.</li>
        </ul>
      </Section>

      <Section title="3. Account Registration">
        <p>
          You must provide accurate and complete information during
          registration.
        </p>
        <p className="mt-2">
          You are responsible for maintaining confidentiality of account
          credentials and for all activities under your account. You agree to
          notify us immediately of unauthorized use.
        </p>
      </Section>

      <Section title="4. Partner Obligations">
        <p>As a partner supplier, you agree to:</p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>Provide accurate, current, and complete property information</li>
          <li>
            Maintain and promptly update availability, pricing, and conditions
          </li>
          <li>Comply with all applicable laws and regulations</li>
          <li>Not submit fraudulent, misleading, or unlawful content</li>
          <li>
            Respond to booking inquiries and communications in a timely manner
          </li>
        </ul>
      </Section>

      <Section title="5. Intellectual Property">
        <p>
          All content, trademarks, and technology associated with the Service
          are owned by UHOMES INTERNATIONAL CO., LIMITED or its licensors.
        </p>
        <p className="mt-2">
          You retain ownership of property data and images submitted but grant
          UHOMES INTERNATIONAL CO., LIMITED a worldwide, non-exclusive,
          royalty-free license to use, display, reproduce, and distribute such
          content for listing and promoting your properties across the
          uhomes.com platform and partner networks.
        </p>
        <p className="mt-2">
          We may use aggregated and anonymized data derived from platform usage
          for analytics, service improvement, and product development purposes.
        </p>
      </Section>

      <Section title="6. Content and Data">
        <p>
          You represent and warrant that you have the legal right to submit all
          content provided through the Service.
        </p>
        <p className="mt-2">
          You are solely responsible for the accuracy and legality of submitted
          content.
        </p>
        <p className="mt-2">
          We reserve the right to remove or restrict content that violates these
          Terms or applicable law.
        </p>
      </Section>

      <Section title="7. Commission and Payment">
        <p>
          Commission rates and payment terms are governed by the individual
          partnership agreement executed between you and uhomes.com.
        </p>
        <p className="mt-2">
          These Terms do not supersede executed contractual agreements.
        </p>
      </Section>

      <Section title="8. Limitation of Liability">
        <p>
          To the maximum extent permitted by applicable law, UHOMES
          INTERNATIONAL CO., LIMITED shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, including
          loss of profits, data, or business opportunities arising from use of
          the Service.
        </p>
        <p className="mt-2">
          Our total aggregate liability shall not exceed the total commissions
          paid to UHOMES INTERNATIONAL CO., LIMITED by you during the twelve
          (12) months preceding the claim.
        </p>
        <p className="mt-2">
          Nothing in these Terms excludes liability for fraud, willful
          misconduct, or liabilities that cannot be limited under applicable
          law.
        </p>
      </Section>

      <Section title="9. Disclaimer of Warranties">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;
          without warranties of any kind, whether express or implied, including
          implied warranties of merchantability, fitness for a particular
          purpose, and non-infringement.
        </p>
      </Section>

      <Section title="10. Termination">
        <p>Either party may terminate use of the Service at any time.</p>
        <p className="mt-2">
          We may suspend, restrict, or terminate access immediately where
          necessary to:
        </p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>protect platform integrity,</li>
          <li>ensure user safety,</li>
          <li>comply with legal obligations,</li>
          <li>or prevent fraudulent or abusive activity.</li>
        </ul>
        <p className="mt-2">
          Upon termination, property listings may be removed from the platform.
        </p>
        <p className="mt-2">
          Provisions that by their nature should survive termination shall
          remain in effect.
        </p>
      </Section>

      <Section title="11. Modifications to Terms">
        <p>
          We may update these Terms periodically. Material changes will be
          notified by posting updated Terms and revising the &quot;Last
          Updated&quot; date.
        </p>
        <p className="mt-2">
          Continued use of the Service constitutes acceptance of the updated
          Terms.
        </p>
      </Section>

      <Section title="12. Governing Law">
        <p>
          These Terms shall be governed by and construed in accordance with the
          laws of the Hong Kong Special Administrative Region.
        </p>
        <p className="mt-2">
          The parties agree to first attempt good-faith negotiation to resolve
          disputes. Where unresolved, disputes shall be subject to the exclusive
          jurisdiction of the courts of Hong Kong.
        </p>
      </Section>

      <Section title="13. Supplier Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless UHOMES INTERNATIONAL
          CO., LIMITED from and against any claims, damages, liabilities,
          losses, and expenses arising from:
        </p>
        <ul className="list-disc ps-5 space-y-1 mt-2">
          <li>inaccurate or misleading property information;</li>
          <li>violation of applicable laws or regulations;</li>
          <li>disputes between you and tenants or third parties;</li>
          <li>breach of these Terms.</li>
        </ul>
      </Section>

      <Section title="14. Contact Us">
        <p>If you have questions regarding these Terms, please contact:</p>
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
        </p>
      </Section>
    </LegalLayout>
  );
}
