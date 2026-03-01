import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — uhomes.com Partners",
};

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-10">
          Effective Date: March 1, 2026 &middot; Last Updated: March 1, 2026
        </p>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using the Partner Onboarding Portal operated by
            UHOMES INTERNATIONAL CO., LIMITED (&quot;uhomes.com&quot;,
            &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) at{" "}
            <strong>on.pylospay.com</strong> (the &quot;Service&quot;), you
            agree to be bound by these Terms of Service (&quot;Terms&quot;). If
            you do not agree to these Terms, you may not use the Service.
            &quot;You&quot; refers to the entity or individual registering as a
            partner supplier.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            The Service provides accommodation suppliers with tools to onboard
            properties onto the uhomes.com platform, including:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Partner application and registration</li>
            <li>Contract review and electronic signature</li>
            <li>Property data submission and management</li>
            <li>Automated data extraction and quality scoring</li>
          </ul>
        </Section>

        <Section title="3. Account Registration">
          <p>
            To use the Service, you must provide accurate and complete
            information during registration. You are responsible for maintaining
            the confidentiality of your account credentials and for all
            activities under your account. You agree to notify us immediately of
            any unauthorized use.
          </p>
        </Section>

        <Section title="4. Partner Obligations">
          <p>As a partner supplier, you agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              Provide accurate, current, and complete property information
            </li>
            <li>
              Maintain and promptly update your property data to reflect actual
              availability, pricing, and conditions
            </li>
            <li>
              Comply with all applicable laws and regulations in your
              jurisdiction
            </li>
            <li>Not submit fraudulent, misleading, or unlawful content</li>
            <li>
              Respond to booking inquiries and student communications in a
              timely manner
            </li>
          </ul>
        </Section>

        <Section title="5. Intellectual Property">
          <p>
            All content, trademarks, and technology associated with the Service
            are owned by UHOMES INTERNATIONAL CO., LIMITED or its licensors. You
            retain ownership of the property data and images you submit, but
            grant UHOMES INTERNATIONAL CO., LIMITED a worldwide, non-exclusive,
            royalty-free license to use, display, and distribute such content on
            the uhomes.com platform and partner networks for the purpose of
            listing and promoting your properties.
          </p>
        </Section>

        <Section title="6. Content and Data">
          <p>
            You represent and warrant that you have the right to submit all
            content provided through the Service, including property images and
            descriptions. You are solely responsible for the accuracy and
            legality of your content. We reserve the right to remove content
            that violates these Terms or applicable law.
          </p>
        </Section>

        <Section title="7. Commission and Payment">
          <p>
            Commission rates and payment terms are governed by the individual
            partnership agreement (contract) executed between you and
            uhomes.com. These Terms do not supersede the terms of your executed
            contract.
          </p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, UHOMES
            INTERNATIONAL CO., LIMITED shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising out
            of or relating to your use of the Service, including but not limited
            to loss of profits, data, or business opportunities.
          </p>
          <p className="mt-2">
            Our total aggregate liability shall not exceed the total commissions
            paid to UHOMES INTERNATIONAL CO., LIMITED by you in the twelve (12)
            months preceding the claim.
          </p>
        </Section>

        <Section title="9. Disclaimer of Warranties">
          <p>
            The Service is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, whether express or
            implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
        </Section>

        <Section title="10. Termination">
          <p>
            Either party may terminate the use of the Service at any time. We
            reserve the right to suspend or terminate your access if you violate
            these Terms or engage in fraudulent activity. Upon termination, your
            property listings will be removed from the uhomes.com platform.
            Provisions that by their nature should survive termination shall
            remain in effect.
          </p>
        </Section>

        <Section title="11. Modifications to Terms">
          <p>
            We may update these Terms from time to time. We will notify you of
            material changes by posting the updated Terms on this page and
            updating the &quot;Last Updated&quot; date. Your continued use of
            the Service after changes constitutes acceptance of the updated
            Terms.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of the Hong Kong Special Administrative Region, without
            regard to its conflict of law provisions. Any disputes arising out
            of or in connection with these Terms shall be subject to the
            exclusive jurisdiction of the courts of the Hong Kong Special
            Administrative Region.
          </p>
        </Section>

        <Section title="13. Contact Us">
          <p>If you have questions about these Terms, please contact us at:</p>
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
