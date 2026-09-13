import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/common/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Creative Finance",
  description:
    "How Creative Platform Inc. collects, uses, and protects personal information for users of the Creative Finance platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="April 23, 2026">
      <LegalSection heading="Introduction">
        <p>
          Creative Platform Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the
          Creative Finance platform (&quot;Creative Finance,&quot; the &quot;Platform&quot;). We are
          committed to protecting the privacy and security of our users&apos; personal information.
          This Privacy Policy explains how we collect, use, disclose, and protect personal
          information of individuals who interact with the Platform. By accessing or using Creative
          Finance, you agree to the terms outlined in this policy.
        </p>
      </LegalSection>

      <LegalSection heading="Information We Collect">
        <h3 className="text-base font-semibold text-slate-900">1.1 Personal Information</h3>
        <p>We may collect personal information that you provide directly to us, including:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Contact details (e.g., name, email address, phone number)</li>
          <li>Profile information (e.g., username, photograph)</li>
          <li>
            Wallet and on-chain identifiers (e.g., EVM wallet address, transaction hashes on Base)
          </li>
          <li>
            Identity verification (KYC) data collected by our onramp partners when you purchase
            crypto with fiat — we receive confirmation of verification, not the underlying identity
            documents
          </li>
          <li>Communication and marketing preferences</li>
        </ul>

        <h3 className="text-base font-semibold text-slate-900">
          1.2 Automatically Collected Information
        </h3>
        <p>When you use the Platform, certain information may be collected automatically:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Log information (e.g., IP address, browser type, referring/exit pages, operating system,
            date/time stamps)
          </li>
          <li>
            Device information (e.g., device type, unique device identifiers, network information)
          </li>
          <li>Usage data (e.g., pages visited, links clicked, interactions with our services)</li>
        </ul>

        <h3 className="text-base font-semibold text-slate-900">
          1.3 Cookies and Similar Technologies
        </h3>
        <p>
          We may use cookies and similar technologies to collect information about your interactions
          with the Platform. You can manage your cookie preferences through your browser settings.
        </p>
      </LegalSection>

      <LegalSection heading="How We Use Information">
        <p>We may use the collected information for purposes including:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Providing, operating, and improving the Platform</li>
          <li>Personalizing your experience</li>
          <li>Communicating with you about your account and updates</li>
          <li>Processing transactions, onramp flows, and membership purchases</li>
          <li>Analyzing usage patterns and product trends</li>
          <li>Detecting, preventing, and responding to fraud or unauthorized activity</li>
          <li>Complying with legal, tax, and regulatory obligations</li>
        </ul>
      </LegalSection>

      <LegalSection heading="How We Share Information">
        <p>
          We share personal information with service providers who help us operate the Platform.
          These include:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Crossmint</strong> — authentication, wallet infrastructure, and session
            management
          </li>
          <li>
            <strong>Crossmint</strong> — non-custodial smart wallet infrastructure and passkey
            signer management
          </li>
          <li>
            <strong>Coinbase</strong> — fiat onramp, identity verification, and payment processing
          </li>
          <li>
            <strong>CockroachDB (Cockroach Labs)</strong> — encrypted database hosting for account
            and transaction records
          </li>
          <li>
            <strong>Goldsky</strong> — indexing of public on-chain events relevant to your account
          </li>
        </ul>
        <p>We may also share information:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>With your consent or as needed to fulfill your requested services</li>
          <li>
            With law enforcement, regulators, or other governmental bodies as required by applicable
            law
          </li>
          <li>
            In connection with a merger, acquisition, financing, or other corporate transaction
            involving Creative Platform Inc.
          </li>
        </ul>
        <p>
          No mobile information will be shared with third parties or affiliates for marketing or
          promotional purposes. All the above categories exclude text messaging originator opt-in
          data and consent; this information will not be shared with any third parties.
        </p>
      </LegalSection>

      <LegalSection heading="Public On-Chain Information">
        <p>
          Creative Finance operates on Base, a public blockchain. Wallet addresses, transactions,
          token balances, and membership NFTs (Unlock Protocol keys) associated with your wallet are
          visible to anyone and are recorded permanently on-chain. We cannot delete or modify
          on-chain data. Do not share your wallet address if you do not wish for others to see the
          associated on-chain activity.
        </p>
      </LegalSection>

      <LegalSection heading="Data Retention">
        <p>
          We retain your personal information for as long as necessary to fulfill the purposes
          outlined in this Privacy Policy, unless a longer retention period is required or permitted
          by law (including for tax, accounting, or regulatory purposes).
        </p>
      </LegalSection>

      <LegalSection heading="Data Security">
        <p>
          We use reasonable administrative, technical, and physical safeguards to protect your
          personal information from unauthorized access, disclosure, alteration, or destruction.
          Because no method of internet transmission or electronic storage is completely secure, we
          cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="Your Rights">
        <p>
          Depending on your jurisdiction, you may have rights under laws such as the GDPR (European
          Economic Area and UK) or CCPA/CPRA (California) regarding your personal information,
          including the right to access, correct, delete, port, or restrict its processing, and the
          right to object to certain processing activities. To exercise these rights, contact us
          using the information provided below. We will respond within the time frame required by
          applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="Children's Privacy">
        <p>
          The Platform is not intended for individuals under the age of 18. We do not knowingly
          collect personal information from children. If you believe we have inadvertently collected
          personal information from a child, please contact us immediately so we can delete it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to This Privacy Policy">
        <p>
          We may modify or update this Privacy Policy from time to time. Changes will be effective
          upon posting the revised policy on the Platform, and the Effective Date above will be
          updated. We encourage you to review this Privacy Policy periodically.
        </p>
      </LegalSection>

      <LegalSection heading="Contact Us">
        <p>
          If you have questions or concerns about this Privacy Policy or our privacy practices,
          contact us at{" "}
          <a
            href="mailto:creatives@creativeplatform.xyz"
            className="text-blue-700 underline underline-offset-2"
          >
            creatives@creativeplatform.xyz
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
