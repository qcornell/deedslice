"use client";

/**
 * InvestorProtectionPanel — Trust signal component for property pages
 *
 * Shows compliance status badges that tell investors "this deal is legit."
 * Displayed on both the operator property detail page and the public view.
 *
 * Calculates a "Trust Score" based on enabled compliance features.
 */

interface Props {
  property: {
    share_token_id?: string | null;
    nft_token_id?: string | null;
    audit_topic_id?: string | null;
    offering_type?: string | null;
    requires_accreditation?: boolean;
    requires_kyc?: boolean;
    transfer_restricted?: boolean;
    issuer_certified?: boolean;
    network?: string;
  };
  compact?: boolean; // For inline use in cards
}

interface ProtectionItem {
  label: string;
  description: string;
  enabled: boolean;
  icon: string;
  points: number;
}

export default function InvestorProtectionPanel({ property, compact = false }: Props) {
  const items: ProtectionItem[] = [
    {
      label: "Ownership Secured on Hedera",
      description: "Property deed and ownership shares are recorded on the Hedera distributed ledger — immutable and verifiable by anyone.",
      enabled: !!(property.nft_token_id && property.share_token_id),
      icon: "🔗",
      points: 20,
    },
    {
      label: "Transfer Restricted Token",
      description: "Only approved and verified wallets can hold this token. Random wallets cannot receive shares without operator approval.",
      enabled: property.transfer_restricted !== false,
      icon: "🔒",
      points: 20,
    },
    {
      label: "KYC Required for Investors",
      description: "All investors must pass identity verification (KYC) before receiving tokens. On-chain KYC enforcement via Hedera Token Service.",
      enabled: property.requires_kyc !== false,
      icon: "🛡️",
      points: 20,
    },
    {
      label: "Accredited Investors Only",
      description: "This offering requires investors to be accredited as defined by the SEC. Accreditation status is verified before any token transfer.",
      enabled: property.requires_accreditation === true,
      icon: "✅",
      points: 15,
    },
    {
      label: "Immutable Audit Trail",
      description: "Every action — tokenization, transfers, KYC approvals, distributions — is permanently recorded on Hedera Consensus Service.",
      enabled: !!property.audit_topic_id,
      icon: "📋",
      points: 15,
    },
    {
      label: "Issuer Certified",
      description: "The property operator has certified their compliance responsibilities including securities law obligations and Form D filing.",
      enabled: property.issuer_certified === true,
      icon: "📜",
      points: 10,
    },
  ];

  const totalPoints = items.reduce((sum, item) => sum + item.points, 0);
  const earnedPoints = items.filter(i => i.enabled).reduce((sum, item) => sum + item.points, 0);
  const trustScore = Math.round((earnedPoints / totalPoints) * 100);

  const scoreColor = trustScore >= 80 ? "#16A34A"
    : trustScore >= 60 ? "#D97706"
    : "#DC2626";

  const scoreBg = trustScore >= 80 ? "rgba(22,163,74,0.08)"
    : trustScore >= 60 ? "rgba(217,119,6,0.08)"
    : "rgba(220,38,38,0.08)";

  if (compact) {
    // Compact mode: just the score + enabled count
    const enabledCount = items.filter(i => i.enabled).length;
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-semibold"
          style={{ background: scoreBg, color: scoreColor }}
        >
          🛡️ {trustScore}/100
        </div>
        <span className="text-[11px]" style={{ color: "#8792A2" }}>
          {enabledCount}/{items.length} protections
        </span>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      {/* Header with Trust Score */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[16px] font-semibold flex items-center gap-2" style={{ color: "#1A1F36" }}>
            🛡️ Investor Protection
          </h3>
          <p className="text-[13px] mt-1" style={{ color: "#697386" }}>
            Compliance controls protecting this offering
          </p>
        </div>

        {/* Trust Score Badge */}
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center border-[3px]"
            style={{ borderColor: scoreColor, background: scoreBg }}
          >
            <span className="text-[20px] font-bold" style={{ color: scoreColor }}>
              {trustScore}
            </span>
          </div>
          <div className="text-[10px] font-medium mt-1" style={{ color: "#8792A2" }}>
            Trust Score
          </div>
        </div>
      </div>

      {/* Protection Items */}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 py-2.5"
            style={{
              borderTop: i > 0 ? "1px solid #E3E8EF" : undefined,
              opacity: item.enabled ? 1 : 0.45,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[16px]"
              style={{
                background: item.enabled ? "rgba(13,148,136,0.08)" : "rgba(135,146,162,0.08)",
              }}
            >
              {item.enabled ? item.icon : "○"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[14px] font-medium"
                  style={{ color: item.enabled ? "#1A1F36" : "#8792A2" }}
                >
                  {item.enabled ? "✓" : "—"} {item.label}
                </span>
              </div>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#8792A2" }}>
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Network Badge */}
      {property.network && (
        <div className="mt-4 pt-3 border-t flex items-center gap-2 text-[12px]" style={{ borderColor: "#E3E8EF", color: "#8792A2" }}>
          <span className={`w-1.5 h-1.5 rounded-full ${property.network === "mainnet" ? "bg-[#0ACF83]" : "bg-yellow-400"}`} />
          {property.network === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet"}
          {property.offering_type && property.offering_type !== "test" && (
            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: "#F0F5FF", color: "#3B82F6" }}>
              {property.offering_type.toUpperCase()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
