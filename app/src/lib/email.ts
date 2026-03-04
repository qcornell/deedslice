import { Resend } from "resend";

// Lazy init — avoids build-time crash when env vars aren't set yet
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = () => process.env.EMAIL_FROM || "DeedSlice <noreply@deedslice.com>";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";

// ─── Shared styles ──────────────────────────────────────────
const BRAND = "#0D9488";
const BG = "#F8FAFB";
const CARD = "#FFFFFF";
const MUTED = "#94A3B8";
const TEXT = "#0F172A";

function layout(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:20px;font-weight:700;color:${TEXT};letter-spacing:-0.5px;">🏠 DeedSlice</span>
    </div>
    <!-- Card -->
    <div style="background:${CARD};border-radius:16px;padding:36px 32px;border:1px solid #E2E8F0;">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${TEXT};letter-spacing:-0.3px;">${title}</h1>
      ${body}
    </div>
    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;color:${MUTED};font-size:11px;line-height:1.6;">
      <p style="margin:0;">DeedSlice — Real estate tokenization on Hedera</p>
      <p style="margin:4px 0 0;"><a href="https://deedslice.com" style="color:${BRAND};text-decoration:none;">deedslice.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

function button(text: string, href: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
      ${text}
    </a>
  </div>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${TEXT};">${text}</p>`;
}

function muted(text: string): string {
  return `<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:${MUTED};">${text}</p>`;
}

function divider(): string {
  return `<div style="border-top:1px solid #E2E8F0;margin:24px 0;"></div>`;
}

// ─── Email Templates ────────────────────────────────────────

/** Welcome email — sent after signup */
export async function sendWelcomeEmail(to: string, name?: string) {
  const greeting = name ? `Welcome, ${name}!` : "Welcome to DeedSlice!";
  const html = layout("Welcome to DeedSlice 🎉", `
    ${p(`${greeting} You're all set to start tokenizing real estate on Hedera.`)}
    ${p("Your <strong>Starter plan</strong> includes:")}
    <ul style="margin:0 0 14px;padding-left:20px;font-size:14px;line-height:2;color:${TEXT};">
      <li>1 free property tokenization (testnet sandbox)</li>
      <li>NFT master deed + fractional share tokens</li>
      <li>Tamper-proof HCS audit trail</li>
      <li>Shareable investor dashboard</li>
    </ul>
    ${p("Try tokenizing a property in the sandbox — it's free and takes about 10 seconds.")}
    ${button("Launch Console →", `${APP_URL()}/dashboard`)}
    ${divider()}
    ${muted("Ready for mainnet? Upgrade to <strong>Pro ($99.99/mo)</strong> for up to 5 live properties, document vault, and investor management.")}
  `);

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: "Welcome to DeedSlice 🏠",
    html,
  });
}

/** Tokenization complete — sent after successful deployment */
export async function sendTokenizationEmail(
  to: string,
  propertyName: string,
  propertyId: string,
  network: "mainnet" | "testnet",
  valuation: number,
  slices: number,
  nftTokenId: string,
  shareTokenId: string,
) {
  const networkLabel = network === "mainnet" ? "Mainnet" : "Testnet";
  const pricePerSlice = Math.round(valuation / slices);
  const hashscan = `https://hashscan.io/${network}`;

  const html = layout("Property Tokenized! 🏆", `
    ${p(`<strong>${propertyName}</strong> is now live on Hedera ${networkLabel}.`)}
    <div style="background:${BG};border-radius:12px;padding:20px;margin:16px 0;">
      <table style="width:100%;font-size:13px;color:${TEXT};" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;color:${MUTED};">Valuation</td><td style="padding:4px 0;text-align:right;font-weight:600;">$${valuation.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">Slices</td><td style="padding:4px 0;text-align:right;">${slices.toLocaleString()} @ $${pricePerSlice}/slice</td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">NFT Deed</td><td style="padding:4px 0;text-align:right;"><a href="${hashscan}/token/${nftTokenId}" style="color:${BRAND};text-decoration:none;font-family:monospace;font-size:12px;">${nftTokenId}</a></td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">Share Token</td><td style="padding:4px 0;text-align:right;"><a href="${hashscan}/token/${shareTokenId}" style="color:${BRAND};text-decoration:none;font-family:monospace;font-size:12px;">${shareTokenId}</a></td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">Network</td><td style="padding:4px 0;text-align:right;">${networkLabel}</td></tr>
      </table>
    </div>
    ${p("Share your investor dashboard link:")}
    <div style="background:${BG};border-radius:8px;padding:10px 14px;font-family:monospace;font-size:12px;color:${BRAND};margin-bottom:16px;word-break:break-all;">
      ${APP_URL()}/view/${propertyId}
    </div>
    ${button("View Property Dashboard →", `${APP_URL()}/dashboard/property/${propertyId}`)}
    ${divider()}
    ${muted("Every transaction is permanently recorded on Hedera Consensus Service. Verify on <a href='${hashscan}' style='color:${BRAND};'>HashScan</a>.")}
  `);

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `✅ ${propertyName} — Tokenized on Hedera ${networkLabel}`,
    html,
  });
}

/** Investor added — notify property owner */
export async function sendInvestorAddedEmail(
  to: string,
  propertyName: string,
  propertyId: string,
  investorName: string,
  slices: number,
  percentage: number,
) {
  const html = layout("New Investor Added 👥", `
    ${p(`<strong>${investorName}</strong> has been added to <strong>${propertyName}</strong>.`)}
    <div style="background:${BG};border-radius:12px;padding:20px;margin:16px 0;">
      <table style="width:100%;font-size:13px;color:${TEXT};" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;color:${MUTED};">Investor</td><td style="padding:4px 0;text-align:right;font-weight:600;">${investorName}</td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">Slices</td><td style="padding:4px 0;text-align:right;">${slices.toLocaleString()}</td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">Ownership</td><td style="padding:4px 0;text-align:right;">${percentage}%</td></tr>
      </table>
    </div>
    ${p("This change has been logged to the HCS audit trail.")}
    ${button("View Investors →", `${APP_URL()}/dashboard/property/${propertyId}`)}
  `);

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `👥 ${investorName} added to ${propertyName}`,
    html,
  });
}

/** Plan upgraded */
export async function sendUpgradeEmail(to: string, plan: string) {
  const planName = plan === "pro" ? "Pro" : plan === "enterprise" ? "Enterprise" : plan;
  const html = layout(`Welcome to ${planName}! 🚀`, `
    ${p(`Your DeedSlice account has been upgraded to <strong>${planName}</strong>.`)}
    ${p(plan === "pro"
      ? "You now have access to <strong>5 mainnet properties</strong>, document vault with SHA-256 verification, and full investor management."
      : "You now have <strong>unlimited properties</strong>, REST API access, webhooks, priority support, and custom integrations. White-label dashboard is coming Q2."
    )}
    ${button("Start Tokenizing →", `${APP_URL()}/dashboard/new`)}
    ${divider()}
    ${muted("Your subscription is managed through Stripe. Manage billing in Settings.")}
  `);

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `🚀 Upgraded to DeedSlice ${planName}`,
    html,
  });
}

/** Distribution notification — sent to investor when a distribution is recorded */
export async function sendDistributionEmail(
  to: string,
  investorName: string,
  propertyName: string,
  amount: number,
  period: string | null,
  type: string,
  portalUrl?: string,
) {
  const typeLabel = type === "return_of_capital" ? "return of capital" : type === "other" ? "payment" : "distribution";
  const html = layout(`New ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} 💰`, `
    ${p(`Hi ${investorName},`)}
    ${p(`A ${typeLabel} of <strong>$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> has been recorded for your investment in <strong>${propertyName}</strong>${period ? ` for <strong>${period}</strong>` : ""}.`)}
    <div style="background:${BG};border-radius:12px;padding:20px;margin:16px 0;">
      <table style="width:100%;font-size:13px;color:${TEXT};" cellpadding="0" cellspacing="0">
        <tr><td style="padding:4px 0;color:${MUTED};">Property</td><td style="padding:4px 0;text-align:right;font-weight:600;">${propertyName}</td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">Amount</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#16A34A;">$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>
        <tr><td style="padding:4px 0;color:${MUTED};">Type</td><td style="padding:4px 0;text-align:right;text-transform:capitalize;">${typeLabel}</td></tr>
        ${period ? `<tr><td style="padding:4px 0;color:${MUTED};">Period</td><td style="padding:4px 0;text-align:right;">${period}</td></tr>` : ""}
      </table>
    </div>
    ${portalUrl ? button("View in Investor Portal →", portalUrl) : ""}
    ${divider()}
    ${muted("This record is permanently logged on Hedera Consensus Service. Your investment manager will confirm when funds have been transferred.")}
  `);

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: `💰 $${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} — ${propertyName}${period ? ` (${period})` : ""}`,
    html,
  });
}

export { getResend as resend };
