import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — DeedSlice",
  description: "DeedSlice Terms of Service — real estate tokenization platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ds-bg p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <a href="https://deedslice.com" className="text-ds-accent-text hover:underline text-sm mb-8 inline-block">
          ← Back to DeedSlice
        </a>

        <h1 className="text-3xl font-bold heading-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-ds-muted mb-10">Last updated: March 6, 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-ds-text" style={{ lineHeight: "1.8" }}>

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
            <p className="text-sm text-ds-text/80">
              By accessing or using the DeedSlice platform, website, APIs, or any related services (collectively, the &quot;Service&quot;),
              operated by DeedSlice (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
              you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) agree to be bound by these Terms of Service (&quot;Terms&quot;),
              our Privacy Policy, and all applicable laws and regulations.
              If you do not agree to these Terms in their entirety, you must not use the Service.
            </p>
            <p className="text-sm text-ds-text/80">
              We may modify these Terms at any time. Continued use of the Service after changes constitutes acceptance.
              Material changes will be communicated via email or in-platform notification at least 14 days in advance.
              If you disagree with updated Terms, your sole remedy is to cancel your account.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
            <p className="text-sm text-ds-text/80">
              DeedSlice provides a software-as-a-service (&quot;SaaS&quot;) platform that enables users to create digital
              representations of real estate assets on the Hedera Hashgraph distributed ledger technology (&quot;DLT&quot;).
              This includes, but is not limited to:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>Creating non-fungible token (&quot;NFT&quot;) deed records on Hedera</li>
              <li>Issuing fungible share tokens representing fractional interests</li>
              <li>Publishing immutable audit trail entries via Hedera Consensus Service (&quot;HCS&quot;)</li>
              <li>Managing investor records, allocations, and token transfers</li>
              <li>Storing and hash-verifying property documents (SHA-256 on-chain)</li>
              <li>Recording and tracking rent/income distributions to investors</li>
              <li>Providing white-label investor portals for Enterprise customers</li>
              <li>REST API and webhook integrations for Enterprise customers</li>
              <li>AI-assisted features including property analysis, email drafting, and distribution communications</li>
            </ul>
            <p className="text-sm text-ds-text/80 mt-3">
              DeedSlice is a <strong>technology infrastructure provider only</strong>. We do not provide legal, financial,
              tax, investment, brokerage, or real estate advisory services of any kind.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">3. Critical Legal Disclaimers</h2>
            <div className="bg-ds-bg rounded-xl p-5 border border-ds-border space-y-4">
              <div>
                <p className="text-sm font-semibold text-ds-text mb-1">NOT A SECURITIES OFFERING OR BROKER-DEALER</p>
                <p className="text-sm text-ds-text/80">
                  DeedSlice is not a registered broker-dealer, investment adviser, funding portal, or securities exchange
                  under the Securities Act of 1933, the Securities Exchange Act of 1934, or any state securities laws.
                  Tokens created through DeedSlice may constitute &quot;securities&quot; under the Howey Test or state law
                  depending on how they are marketed, sold, and structured. You are <strong>solely responsible</strong> for
                  determining whether your tokenized offering constitutes a security and for complying with all applicable
                  federal and state securities regulations, including but not limited to Regulation D (Rule 506(b) and 506(c)),
                  Regulation S, Regulation A+, and state Blue Sky laws. We strongly recommend consulting a securities attorney
                  before offering tokenized interests to any investor.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-ds-text mb-1">NOT LEGAL TITLE OR PROPERTY OWNERSHIP</p>
                <p className="text-sm text-ds-text/80">
                  NFT deed records and share tokens created on Hedera are <strong>digital representations only</strong>.
                  They do not constitute, convey, or evidence legal title, ownership, or any real property interest under
                  any jurisdiction&apos;s property law. Legal property ownership is governed exclusively by recorded deeds
                  filed with the appropriate county recorder&apos;s office. The platform does not transfer, encumber, or
                  modify any property rights whatsoever.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-ds-text mb-1">NO INVESTMENT, FINANCIAL, OR TAX ADVICE</p>
                <p className="text-sm text-ds-text/80">
                  DeedSlice does not recommend, endorse, evaluate, or advise on any property, investment, or financial
                  transaction. Property valuations displayed are automated estimates from third-party data providers
                  (including RentCast) and should <strong>not</strong> be relied upon for investment decisions, appraisals,
                  or lending. Token prices and distribution amounts are set by users, not by DeedSlice. You should consult
                  qualified legal counsel, a certified public accountant, and/or a registered investment adviser before making
                  any investment-related decisions.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-ds-text mb-1">NO GUARANTEE OF VALUE OR LIQUIDITY</p>
                <p className="text-sm text-ds-text/80">
                  Tokens created on DeedSlice have no guaranteed value, no secondary market, and no inherent liquidity.
                  There is no assurance that any token holder will be able to sell, transfer, or redeem their tokens.
                  Real estate investments are inherently illiquid and carry significant risk including total loss of investment.
                </p>
              </div>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">4. Eligibility and Account Requirements</h2>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>You must be at least 18 years of age (or the age of majority in your jurisdiction).</li>
              <li>You must have full legal authority over any property you tokenize on the platform.</li>
              <li>You must provide accurate, current, and complete information during registration.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You may not create accounts for others without their express authorization.</li>
              <li>Business entities must have the entity duly organized and in good standing.</li>
              <li>You must not have been previously banned or terminated from the Service.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">5. User Responsibilities and Prohibited Uses</h2>
            <p className="text-sm text-ds-text/80 mb-2">You agree that you will NOT:</p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>Tokenize property you do not own or have legal authority to tokenize</li>
              <li>Provide false, misleading, or fraudulent property information, valuations, or documents</li>
              <li>Use the Service for money laundering, terrorist financing, sanctions evasion, or any illegal activity</li>
              <li>Offer or sell tokens in violation of applicable securities laws</li>
              <li>Circumvent, disable, or interfere with any security features of the Service</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated systems (bots, scrapers) to access the Service without prior written consent</li>
              <li>Resell, sublicense, or redistribute access to the Service except through authorized white-label arrangements</li>
              <li>Upload malicious files, viruses, or harmful code through document uploads or API calls</li>
              <li>Harass, abuse, or harm other users, their investors, or DeedSlice personnel</li>
              <li>Use the Service in any jurisdiction where such use is prohibited by local law</li>
            </ul>
            <p className="text-sm text-ds-text/80 mt-3">
              You are solely responsible for ensuring that all property tokenizations, investor communications,
              token distributions, and offerings comply with all applicable federal, state, local, and international
              laws, including anti-money laundering (&quot;AML&quot;), know-your-customer (&quot;KYC&quot;), the Foreign
              Corrupt Practices Act, and OFAC sanctions requirements.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">6. Blockchain Transactions and Immutability</h2>
            <p className="text-sm text-ds-text/80">
              Transactions on the Hedera Hashgraph distributed ledger are <strong>permanent, public, and irreversible</strong>.
              Once a property is tokenized, the on-chain records — including NFT deeds, share tokens, HCS audit messages,
              and document hash entries — cannot be deleted, modified, or reversed by DeedSlice or any third party.
            </p>
            <p className="text-sm text-ds-text/80">
              You acknowledge and accept full responsibility for all data published to the blockchain, including property
              names, addresses, valuations, investor allocations, and document hashes. DeedSlice is not responsible for any
              losses, damages, or liabilities arising from incorrect data entry, lost wallet credentials, failed network
              transactions, Hedera network outages, or any other blockchain-related issues.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">7. Third-Party Services and AI Features</h2>
            <p className="text-sm text-ds-text/80">
              The Service integrates with and transmits data to various third-party service providers, including but not limited to:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li><strong>Hedera Hashgraph</strong> — Blockchain transactions, token creation, consensus messaging</li>
              <li><strong>OpenAI (GPT-4o-mini)</strong> — AI-assisted features including distribution email drafting,
                property analysis summaries, and investor communications. Property names, addresses, valuations, investor
                names, ownership percentages, and distribution amounts may be sent to OpenAI&apos;s API for processing.
                Data sent to OpenAI is subject to <a href="https://openai.com/policies/terms-of-use" className="text-ds-accent-text hover:underline" target="_blank" rel="noopener noreferrer">OpenAI&apos;s Terms of Use</a> and data handling policies.</li>
              <li><strong>Supabase</strong> — Database hosting, authentication, file storage</li>
              <li><strong>Stripe</strong> — Payment processing and subscription billing</li>
              <li><strong>Mapbox</strong> — Address autocomplete and geocoding</li>
              <li><strong>RentCast</strong> — Automated property valuation estimates</li>
              <li><strong>Resend</strong> — Transactional email delivery</li>
              <li><strong>Vercel</strong> — Application hosting and CDN</li>
            </ul>
            <p className="text-sm text-ds-text/80 mt-3">
              By using AI-powered features, you consent to the transmission of property and investor data to OpenAI for
              processing. You may opt out of AI features by not using AI-assisted drafting tools. DeedSlice does not
              control and is not responsible for the data handling practices of third-party providers. We encourage you
              to review their respective privacy policies and terms of service.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">8. Fees, Billing, and Refunds</h2>
            <p className="text-sm text-ds-text/80 mb-2">
              DeedSlice offers the following plans:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li><strong>Sandbox (Free)</strong> — Testnet only. No mainnet access. No tokenization credits.</li>
              <li><strong>Operator ($299/mo)</strong> — Full platform access. Mainnet tokenization requires credits:
                $1,499 per property or $4,999 for 5 properties (33% savings).</li>
              <li><strong>Enterprise ($50,000/yr)</strong> — Unlimited tokenization, white-label investor portal,
                REST API, webhooks, custom domain, priority support, and dedicated onboarding.</li>
            </ul>
            <p className="text-sm text-ds-text/80 mt-3">
              All fees are billed in US Dollars through Stripe. Subscription fees are billed in advance on a recurring basis.
              Tokenization credits are one-time purchases. Hedera network fees (~$0.01 per tokenization) are covered by DeedSlice.
            </p>
            <p className="text-sm text-ds-text/80">
              <strong>Refund policy:</strong> Subscription fees and tokenization credits are non-refundable except as required
              by applicable law. If you cancel a subscription, access continues until the end of the current billing period.
              Unused tokenization credits do not expire and are retained if you downgrade plans.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">9. White-Label and Enterprise Terms</h2>
            <p className="text-sm text-ds-text/80">
              Enterprise customers using white-label features may customize branding, deploy investor portals under
              custom domains, and access REST APIs. Enterprise customers are responsible for:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>All content, communications, and representations made through their white-label portal</li>
              <li>Compliance with all laws applicable to their investors and jurisdictions</li>
              <li>The accuracy and legality of all investor-facing information</li>
              <li>Obtaining necessary consents from their investors for data processing</li>
              <li>Ensuring their use of the API complies with rate limits and fair usage policies</li>
            </ul>
            <p className="text-sm text-ds-text/80 mt-3">
              DeedSlice retains the right to disable or suspend white-label portals that violate these Terms, are used
              for illegal purposes, or that generate excessive load on our infrastructure.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">10. Intellectual Property</h2>
            <p className="text-sm text-ds-text/80">
              The DeedSlice platform, including its design, code, documentation, branding, logos, and all related
              intellectual property, is owned by DeedSlice and protected by copyright, trademark, and other intellectual
              property laws. You may not copy, modify, distribute, or create derivative works of any part of the Service
              without our prior written consent.
            </p>
            <p className="text-sm text-ds-text/80">
              You retain ownership of all content you upload to the Service, including property information, documents,
              and images. By uploading content, you grant DeedSlice a limited, non-exclusive license to store, process,
              display, and transmit that content as necessary to provide the Service. On-chain data published to Hedera
              becomes part of the public ledger and is not subject to removal or modification.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">11. Privacy and Data Processing</h2>
            <p className="text-sm text-ds-text/80">
              We collect, store, and process personal data as described in our{" "}
              <a href="/privacy" className="text-ds-accent-text hover:underline">Privacy Policy</a>. By using the Service, you consent to data collection and processing.
              Key data handling practices include:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>Property and investor data stored in Supabase (US-hosted infrastructure)</li>
              <li>Property data published to the Hedera public ledger (permanently public)</li>
              <li>Document files stored in encrypted cloud storage with signed URL access</li>
              <li>Property and investor data may be sent to OpenAI for AI-assisted features</li>
              <li>IP addresses and user agents logged for security, rate limiting, and issuer certification</li>
              <li>Email addresses used for transactional communications via Resend</li>
              <li>Payment information processed by Stripe (DeedSlice does not store card numbers)</li>
            </ul>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">12. Indemnification</h2>
            <p className="text-sm text-ds-text/80">
              You agree to indemnify, defend, and hold harmless DeedSlice, its officers, directors, employees, contractors,
              and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses
              (including reasonable attorneys&apos; fees) arising from or related to:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>Your use or misuse of the Service</li>
              <li>Your violation of these Terms or any applicable law</li>
              <li>Any securities offering or investment activity conducted through the platform</li>
              <li>Any claim by an investor, regulator, or third party related to your tokenized properties</li>
              <li>Your failure to comply with KYC, AML, or securities regulations</li>
              <li>Content or data you upload, publish, or transmit through the Service</li>
              <li>Your white-label portal content, investor communications, or representations</li>
            </ul>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">13. Limitation of Liability</h2>
            <p className="text-sm text-ds-text/80 uppercase font-medium">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5 mt-2">
              <li>DEEDSLICE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR
                EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, DATA, PROPERTY VALUE,
                INVESTMENT RETURNS, OR OTHER INTANGIBLE LOSSES.</li>
              <li>DEEDSLICE SHALL NOT BE LIABLE FOR ANY DAMAGES ARISING FROM: (A) BLOCKCHAIN NETWORK FAILURES, DELAYS,
                OR CONGESTION; (B) INCORRECT DATA ENTRY BY USERS; (C) LOST OR COMPROMISED WALLET CREDENTIALS; (D) THIRD-PARTY
                SERVICE OUTAGES; (E) REGULATORY ACTIONS AGAINST YOUR OFFERINGS; (F) CHANGES IN PROPERTY VALUES; (G) INVESTOR
                DISPUTES OR LOSSES.</li>
              <li>OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL NOT EXCEED
                THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED
                DOLLARS ($100).</li>
              <li>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER
                EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
                PARTICULAR PURPOSE, ACCURACY, COMPLETENESS, OR NON-INFRINGEMENT.</li>
            </ul>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">14. Dispute Resolution and Arbitration</h2>
            <p className="text-sm text-ds-text/80">
              <strong>Binding Arbitration.</strong> Any dispute, claim, or controversy arising from or relating to these Terms
              or the Service shall be resolved by binding arbitration administered by the American Arbitration Association (&quot;AAA&quot;)
              under its Commercial Arbitration Rules. Arbitration shall be conducted in Brazos County, Texas, or remotely via
              video conference at the election of either party. The arbitrator&apos;s decision shall be final and binding.
            </p>
            <p className="text-sm text-ds-text/80">
              <strong>Class Action Waiver.</strong> You agree to resolve disputes with DeedSlice on an individual basis only.
              You waive any right to participate in a class action, class arbitration, or representative proceeding.
            </p>
            <p className="text-sm text-ds-text/80">
              <strong>Exceptions.</strong> Either party may seek injunctive or equitable relief in any court of competent
              jurisdiction for claims involving intellectual property infringement, data breaches, or unauthorized access.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">15. Termination and Suspension</h2>
            <p className="text-sm text-ds-text/80">
              We may suspend or terminate your account immediately and without notice for violation of these Terms,
              suspected fraud, illegal activity, or at our sole discretion. Upon termination:
            </p>
            <ul className="text-sm text-ds-text/80 list-disc pl-5 space-y-1.5">
              <li>Your access to the dashboard, APIs, and white-label portal will be revoked</li>
              <li>On-chain records on Hedera will persist permanently regardless of account status</li>
              <li>Off-chain data (documents, investor records) will be retained for 30 days before deletion,
                unless required longer by law or prior written arrangement</li>
              <li>No refunds will be issued for the current billing period</li>
            </ul>
            <p className="text-sm text-ds-text/80 mt-3">
              You may cancel your account at any time through the Settings page. Cancellation takes effect at the
              end of the current billing period.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">16. Force Majeure</h2>
            <p className="text-sm text-ds-text/80">
              DeedSlice shall not be liable for any failure or delay in performance due to causes beyond our reasonable
              control, including but not limited to: acts of God, natural disasters, pandemics, war, terrorism, government
              actions, blockchain network failures, internet outages, power failures, third-party service disruptions,
              or changes in applicable law or regulation.
            </p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">17. Governing Law</h2>
            <p className="text-sm text-ds-text/80">
              These Terms are governed by and construed in accordance with the laws of the State of Texas, United States,
              without regard to its conflict of law provisions. To the extent that litigation is permitted (per Section 14),
              exclusive jurisdiction and venue shall lie in the state and federal courts located in Brazos County, Texas.
            </p>
          </section>

          {/* 18 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">18. Severability and Entire Agreement</h2>
            <p className="text-sm text-ds-text/80">
              If any provision of these Terms is found to be invalid or unenforceable, that provision shall be enforced
              to the maximum extent permissible, and the remaining provisions shall remain in full force and effect.
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and DeedSlice
              regarding the Service and supersede all prior agreements, representations, and understandings.
            </p>
          </section>

          {/* 19 */}
          <section>
            <h2 className="text-lg font-semibold mb-2">19. Contact Information</h2>
            <p className="text-sm text-ds-text/80">
              For questions about these Terms, contact us at:{" "}
              <a href="mailto:legal@deedslice.com" className="text-ds-accent-text hover:underline">legal@deedslice.com</a>
            </p>
            <p className="text-sm text-ds-text/80 mt-2">
              For security concerns or vulnerability reports:{" "}
              <a href="mailto:security@deedslice.com" className="text-ds-accent-text hover:underline">security@deedslice.com</a>
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
