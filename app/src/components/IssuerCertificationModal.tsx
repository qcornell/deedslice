"use client";

/**
 * IssuerCertificationModal — Compliance CYA Modal
 *
 * Operators MUST complete this before any token transfers can occur.
 * Stores an immutable record of what they agreed to + timestamp + IP.
 *
 * This is the legal shield that protects DeedSlice as an infrastructure provider.
 */

import { useState } from "react";

interface Props {
  propertyId: string;
  propertyName: string;
  session: any; // Supabase session
  onCertified?: (result: {
    offeringType: string;
    requiresAccreditation: boolean;
    requiresKyc: boolean;
  }) => void;
  onCancel?: () => void;
}

const OFFERING_TYPES = [
  {
    value: "506c",
    label: "Regulation D — Rule 506(c)",
    description: "Accredited investors only. General solicitation allowed. Strict verification required.",
    badge: "Most Common",
  },
  {
    value: "506b",
    label: "Regulation D — Rule 506(b)",
    description: "Accredited + up to 35 sophisticated non-accredited investors. No general solicitation.",
    badge: null,
  },
  {
    value: "regs",
    label: "Regulation S",
    description: "Non-US investors only. Offshore transactions with procedural safeguards.",
    badge: null,
  },
  {
    value: "private",
    label: "Private Placement (Other)",
    description: "Custom offering structure. Consult your legal counsel for applicable exemptions.",
    badge: null,
  },
  {
    value: "test",
    label: "Test / Demo",
    description: "No real securities. For demonstration and testing purposes only.",
    badge: "No Restrictions",
  },
];

const CHECKBOXES = [
  {
    id: "responsible_for_compliance",
    text: "I am solely responsible for verifying investor accreditation and ensuring securities compliance for this offering.",
  },
  {
    id: "securities_laws_apply",
    text: "I understand that tokenized fractional ownership interests may constitute securities under applicable federal and state law.",
  },
  {
    id: "will_file_form_d",
    text: "I will file Form D with the SEC within 15 days of the first sale, if required by my chosen exemption.",
  },
  {
    id: "not_broker_dealer",
    text: "I understand that DeedSlice is a technology infrastructure provider and does not act as a broker-dealer, transfer agent, or investment adviser.",
  },
  {
    id: "not_legal_advice",
    text: "I understand that DeedSlice does not provide legal, tax, or investment advice. I have consulted or will consult with qualified legal counsel.",
  },
];

export default function IssuerCertificationModal({
  propertyId,
  propertyName,
  session,
  onCertified,
  onCancel,
}: Props) {
  const [offeringType, setOfferingType] = useState<string>("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allChecked = CHECKBOXES.every(cb => checked.has(cb.id));
  const canSubmit = offeringType && allChecked && !loading;

  function toggleCheckbox(id: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCertify() {
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/properties/${propertyId}/certify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          offeringType,
          checkboxes: Array.from(checked),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onCertified?.({
        offeringType: data.offeringType,
        requiresAccreditation: data.requiresAccreditation,
        requiresKyc: data.requiresKyc,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: "#E3E8EF" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(220,38,38,0.08)" }}>
              <span className="text-[20px]">⚖️</span>
            </div>
            <div>
              <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>
                Issuer Compliance Certification
              </h2>
              <p className="text-[13px]" style={{ color: "#697386" }}>
                Required before transferring tokens for <strong>{propertyName}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Offering Type Selection */}
          <div>
            <label className="block text-[14px] font-semibold mb-3" style={{ color: "#1A1F36" }}>
              1. Select Offering Type
            </label>
            <div className="space-y-2">
              {OFFERING_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setOfferingType(type.value)}
                  className="w-full text-left px-4 py-3 rounded-lg border-2 transition-all"
                  style={{
                    borderColor: offeringType === type.value ? "#0D9488" : "#E3E8EF",
                    background: offeringType === type.value ? "rgba(13,148,136,0.04)" : "white",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium" style={{ color: "#1A1F36" }}>
                      {type.label}
                    </span>
                    {type.badge && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(13,148,136,0.08)", color: "#0D9488" }}
                      >
                        {type.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: "#8792A2" }}>
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Checkboxes */}
          <div>
            <label className="block text-[14px] font-semibold mb-3" style={{ color: "#1A1F36" }}>
              2. Certify Your Responsibilities
            </label>
            <div className="space-y-3">
              {CHECKBOXES.map(cb => (
                <label
                  key={cb.id}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(cb.id)}
                    onChange={() => toggleCheckbox(cb.id)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#0D9488] focus:ring-[#0D9488]"
                  />
                  <span
                    className="text-[13px] leading-relaxed"
                    style={{ color: checked.has(cb.id) ? "#1A1F36" : "#697386" }}
                  >
                    {cb.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Legal Notice */}
          <div
            className="rounded-lg p-4 text-[12px] leading-relaxed"
            style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid rgba(217,119,6,0.2)" }}
          >
            <strong>⚠️ Legal Notice:</strong> By certifying, you acknowledge that this record is permanent
            and may be used as evidence of your compliance representations. This certification is logged
            on-chain via Hedera Consensus Service and cannot be altered or deleted.
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg px-4 py-3 text-[13px]" style={{ background: "#FEF2F2", color: "#DC2626" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex items-center justify-between" style={{ borderColor: "#E3E8EF" }}>
          <button
            onClick={onCancel}
            className="text-[14px] font-medium px-4 py-2 rounded-lg"
            style={{ color: "#697386" }}
          >
            Cancel
          </button>
          <button
            onClick={handleCertify}
            disabled={!canSubmit}
            className="text-white font-medium px-6 py-2.5 rounded-lg text-[14px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: canSubmit ? "#0D9488" : "#94A3B8" }}
          >
            {loading ? "Certifying..." : "I Certify — Enable Transfers"}
          </button>
        </div>
      </div>
    </div>
  );
}
