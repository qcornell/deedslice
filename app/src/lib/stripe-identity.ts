/**
 * Stripe Identity — Server-side KYC integration
 *
 * Uses Stripe Identity (VerificationSessions) for investor KYC.
 * $1.50 per verification, no monthly minimum, same Stripe dashboard.
 *
 * Flow:
 *   1. Create VerificationSession → get client_secret
 *   2. Frontend opens Stripe modal with client_secret
 *   3. Investor scans ID + selfie
 *   4. Stripe webhook fires with result
 *   5. We update investor KYC status
 *
 * Env vars (already configured from Stripe billing):
 *   STRIPE_SECRET_KEY — same key used for subscriptions
 *   STRIPE_KYC_WEBHOOK_SECRET — separate webhook endpoint secret for identity events
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia" as any,
});

/**
 * Create a Stripe Identity VerificationSession for an investor.
 *
 * Returns the client_secret (passed to frontend) and session ID (stored in DB).
 */
export async function createVerificationSession(params: {
  investorId: string;
  investorName: string;
  investorEmail?: string;
  propertyId: string;
  returnUrl?: string;
}): Promise<{ clientSecret: string; sessionId: string }> {
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    options: {
      document: {
        require_matching_selfie: true,
      },
    },
    provided_details: {
      ...(params.investorEmail ? { email: params.investorEmail } : {}),
    },
    metadata: {
      ds_investor_id: params.investorId,
      ds_property_id: params.propertyId,
      ds_investor_name: params.investorName,
    },
    ...(params.returnUrl ? { return_url: params.returnUrl } : {}),
  });

  return {
    clientSecret: session.client_secret!,
    sessionId: session.id,
  };
}

/**
 * Retrieve a VerificationSession to check its status.
 */
export async function getVerificationSession(sessionId: string): Promise<{
  id: string;
  status: string;
  lastError: string | null;
}> {
  const session = await stripe.identity.verificationSessions.retrieve(sessionId);
  return {
    id: session.id,
    status: session.status,
    lastError: (session as any).last_error?.code || null,
  };
}

/**
 * Map Stripe Identity session status to our internal KYC status.
 *
 * Stripe statuses:
 *   - requires_input → investor needs to submit/resubmit
 *   - processing → Stripe is reviewing
 *   - verified → passed all checks
 *   - canceled → session was canceled
 */
export function mapStripeStatus(
  stripeStatus: string
): "verified" | "rejected" | "pending" | "unverified" {
  switch (stripeStatus) {
    case "verified":
      return "verified";
    case "requires_input":
      return "pending"; // They need to resubmit — we treat as pending, not rejected
    case "processing":
      return "pending";
    case "canceled":
      return "unverified";
    default:
      return "pending";
  }
}

/**
 * Construct and verify a Stripe webhook event.
 * Uses the standard Stripe webhook signature verification.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

export { stripe };
