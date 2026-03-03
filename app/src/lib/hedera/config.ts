/**
 * Single source of truth for Hedera network configuration.
 *
 * Server-side: reads from process.env.HEDERA_NETWORK
 * Client-side: reads from NEXT_PUBLIC_HEDERA_NETWORK
 *
 * Both env vars should be set to "mainnet" or "testnet" in .env.local.
 */

export const HEDERA_NETWORK: "mainnet" | "testnet" =
  (process.env.NEXT_PUBLIC_HEDERA_NETWORK || process.env.HEDERA_NETWORK || "testnet") as "mainnet" | "testnet";

/** HashScan base URL for the current network */
export const HASHSCAN_BASE = `https://hashscan.io/${HEDERA_NETWORK}`;

/** Build a HashScan transaction URL from a raw transaction ID string */
export function getExplorerUrl(txId: string): string {
  // Hedera tx IDs look like "0.0.12345@1234567890.123456789"
  // HashScan wants: 0.0.12345-1234567890-123456789
  const formatted = txId.replace(/@/g, "-").replace(/\./g, "-");
  return `${HASHSCAN_BASE}/transaction/${formatted}`;
}

/** Build a HashScan token URL */
export function getTokenUrl(tokenId: string): string {
  return `${HASHSCAN_BASE}/token/${tokenId}`;
}

/** Build a HashScan topic URL */
export function getTopicUrl(topicId: string): string {
  return `${HASHSCAN_BASE}/topic/${topicId}`;
}

/**
 * Build a correct HashScan transaction URL from a raw tx ID.
 *
 * Hedera transaction IDs have the format: "0.0.XXXXXX@seconds.nanos"
 * HashScan expects: 0.0.XXXXXX-seconds-nanos
 *
 * The account ID dots MUST be preserved. Only the @ and the dot
 * between seconds/nanos are replaced with hyphens.
 */
export function formatTxUrlSafe(txId: string): string {
  // "0.0.10206295@1772512778.856517976" → "0.0.10206295-1772512778-856517976"
  const atSplit = txId.split("@");
  if (atSplit.length === 2) {
    const accountId = atSplit[0]; // "0.0.10206295" — keep dots
    const timestamp = atSplit[1].replace(".", "-"); // "1772512778.856517976" → "1772512778-856517976"
    return `${HASHSCAN_BASE}/transaction/${accountId}-${timestamp}`;
  }
  // Fallback: already formatted or unknown format
  return `${HASHSCAN_BASE}/transaction/${txId}`;
}
