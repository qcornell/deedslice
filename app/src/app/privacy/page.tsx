import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — DeedSlice",
  description: "DeedSlice Privacy Policy.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ds-bg p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <a href="https://deedslice.com" className="text-ds-accent-text hover:underline text-sm mb-8 inline-block">
          ← Back to DeedSlice
        </a>

        <h1 className="text-3xl font-bold heading-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-ds-muted mb-10">Last updated: March 3, 2026</p>

        <div className="space-y-6 text-sm text-ds-text/80" style={{ lineHeight: "1.8" }}>
          <section>
            <h2 className="text-lg font-semibold mb-2 text-ds-text">Information We Collect</h2>
            <p><strong>Account data:</strong> email address, name, company name (optional).</p>
            <p><strong>Property data:</strong> property name, address, valuation, description, photos you upload.</p>
            <p><strong>Payment data:</strong> processed securely by Stripe. We do not store card numbers.</p>
            <p><strong>Usage data:</strong> pages visited, features used, anonymized analytics.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-ds-text">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and operate the DeedSlice platform</li>
              <li>To create blockchain records on Hedera as you direct</li>
              <li>To process payments and manage subscriptions</li>
              <li>To communicate service updates and support</li>
              <li>To improve the platform and user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-ds-text">Blockchain Data</h2>
            <p>
              When you tokenize a property, certain data is permanently published to the Hedera Hashgraph public ledger,
              including property name, token symbols, and audit messages. <strong>This data cannot be deleted or modified
              once published.</strong> Do not include sensitive personal information in property names or descriptions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-ds-text">Data Sharing</h2>
            <p>We do not sell your personal data. We share data only with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Supabase</strong> — database and authentication hosting</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Hedera Hashgraph</strong> — public blockchain (permanent record)</li>
              <li><strong>Mapbox</strong> — address autocomplete (query text only)</li>
              <li><strong>RentCast</strong> — property valuation estimates (address only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-ds-text">Data Security</h2>
            <p>
              We use industry-standard security measures including encrypted connections (TLS), secure authentication,
              and server-side key management. Hedera operator keys are never exposed to client-side code.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-ds-text">Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal data by contacting us.
              Note that blockchain records cannot be deleted. Account deletion will remove your DeedSlice profile
              and database records, but on-chain data will persist.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2 text-ds-text">Contact</h2>
            <p>
              Privacy questions? Email us at{" "}
              <a href="mailto:privacy@deedslice.com" className="text-ds-accent-text hover:underline">privacy@deedslice.com</a>.
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
