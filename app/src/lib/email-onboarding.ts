import { Resend } from "resend";

let _resend: Resend | null = null;
export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY not set");
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = () => process.env.EMAIL_FROM || "DeedSlice <noreply@deedslice.com>";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";

const BRAND = "#0D9488";
const BG = "#F8FAFB";
const CARD = "#FFFFFF";
const MUTED = "#94A3B8";
const TEXT = "#0F172A";

function layout(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:20px;font-weight:700;color:${TEXT};letter-spacing:-0.5px;">🏠 DeedSlice</span>
    </div>
    <div style="background:${CARD};border-radius:16px;padding:36px 32px;border:1px solid #E2E8F0;">
      ${body}
    </div>
    <div style="text-align:center;margin-top:32px;color:${MUTED};font-size:11px;line-height:1.6;">
      <p style="margin:0;">DeedSlice — Real estate tokenization on Hedera</p>
      <p style="margin:4px 0 0;"><a href="https://deedslice.com" style="color:${BRAND};text-decoration:none;">deedslice.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

function btn(text: string, href: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">${text}</a>
  </div>`;
}

/**
 * Day 2 — "Here's what you can build"
 * Sent to users who signed up 2 days ago but haven't tokenized yet.
 */
export async function sendDay2Email(to: string, name?: string | null) {
  const greeting = name ? `Hey ${name}` : "Hey there";

  const html = layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${TEXT};">Your Sandbox is ready 🧪</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${TEXT};">
      ${greeting} — just a heads up that your DeedSlice Sandbox is set up and waiting.
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${TEXT};">
      In about <strong>10 seconds</strong>, you can:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:2.2;color:${TEXT};">
      <li>Mint an <strong>NFT property deed</strong> on Hedera testnet</li>
      <li>Issue <strong>fractional share tokens</strong> to investors</li>
      <li>Create a tamper-proof <strong>HCS audit trail</strong></li>
      <li>Share a read-only <strong>investor dashboard</strong></li>
    </ul>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${TEXT};">
      No credit card, no gas fees, no configuration. Just click and go.
    </p>
    ${btn("Try It — Tokenize a Property →", `${APP_URL()}/dashboard/new`)}
    <div style="border-top:1px solid #E2E8F0;margin:24px 0;"></div>
    <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
      <strong>Pro tip:</strong> Click "Explore with Demo Data" on your dashboard to see a fully populated example with investors, distributions, and audit history.
    </p>
  `);

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: "Your sandbox is ready — tokenize a property in 10 seconds 🏠",
    html,
  });
}

/**
 * Day 5 — "Ready for the real thing?"
 * Sent to Sandbox users after 5 days.
 */
export async function sendDay5Email(to: string, name?: string | null, hasTokenized?: boolean) {
  const greeting = name ? `Hi ${name}` : "Hi there";

  const html = layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${TEXT};">Ready for mainnet? 🚀</h1>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${TEXT};">
      ${greeting} — ${hasTokenized
        ? "you've already tokenized a property on testnet. Nice! That same process works on <strong>Hedera mainnet</strong> — real tokens, real blockchain, real value."
        : "you've had your DeedSlice Sandbox for 5 days now. Ready to see what the full platform can do?"
      }
    </p>
    <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:${TEXT};">
      Operator Plan — $299/mo:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:2.2;color:${TEXT};">
      <li><strong>Mainnet deployment</strong> — real Hedera tokens</li>
      <li><strong>Investor management</strong> — KYC, wallet addresses, transfers</li>
      <li><strong>Document vault</strong> — SHA-256 hashed to blockchain</li>
      <li><strong>Distribution tracking</strong> — record and notify investors</li>
      <li>Tokenization credits: <strong>$1,499/property</strong></li>
    </ul>
    <div style="background:#F0FDF4;border-radius:12px;padding:16px 20px;margin:16px 0;border:1px solid #BBF7D0;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#166534;">
        <strong>💡 Compare:</strong> Blocksquare charges <strong>$40,900</strong> for a one-time license + $69/mo per property. 
        DeedSlice gives you the same capabilities for <strong>$299/mo</strong>. Same white-label. Your brand.
      </p>
    </div>
    ${btn("Upgrade to Operator →", `${APP_URL()}/dashboard/settings`)}
    <div style="border-top:1px solid #E2E8F0;margin:24px 0;"></div>
    <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
      Managing 10+ properties? Ask about our <strong>Enterprise</strong> plan — unlimited tokenization, white-label portal, and REST API. 
      <a href="mailto:info@deedslice.com?subject=Enterprise%20Inquiry" style="color:${BRAND};text-decoration:none;">Talk to us →</a>
    </p>
  `);

  return getResend().emails.send({
    from: FROM(),
    to,
    subject: hasTokenized
      ? "Your testnet property worked — ready for mainnet? 🚀"
      : "Blocksquare charges $40,900. We charge $299/mo.",
    html,
  });
}
