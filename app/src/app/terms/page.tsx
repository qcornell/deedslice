import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — DeedSlice",
  description: "DeedSlice Terms of Service and legal disclaimers.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ds-bg p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <a href="https://deedslice.com" className="text-ds-accent-text hover:underline text-sm mb-8 inline-block">
          ← Back to DeedSlice
        </a>

        <h1 className="text-3xl font-bold heading-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-ds-muted mb-10">Last updated: March 3, 2026</p>

        <div className="prose prose-sm max-w-none space-y-6 text-ds-text" style={{ lineHeight: "1.8" }}>
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
            <p className="text-sm text-ds-text/80">
              By accessing or using the DeedSlice platform (&quot;Service&quot;), operated by DeedSlice (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
              you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
            <p className="text-sm text-ds-text/80">
              DeedSlice provides a software platform that enables users to create digital representations of real estate assets
              on the Hedera Hashgraph distributed ledger. This includes creating NFT deed records, fungible share tokens,
              and consensus service audit trails. DeedSlice is a <strong>technology platform only</strong> — we do not provide
              legal, financial, tax, or investment advice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Important Legal Disclaimers</h2>
            <div className="bg-ds-bg rounded-xl p-5 border border-ds-border space-y-3">
              <p className="text-sm text-ds-text/80">
                <strong>NOT A SECURITIES OFFERING.</strong> Tokens created through DeedSlice do not constitute securities,
                investment contracts, or financial instruments unless the property owner independently registers them as such
                with applicable regulatory authorities (e.g., SEC, state regulators). Users are solely responsible for ensuring
                their use of DeedSlice complies with all applicable securities laws.
              </p>
              <p className="text-sm text-ds-text/80">
                <strong>NOT LEGAL TITLE.</strong> NFT deed records created on Hedera are digital representations for record-keeping
                and transparency purposes. They do not constitute legal title, ownership, or any real property interest under any
                jurisdiction&apos;s property law. Legal property ownership is governed by recorded deeds with your county recorder&apos;s office.
              </p>
              <p className="text-sm text-ds-text/80">
                <strong>NO INVESTMENT ADVICE.</strong> DeedSlice does not recommend, endorse, or advise on any investment.
                Property valuations displayed are estimates from third-party data sources and should not be relied upon for
                investment decisions. Consult qualified legal and financial advisors before tokenizing property or accepting investors.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. User Responsibilities</h2>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>You must be at least 18 years old and have legal authority over any property you tokenize.</li>
              <li>You are responsible for the accuracy of all property information you provide.</li>
              <li>You must comply with all applicable laws regarding property ownership, securities, and taxation.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You will not use the Service for money laundering, fraud, or any illegal activity.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Blockchain Transactions</h2>
            <p className="text-sm text-ds-text/80">
              Transactions on Hedera Hashgraph are <strong>permanent and irreversible</strong>. Once a property is tokenized,
              the on-chain records (NFTs, tokens, HCS messages) cannot be deleted or modified. DeedSlice is not responsible
              for any losses arising from blockchain transactions, including but not limited to incorrect data entry,
              lost private keys, or network failures.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Fees and Billing</h2>
            <p className="text-sm text-ds-text/80">
              The Sandbox plan provides free testnet access. The Operator plan ($299/mo) provides full platform access; mainnet tokenization requires credits ($1,499/property or $4,999 for 5). Enterprise ($50,000/yr) includes unlimited tokenization and white-label features. Subscriptions are billed via Stripe.
              Hedera network fees (~$0.01 per tokenization) are paid by DeedSlice on behalf of users.
              Subscription fees and tokenization credits are non-refundable except as required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Privacy</h2>
            <p className="text-sm text-ds-text/80">
              We collect and process personal data as described in our Privacy Policy. Property information you enter
              may be stored in our database and on the Hedera public ledger. Information published to Hedera is
              permanently public and cannot be removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Limitation of Liability</h2>
            <p className="text-sm text-ds-text/80">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, DEEDSLICE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT
              LIMITED TO LOSS OF PROPERTY VALUE, FAILED TRANSACTIONS, OR REGULATORY ACTIONS. OUR TOTAL LIABILITY
              SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Termination</h2>
            <p className="text-sm text-ds-text/80">
              We may suspend or terminate your account at any time for violation of these terms. On-chain records
              will persist on Hedera regardless of account status. You may cancel your subscription at any time
              through the Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Governing Law</h2>
            <p className="text-sm text-ds-text/80">
              These Terms are governed by the laws of the State of Texas, USA, without regard to conflict of law principles.
              Any disputes shall be resolved in the courts of Brazos County, Texas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Changes to Terms</h2>
            <p className="text-sm text-ds-text/80">
              We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance.
              Material changes will be communicated via email or in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">12. Contact</h2>
            <p className="text-sm text-ds-text/80">
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:legal@deedslice.com" className="text-ds-accent-text hover:underline">legal@deedslice.com</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-ds-border text-center">
          <p className="text-xs text-ds-muted">
            © {new Date().getFullYear()} DeedSlice. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
