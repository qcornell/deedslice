"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import dynamic from "next/dynamic";
import InvestorUpdate from "@/components/InvestorUpdate";

const ImageUpload = dynamic(() => import("@/components/ImageUpload"));
const DocumentVault = dynamic(() => import("@/components/DocumentVault"));
const DistributionManager = dynamic(() => import("@/components/DistributionManager"));
const InvestorProtectionPanel = dynamic(() => import("@/components/InvestorProtectionPanel"));
const IssuerCertificationModal = dynamic(() => import("@/components/IssuerCertificationModal"));
import { useParams } from "next/navigation";
import Link from "next/link";
import { HASHSCAN_BASE } from "@/lib/hedera/config";
import type { Property, Investor, AuditEntry, Document } from "@/types/database";

import { formatTxUrlSafe, getTokenUrl, getTopicUrl } from "@/lib/hedera/config";

function formatHashScanTx(txId: string, network: string) {
  const base = `https://hashscan.io/${network}`;
  const atSplit = txId.split("@");
  if (atSplit.length === 2) {
    const accountId = atSplit[0];
    const timestamp = atSplit[1].replace(".", "-");
    return `${base}/transaction/${accountId}-${timestamp}`;
  }
  return `${base}/transaction/${txId}`;
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Transfer state
  const [transferring, setTransferring] = useState<string | null>(null);
  const [transferMsg, setTransferMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Compliance state
  const [showCertModal, setShowCertModal] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editValuation, setEditValuation] = useState("");
  const [editType, setEditType] = useState("");
  const [editFilingDueDate, setEditFilingDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (!session || !id) return;
    // Load property + investors + audit
    fetch(`/api/properties/${id}`, { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        setProperty(d.property);
        setInvestors(d.investors || []);
        setAuditEntries(d.auditEntries || []);
      })
      .finally(() => setLoading(false));
    // Load documents
    fetch(`/api/documents?propertyId=${id}`, { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setDocuments(d.documents || []))
      .catch(() => {});
  }, [session, id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Property not found</h2>
        <Link href="/dashboard" className="text-ds-accent-text hover:underline text-sm">
          ← Back to properties
        </Link>
      </div>
    );
  }

  const pricePerSlice = Math.round(property.valuation_usd / property.total_slices);

  // Ownership pie colors
  const pieColors = ["#6c5ce7", "#e17055", "#00b894", "#fdcb6e", "#74b9ff", "#a29bfe", "#ff7675", "#55efc4"];

  function startEditing() {
    setEditName(property!.name);
    setEditAddress(property!.address || "");
    setEditDescription(property!.description || "");
    setEditValuation(String(property!.valuation_usd));
    setEditType(property!.property_type);
    setEditFilingDueDate(property!.filing_due_date || "");
    setEditing(true);
    setSaveMsg("");
  }

  async function handleSave() {
    if (!session || !property) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`/api/properties/${id}/update`, {
        method: "PATCH",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          name: editName,
          address: editAddress,
          description: editDescription,
          valuation_usd: Number(editValuation),
          property_type: editType,
          filing_due_date: editFilingDueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local state
      setProperty((p) => p ? {
        ...p,
        name: editName,
        address: editAddress || null,
        description: editDescription || null,
        valuation_usd: Number(editValuation),
        property_type: editType as any,
        filing_due_date: editFilingDueDate || null,
      } : p);
      setEditing(false);
      setSaveMsg(data.changes || "Saved");

      // Refresh audit entries
      const refreshRes = await fetch(`/api/properties/${id}`, { headers: getAuthHeaders(session) });
      const refreshData = await refreshRes.json();
      setAuditEntries(refreshData.auditEntries || []);
    } catch (err: any) {
      setSaveMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Back link */}
      <Link href="/dashboard" className="text-ds-muted hover:text-ds-text text-sm mb-6 inline-block">
        ← All Properties
      </Link>

      {/* Property Image */}
      {property.image_url ? (
        <div className="rounded-2xl overflow-hidden mb-6 h-56 relative group">
          <img src={property.image_url} alt={property.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      ) : (
        <div className="mb-6">
          <ImageUpload
            session={session}
            propertyId={id}
            currentUrl={null}
            onUploaded={(url) => setProperty((p) => p ? { ...p, image_url: url } : p)}
          />
        </div>
      )}

      {/* Header — view or edit mode */}
      {editing ? (
        <div className="glass rounded-2xl p-6 mb-8 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Edit Property</h2>
            <button onClick={() => setEditing(false)} className="text-ds-muted hover:text-ds-text text-sm">Cancel</button>
          </div>
          <div>
            <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Name</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition" />
          </div>
          <div>
            <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Address</label>
            <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)}
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Property Type</label>
              <select value={editType} onChange={(e) => setEditType(e.target.value)}
                className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition">
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="land">Land</option>
                <option value="industrial">Industrial</option>
                <option value="mixed">Mixed Use</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Valuation (USD)</label>
              <input type="number" value={editValuation} onChange={(e) => setEditValuation(e.target.value)}
                className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Description</label>
            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2}
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition resize-none" />
          </div>
          <div>
            <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Filing Due Date (optional)</label>
            <input type="date" value={editFilingDueDate} onChange={(e) => setEditFilingDueDate(e.target.value)}
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition" />
            <p className="text-[10px] text-ds-muted mt-1">Compliance filing deadline — you&apos;ll see a reminder in Action Items</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="text-white font-semibold px-6 py-2.5 rounded-[10px] text-[13px] transition-all disabled:opacity-50 hover:translate-y-[-1px]"
              style={{ background: "#0ab4aa", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <span className="text-xs text-ds-muted">Changes are logged to the HCS audit trail</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold heading-tight">{property.name}</h1>
              <button onClick={startEditing} className="text-ds-muted hover:text-ds-accent-text text-xs border border-ds-border hover:border-ds-accent/30 px-2.5 py-1 rounded-lg transition">
                ✏️ Edit
              </button>
            </div>
            {property.address && <p className="text-ds-muted text-sm mt-0.5">{property.address}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                property.status === "live"
                  ? "bg-ds-green/15 text-ds-green border-ds-green/30"
                  : "bg-ds-muted/15 text-ds-muted border-ds-muted/30"
              }`}>
                {property.status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-ds-green pulse-green" />}
                {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
              </span>
              <span className="text-xs text-ds-muted">
                {property.network === "mainnet" ? "Mainnet" : "Testnet"}
              </span>
              <span className="text-xs text-ds-muted capitalize">
                · {property.property_type}
              </span>
            </div>
            {property.filing_due_date && (
              <p className="text-xs text-ds-muted mt-1.5">
                📅 Filing due: {new Date(property.filing_due_date).toLocaleDateString()}
              </p>
            )}
            {saveMsg && (
              <p className={`text-xs mt-2 ${saveMsg.startsWith("Error") ? "text-ds-red" : "text-ds-green"}`}>
                ✓ {saveMsg}
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <div className="text-2xl sm:text-3xl font-bold">${property.valuation_usd.toLocaleString()}</div>
            <div className="text-xs text-ds-muted mt-1">${pricePerSlice}/slice · {property.total_slices.toLocaleString()} slices</div>
            <div className="mt-3">
              <InvestorUpdate session={session} propertyId={id} propertyName={property.name} />
            </div>
          </div>
        </div>
      )}

      {/* Investor Protection Panel */}
      <div className="mb-8">
        <InvestorProtectionPanel property={property as any} />
      </div>

      {/* Compliance Certification Banner */}
      {property.status === "live" && !(property as any).issuer_certified && (
        <div
          className="rounded-xl p-4 mb-8 flex items-center justify-between"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[20px]">⚠️</span>
            <div>
              <div className="text-[14px] font-semibold" style={{ color: "#DC2626" }}>
                Compliance Certification Required
              </div>
              <p className="text-[12px]" style={{ color: "#92400E" }}>
                You must certify your compliance responsibilities before transferring tokens to investors.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCertModal(true)}
            className="text-white font-medium px-4 py-2 rounded-lg text-[13px] transition-all hover:shadow-md flex-shrink-0"
            style={{ background: "#DC2626" }}
          >
            Certify Now
          </button>
        </div>
      )}

      {/* Certification Modal */}
      {showCertModal && session && (
        <IssuerCertificationModal
          propertyId={id}
          propertyName={property.name}
          session={session}
          onCertified={(result) => {
            setShowCertModal(false);
            setProperty((p) => p ? {
              ...p,
              offering_type: result.offeringType as any,
              requires_accreditation: result.requiresAccreditation,
              requires_kyc: result.requiresKyc,
              issuer_certified: true,
              issuer_certified_at: new Date().toISOString(),
            } as any : p);
            // Refresh audit entries
            fetch(`/api/properties/${id}`, { headers: getAuthHeaders(session) })
              .then((r) => r.json())
              .then((d) => setAuditEntries(d.auditEntries || []));
          }}
          onCancel={() => setShowCertModal(false)}
        />
      )}

      {/* On-chain Assets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* NFT Deed */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm text-ds-muted mb-3">
            <span>📜</span> NFT Master Deed
          </div>
          {property.nft_token_id ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Token ID</span>
                <a
                  href={getTokenUrl(property.nft_token_id, property.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-ds-accent-text hover:underline text-xs"
                >
                  {property.nft_token_id}
                </a>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Serial</span>
                <span className="font-mono text-xs">#{property.nft_serial}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-ds-green">
                <span>✓</span> Minted
              </div>
            </div>
          ) : (
            <span className="text-xs text-ds-muted">Not deployed</span>
          )}
        </div>

        {/* Share Token */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm text-ds-muted mb-3">
            <span>🪙</span> Share Tokens
          </div>
          {property.share_token_id ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Token ID</span>
                <a
                  href={getTokenUrl(property.share_token_id, property.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-ds-accent-text hover:underline text-xs"
                >
                  {property.share_token_id}
                </a>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Symbol</span>
                <span className="font-mono text-xs">{property.share_token_symbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Supply</span>
                <span className="font-mono text-xs">{property.total_slices.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-ds-muted">Not deployed</span>
          )}
        </div>

        {/* Audit Trail */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm text-ds-muted mb-3">
            <span>📋</span> Audit Trail
          </div>
          {property.audit_topic_id ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Topic ID</span>
                <a
                  href={getTopicUrl(property.audit_topic_id, property.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-ds-accent-text hover:underline text-xs"
                >
                  {property.audit_topic_id}
                </a>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Entries</span>
                <span className="font-mono text-xs">{auditEntries.length}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-ds-green">
                <span>✓</span> Active
              </div>
            </div>
          ) : (
            <span className="text-xs text-ds-muted">Not deployed</span>
          )}
        </div>
      </div>

      {/* Two-column: Investors + Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ownership / Investors */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Ownership</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ds-muted">{investors.length} investor{investors.length !== 1 ? "s" : ""}</span>
              {investors.some(i => i.transfer_status === "transferred") && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-ds-green/15 text-ds-green border border-ds-green/30">
                  {investors.filter(i => i.transfer_status === "transferred").length} on-chain
                </span>
              )}
            </div>
          </div>

          {/* Transfer messages */}
          {transferMsg && (
            <div className={`rounded-lg px-4 py-2 text-sm mb-4 ${
              transferMsg.type === "success"
                ? "bg-ds-green/10 border border-ds-green/30 text-ds-green"
                : "bg-ds-red/10 border border-ds-red/30 text-ds-red"
            }`}>
              {transferMsg.text}
            </div>
          )}

          {/* Simple bar chart */}
          <div className="space-y-3 mb-5">
            {investors.map((inv, i) => (
              <div key={inv.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pieColors[i % pieColors.length] }}
                    />
                    <span>{inv.name}</span>
                    {inv.transfer_status === "transferred" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-ds-green/15 text-ds-green border border-ds-green/30">
                        ✓ On-chain
                      </span>
                    )}
                    {inv.transfer_status === "failed" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-ds-red/15 text-ds-red border border-ds-red/30">
                        ✗ Failed
                      </span>
                    )}
                  </div>
                  <span className="text-ds-muted text-xs">
                    {inv.slices_owned.toLocaleString()} slices · {inv.percentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-ds-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${inv.percentage}%`,
                      backgroundColor: pieColors[i % pieColors.length],
                    }}
                  />
                </div>
                {/* Wallet + transfer action */}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-ds-muted font-mono">
                    {inv.wallet_address || "No wallet set"}
                  </span>
                  {inv.wallet_address && inv.transfer_status !== "transferred" && property.share_token_id && (
                    <button
                      onClick={async () => {
                        if (!session) return;
                        setTransferring(inv.id);
                        setTransferMsg(null);
                        try {
                          const res = await fetch("/api/investors/transfer", {
                            method: "POST",
                            headers: getAuthHeaders(session),
                            body: JSON.stringify({ investorId: inv.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          setTransferMsg({ type: "success", text: `Transferred ${inv.slices_owned} slices to ${inv.name}!` });
                          // Refresh
                          const rr = await fetch(`/api/properties/${id}`, { headers: getAuthHeaders(session) });
                          const rd = await rr.json();
                          setInvestors(rd.investors || []);
                          setAuditEntries(rd.auditEntries || []);
                        } catch (err: any) {
                          setTransferMsg({ type: "error", text: err.message });
                        } finally {
                          setTransferring(null);
                        }
                      }}
                      disabled={transferring === inv.id}
                      className="text-[10px] text-white px-2 py-0.5 rounded font-medium transition-all disabled:opacity-50"
                      style={{ background: "#6c5ce7" }}
                    >
                      {transferring === inv.id ? "Sending..." : "🪙 Transfer"}
                    </button>
                  )}
                  {inv.transfer_status === "transferred" && inv.transfer_tx_id && (
                    <a
                      href={formatHashScanTx(inv.transfer_tx_id, property.network)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-ds-accent-text hover:underline"
                    >
                      View TX →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Value breakdown */}
          <div className="border-t border-ds-border pt-4 space-y-2 text-xs text-ds-muted">
            <div className="flex justify-between">
              <span>Total Valuation</span>
              <span className="text-ds-text">${property.valuation_usd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Price Per Slice</span>
              <span className="text-ds-text">${pricePerSlice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Slices</span>
              <span className="text-ds-text">{property.total_slices.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Transferred On-chain</span>
              <span className="text-ds-accent-text">
                {investors.filter(i => i.transfer_status === "transferred").reduce((s, i) => s + i.slices_owned, 0).toLocaleString()} / {property.total_slices.toLocaleString()} slices
              </span>
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Audit Trail</h2>
            <span className="text-xs text-ds-muted">
              Tamper-proof · Hedera Consensus Service
            </span>
          </div>

          {auditEntries.length === 0 ? (
            <p className="text-ds-muted text-sm">No audit entries yet.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="bg-ds-bg rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium">{entry.action}</div>
                      {entry.details && <p className="text-xs text-ds-muted mt-0.5">{entry.details}</p>}
                    </div>
                    <span className="text-[10px] text-ds-muted whitespace-nowrap ml-2">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {entry.hcs_sequence && (
                    <div className="text-[10px] text-ds-muted mt-1 font-mono">
                      HCS seq #{entry.hcs_sequence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Distributions */}
      <div className="mt-6">
        <DistributionManager
          session={session}
          property={property}
          investors={investors}
          onDistributionCreated={() => {
            // Refresh audit entries
            fetch(`/api/properties/${id}`, { headers: getAuthHeaders(session!) })
              .then((r) => r.json())
              .then((d) => setAuditEntries(d.auditEntries || []));
          }}
        />
      </div>

      {/* Document Vault */}
      <div className="mt-6">
        <DocumentVault
          session={session}
          propertyId={id}
          documents={documents}
          onDocumentAdded={(doc) => {
            setDocuments((prev) => [doc, ...prev]);
            // Refresh audit entries to show the new DOCUMENT_ADDED entry
            fetch(`/api/properties/${id}`, { headers: getAuthHeaders(session!) })
              .then((r) => r.json())
              .then((d) => setAuditEntries(d.auditEntries || []));
          }}
        />
      </div>

      {/* Shareable Investor Link */}
      <div className="mt-8 glass rounded-2xl p-6 glow-border">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔗</span>
          <div>
            <h2 className="font-semibold">Investor Dashboard Link</h2>
            <p className="text-xs text-ds-muted">Share a read-only view with your investors</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-xs sm:text-sm font-mono text-ds-muted truncate">
            {(process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com").replace(/^https?:\/\//, "")}/view/{id}
          </div>
          <button
            onClick={() => {
              try { navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com"}/view/${id}`); } catch {}
            }}
            className="px-4 py-2.5 text-white rounded-[10px] text-sm font-medium transition-all hover:translate-y-[-1px] shrink-0"
            style={{ background: "#0ab4aa", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
