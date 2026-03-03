/**
 * DeedSlice Hedera Engine
 * 
 * Wraps Hedera SDK operations for property tokenization.
 * Based on dappily-agent-kit patterns but tailored for DeedSlice:
 *   1. Create NFT collection (master deed)
 *   2. Mint NFT with property metadata
 *   3. Create fungible share tokens
 *   4. Create HCS audit topic
 *   5. Log initial audit entry
 * 
 * All operations run server-side. Private keys never touch the client.
 */

import {
  Client,
  AccountId,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  Status,
  Hbar,
} from "@hashgraph/sdk";

import {
  HEDERA_NETWORK,
  formatTxUrlSafe,
  getTokenUrl,
  getTopicUrl,
} from "./config";

// ── Config ──────────────────────────────────────────────────
// Default (global) network from env — used for the sidebar label etc.
const NETWORK = HEDERA_NETWORK;

// Mainnet credentials
const MAINNET_OPERATOR_ID = process.env.HEDERA_OPERATOR_ID!;
const MAINNET_OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY!;

// Testnet credentials (sandbox)
const TESTNET_OPERATOR_ID = process.env.HEDERA_TESTNET_OPERATOR_ID || process.env.HEDERA_OPERATOR_ID!;
const TESTNET_OPERATOR_KEY = process.env.HEDERA_TESTNET_OPERATOR_KEY || process.env.HEDERA_OPERATOR_KEY!;

/**
 * Get a Hedera client for a specific network.
 * Defaults to the global HEDERA_NETWORK env if no override is provided.
 */
function getClient(network?: "mainnet" | "testnet"): Client {
  const net = network || NETWORK;
  const operatorId = net === "mainnet" ? MAINNET_OPERATOR_ID : TESTNET_OPERATOR_ID;
  const operatorKey = net === "mainnet" ? MAINNET_OPERATOR_KEY : TESTNET_OPERATOR_KEY;

  const client = net === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  client.setDefaultMaxTransactionFee(new Hbar(10));
  return client;
}

/** Get the operator key for a given network */
function getOperatorKey(network?: "mainnet" | "testnet"): PrivateKey {
  const net = network || NETWORK;
  const key = net === "mainnet" ? MAINNET_OPERATOR_KEY : TESTNET_OPERATOR_KEY;
  return PrivateKey.fromString(key);
}

/** Get the operator account ID for a given network */
function getOperatorId(network?: "mainnet" | "testnet"): AccountId {
  const net = network || NETWORK;
  const id = net === "mainnet" ? MAINNET_OPERATOR_ID : TESTNET_OPERATOR_ID;
  return AccountId.fromString(id);
}

/** @deprecated Use formatTxUrlSafe from config.ts instead */
function getExplorerUrl(txId: string): string {
  return formatTxUrlSafe(txId);
}

// ── Types ───────────────────────────────────────────────────
export interface PropertyTokenInput {
  name: string;
  address: string;
  propertyType: string;
  valuationUsd: number;
  totalSlices: number;
  description?: string;
  network?: "mainnet" | "testnet";
}

export interface TokenizationResult {
  ok: boolean;
  nftTokenId?: string;
  nftSerial?: number;
  shareTokenId?: string;
  shareTokenSymbol?: string;
  auditTopicId?: string;
  transactions: {
    step: string;
    txId: string;
    explorerUrl: string;
  }[];
  error?: string;
}

// ── Helper: generate token symbol from property name ────────
function generateSymbol(name: string): string {
  // "2960 Boxelder Drive" → "DS-2960"
  // "Sunset Apartments" → "DS-SNST"
  const numbers = name.match(/\d+/);
  if (numbers) return `DS-${numbers[0]}`;
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
  return `DS-${letters}`;
}

// ── Main Tokenization Pipeline ──────────────────────────────
export async function tokenizeProperty(input: PropertyTokenInput): Promise<TokenizationResult> {
  const net = input.network || NETWORK;
  const client = getClient(net);
  const operatorKey = getOperatorKey(net);
  const operatorId = getOperatorId(net);
  const transactions: TokenizationResult["transactions"] = [];
  const symbol = generateSymbol(input.name);

  try {
    // ── Step 1: Create NFT Collection (Master Deed) ──────
    const nftTx = new TokenCreateTransaction()
      .setTokenName(`${input.name} — Deed`)
      .setTokenSymbol(`${symbol}-DEED`)
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(1) // One deed per property
      .setTreasuryAccountId(operatorId)
      .setAdminKey(operatorKey.publicKey)
      .setSupplyKey(operatorKey.publicKey)
      .setTokenMemo(`DeedSlice Master Deed: ${input.name}`);

    const nftResponse = await nftTx.execute(client as any);
    const nftReceipt = await nftResponse.getReceipt(client as any);

    if (nftReceipt.status !== Status.Success || !nftReceipt.tokenId) {
      return { ok: false, error: `NFT creation failed: ${nftReceipt.status}`, transactions };
    }

    const nftTokenId = nftReceipt.tokenId.toString();
    const nftTxId = nftResponse.transactionId.toString();
    transactions.push({ step: "Create NFT Deed Collection", txId: nftTxId, explorerUrl: getExplorerUrl(nftTxId) });

    // ── Step 2: Mint the Master Deed NFT ─────────────────
    const metadata = JSON.stringify({
      name: input.name,
      address: input.address,
      type: input.propertyType,
      valuation: input.valuationUsd,
      slices: input.totalSlices,
      tokenizedBy: "DeedSlice",
      timestamp: new Date().toISOString(),
    });

    // Metadata must be ≤100 bytes for HTS. If longer, use a hash.
    const metaBytes = Buffer.from(metadata);
    const mintMeta = metaBytes.length <= 100
      ? metaBytes
      : Buffer.from(`ds:${Buffer.from(metadata).toString("base64").slice(0, 90)}`);

    const mintTx = new TokenMintTransaction()
      .setTokenId(nftTokenId)
      .setMetadata([mintMeta]);

    const mintResponse = await mintTx.execute(client as any);
    const mintReceipt = await mintResponse.getReceipt(client as any);

    if (mintReceipt.status !== Status.Success) {
      return { ok: false, error: `NFT mint failed: ${mintReceipt.status}`, transactions };
    }

    const nftSerial = Number(mintReceipt.serials[0]?.toString() || "1");
    const mintTxId = mintResponse.transactionId.toString();
    transactions.push({ step: "Mint Master Deed NFT", txId: mintTxId, explorerUrl: getExplorerUrl(mintTxId) });

    // ── Step 3: Create Fungible Share Tokens ─────────────
    const shareTx = new TokenCreateTransaction()
      .setTokenName(`${input.name} — Slices`)
      .setTokenSymbol(symbol)
      .setTokenType(TokenType.FungibleCommon)
      .setDecimals(0) // Whole slices
      .setInitialSupply(input.totalSlices)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(input.totalSlices)
      .setTreasuryAccountId(operatorId)
      .setAdminKey(operatorKey.publicKey)
      .setSupplyKey(operatorKey.publicKey)
      .setTokenMemo(`DeedSlice Shares: ${input.name} | ${input.totalSlices} slices @ $${Math.round(input.valuationUsd / input.totalSlices)}/slice`);

    const shareResponse = await shareTx.execute(client as any);
    const shareReceipt = await shareResponse.getReceipt(client as any);

    if (shareReceipt.status !== Status.Success || !shareReceipt.tokenId) {
      return { ok: false, error: `Share token creation failed: ${shareReceipt.status}`, transactions };
    }

    const shareTokenId = shareReceipt.tokenId.toString();
    const shareTxId = shareResponse.transactionId.toString();
    transactions.push({ step: "Create Share Tokens", txId: shareTxId, explorerUrl: getExplorerUrl(shareTxId) });

    // ── Step 4: Create HCS Audit Topic ───────────────────
    const topicTx = new TopicCreateTransaction()
      .setAdminKey(operatorKey.publicKey)
      .setSubmitKey(operatorKey.publicKey) // Only DeedSlice can write audit entries
      .setTopicMemo(`DeedSlice Audit: ${input.name}`);

    const topicResponse = await topicTx.execute(client as any);
    const topicReceipt = await topicResponse.getReceipt(client as any);

    if (topicReceipt.status !== Status.Success || !topicReceipt.topicId) {
      return { ok: false, error: `Audit topic creation failed: ${topicReceipt.status}`, transactions };
    }

    const auditTopicId = topicReceipt.topicId.toString();
    const topicTxId = topicResponse.transactionId.toString();
    transactions.push({ step: "Create Audit Trail", txId: topicTxId, explorerUrl: getExplorerUrl(topicTxId) });

    // ── Step 5: Log initial audit entry ──────────────────
    const auditMsg = JSON.stringify({
      action: "PROPERTY_TOKENIZED",
      property: input.name,
      address: input.address,
      valuation: input.valuationUsd,
      slices: input.totalSlices,
      nftDeed: nftTokenId,
      shareToken: shareTokenId,
      timestamp: new Date().toISOString(),
    });

    const msgTx = new TopicMessageSubmitTransaction()
      .setTopicId(auditTopicId)
      .setMessage(auditMsg);

    const frozenMsg = await msgTx.freezeWith(client as any);
    const msgResponse = await frozenMsg.execute(client as any);
    const msgReceipt = await msgResponse.getReceipt(client as any);

    if (msgReceipt.status === Status.Success) {
      const msgTxId = msgResponse.transactionId.toString();
      transactions.push({ step: "Log Initial Audit Entry", txId: msgTxId, explorerUrl: getExplorerUrl(msgTxId) });
    }

    return {
      ok: true,
      nftTokenId,
      nftSerial,
      shareTokenId,
      shareTokenSymbol: symbol,
      auditTopicId,
      transactions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, transactions };
  }
}

// ── Audit Logger ────────────────────────────────────────────
export async function logAuditEntry(topicId: string, action: string, details: Record<string, any>, network?: "mainnet" | "testnet"): Promise<{ ok: boolean; txId?: string; sequence?: string; error?: string }> {
  const client = getClient(network);

  try {
    const msg = JSON.stringify({
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });

    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(msg);

    const frozen = await tx.freezeWith(client as any);
    const response = await frozen.execute(client as any);
    const receipt = await response.getReceipt(client as any);

    if (receipt.status !== Status.Success) {
      return { ok: false, error: receipt.status.toString() };
    }

    return {
      ok: true,
      txId: response.transactionId.toString(),
      sequence: receipt.topicSequenceNumber?.toString(),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export { getExplorerUrl, getTokenUrl, getTopicUrl, NETWORK, formatTxUrlSafe };
