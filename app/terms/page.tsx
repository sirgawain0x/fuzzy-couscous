import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/common/LegalPage";

export const metadata: Metadata = {
  title: "Terms and Conditions | Creative Finance",
  description:
    "The Terms and Conditions governing access to and use of the Creative Finance platform, operated by Creative Platform Inc.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms and Conditions" effectiveDate="April 23, 2026">
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Important:</strong> Creative Finance provides access to decentralized finance (DeFi)
        protocols and is not a bank, broker-dealer, or investment advisor. Nothing on the Platform
        constitutes legal, tax, or investment advice. Digital assets are volatile and can lose
        value. Use of the Platform involves smart-contract risk and is at your own risk.
      </div>

      <LegalSection heading="Acceptance of Terms">
        <p>
          These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of the
          Creative Finance platform (&quot;Creative Finance,&quot; the &quot;Platform&quot;),
          operated by Creative Platform Inc. (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          By accessing or using the Platform, you acknowledge that you have read, understood, and
          agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not use
          the Platform.
        </p>
      </LegalSection>

      <LegalSection heading="Description of Service">
        <p>
          Creative Finance is a non-custodial platform that provides access to decentralized finance
          vaults, membership-gated tiers via Unlock Protocol, fiat onramp via Coinbase, and
          smart-wallet infrastructure via Crossmint, deployed on the Base blockchain. The Platform
          enables users to deposit stablecoins (USDC) into yield-bearing strategies powered by
          third-party protocols including Aave and Yearn.
        </p>
        <p>
          Creative Platform Inc. is not a bank, custodian, money transmitter, broker-dealer, or
          registered investment advisor. The Platform is a user interface to public smart contracts;
          we do not take custody of your funds.
        </p>
      </LegalSection>

      <LegalSection heading="Eligibility">
        <p>
          To use the Platform, you must be at least 18 years old or the legal age of majority in
          your jurisdiction, and you must have the legal capacity to enter into these Terms. You
          represent and warrant that you:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Are not a resident of, or located in, any jurisdiction subject to comprehensive U.S.
            sanctions (including Cuba, Iran, North Korea, Syria, the Crimea, Donetsk, and Luhansk
            regions)
          </li>
          <li>
            Are not listed on any U.S. government list of prohibited or restricted parties
            (including the OFAC SDN List)
          </li>
          <li>
            Will comply with all applicable laws, including tax, anti-money-laundering, and
            securities laws, in your jurisdiction
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Fee Schedule">
        <p>Creative Finance charges performance fees on vault earnings as follows:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Non-members:</strong> 20% performance fee on net vault earnings
          </li>
          <li>
            <strong>Members (Creative, Investor, Brand tiers):</strong> 10% performance fee floor,
            enforced on-chain by the Bouncer contract; members may set fees above the floor but
            never below
          </li>
        </ul>
        <p>
          Fees are distributed as follows: 50% to the underlying Aave integration, 10% to the
          underlying Yearn integration (where applicable), and the remainder to the vault manager or
          Creative Bank Treasury. Brand and Creator members may configure a Fee Receiver address to
          route their manager share to a wallet they control. Network gas fees on Base are borne by
          the user and are separate from performance fees.
        </p>
        <p>
          Fees and tier configurations may change over time. The on-chain contract is the source of
          truth for fee settings at any given block.
        </p>
      </LegalSection>

      <LegalSection heading="Wallet Custody and Keys">
        <p>
          The Platform is non-custodial. Your funds are held in a smart wallet secured by passkey
          signers provisioned via Crossmint. Creative Platform Inc. does not hold, control, or have
          access to your funds or private keys. You are solely responsible for maintaining access to
          your passkey and recovery methods. Loss of access to your signers may result in permanent,
          irrecoverable loss of funds.
        </p>
      </LegalSection>

      <LegalSection heading="Risk Disclosures">
        <p>
          Use of the Platform involves material risk. You acknowledge and accept the following
          risks, among others:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            <strong>Smart-contract risk:</strong> Bugs, vulnerabilities, or exploits in Creative
            Finance contracts or underlying protocols (Aave, Yearn, Unlock, Crossmint, Bouncer) can
            result in total loss of deposited funds
          </li>
          <li>
            <strong>Market risk:</strong> Digital asset prices are volatile; yields are not
            guaranteed and may be negative
          </li>
          <li>
            <strong>Stablecoin risk:</strong> USDC and other stablecoins may depeg from their
            reference asset, redemption may be paused, or issuers may fail
          </li>
          <li>
            <strong>Network risk:</strong> The Base network may experience congestion, outages,
            reorganizations, or consensus failures; gas costs may spike
          </li>
          <li>
            <strong>Regulatory risk:</strong> Laws and regulations applicable to digital assets and
            DeFi are evolving and may change in ways that affect your ability to use the Platform or
            the value of your holdings
          </li>
          <li>
            <strong>No insurance:</strong> Funds deposited on the Platform are{" "}
            <strong>not FDIC-insured, not SIPC-protected</strong>, and are not guaranteed or backed
            by any government
          </li>
          <li>
            <strong>Third-party risk:</strong> Onramp partners, wallet providers, and infrastructure
            providers operate independently; their failure or compromise may affect your experience
            or funds
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="SMS Terms and Conditions">
        <p>
          Creative Platform Inc.: A campaign that covers multiple use cases such as Customer Care
          and Marketing to engage with our customers. Message frequency varies. Message and data
          rates may apply. Reply HELP for help. Reply STOP to cancel. Carriers are not liable for
          any delays or undelivered messages.
        </p>
      </LegalSection>

      <LegalSection heading="User Responsibilities">
        <p>
          <strong>Account Security.</strong> You are responsible for maintaining the confidentiality
          of your account credentials, passkey signers, and recovery methods, and for ensuring that
          your account information is accurate and up to date.
        </p>
        <p>
          <strong>Compliance.</strong> You agree to comply with all applicable laws, regulations,
          and third-party rights while using the Platform, including tax reporting obligations in
          your jurisdiction.
        </p>
        <p>
          <strong>Prohibited Activities.</strong> You must not engage in any activity that may
          interfere with the proper functioning of the Platform or infringe upon the rights of
          others. Prohibited activities include, without limitation:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Unauthorized access, data scraping, or automated use that burdens our systems</li>
          <li>Attempting to exploit smart-contract vulnerabilities or bypass on-chain limits</li>
          <li>Using the Platform to facilitate money laundering, sanctions evasion, or fraud</li>
          <li>Impersonating another person or misrepresenting your affiliation</li>
          <li>Spamming, phishing, or distributing malware</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Intellectual Property">
        <p>
          <strong>Ownership.</strong> The Platform, including its content, logos, trademarks, and
          other intellectual property, is owned by Creative Platform Inc. or its licensors. You may
          not use, reproduce, or distribute our intellectual property without prior written
          permission.
        </p>
        <p>
          <strong>User Contributions.</strong> By contributing content or materials to the Platform,
          you grant Creative Platform Inc. a non-exclusive, worldwide, royalty-free license to use,
          reproduce, modify, adapt, and distribute your contributions for the purpose of operating
          and promoting the Platform.
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimer of Warranties">
        <p>
          The Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To
          the fullest extent permitted by law, Creative Platform Inc. disclaims all warranties,
          express or implied, including warranties of merchantability, fitness for a particular
          purpose, non-infringement, and uninterrupted or error-free operation. We make no
          warranties or representations about the accuracy, reliability, completeness, or timeliness
          of the Platform, any underlying smart contracts, or any yields or outcomes obtained
          through the Platform.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of Liability">
        <p>
          To the maximum extent permitted by law, in no event shall Creative Platform Inc. or its
          affiliates, officers, employees, or agents be liable for any direct, indirect, incidental,
          special, consequential, exemplary, or punitive damages arising out of or in connection
          with your use of the Platform, including loss of funds, loss of profits, loss of data, or
          business interruption, even if advised of the possibility of such damages.
        </p>
        <p>
          Our total aggregate liability for any claims under these Terms, whether in contract, tort,
          or otherwise, shall be limited to the greater of (a) the amount of fees paid by you to
          Creative Platform Inc. in the twelve (12) months preceding the event giving rise to the
          claim, or (b) one hundred U.S. dollars ($100).
        </p>
      </LegalSection>

      <LegalSection heading="Modification and Termination">
        <p>
          We reserve the right to modify, suspend, or terminate the Platform or any part thereof at
          any time without prior notice. We may also update or revise these Terms from time to time.
          Changes will be effective upon posting the updated Terms on the Platform, and the
          Effective Date above will be updated. Your continued use of the Platform after changes
          constitutes your acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection heading="Governing Law and Jurisdiction">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the State of
          Delaware, USA, without regard to its conflict-of-laws principles. Any dispute arising out
          of or in connection with these Terms shall be submitted to the exclusive jurisdiction of
          the state and federal courts located in Delaware, USA.
        </p>
      </LegalSection>

      <LegalSection heading="Contact Us">
        <p>
          If you have questions or concerns regarding these Terms, contact us at{" "}
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
