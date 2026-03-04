/**
 * Input sanitization utilities for DeedSlice.
 *
 * Hedera HTS token names/symbols have constraints:
 *   - Token name: max 100 chars
 *   - Token symbol: max 100 chars
 *   - Topic memo: max 100 bytes
 *
 * We also strip dangerous characters to prevent injection in
 * HashScan URLs, emails, and database queries.
 */

/**
 * Sanitize a string for use in Hedera token names/memos.
 * Strips control characters, null bytes, and excessive whitespace.
 * Truncates to maxLen.
 */
export function sanitizeHederaString(input: string, maxLen: number = 100): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, "") // strip control characters
    .replace(/\s+/g, " ")            // collapse whitespace
    .trim()
    .slice(0, maxLen);
}

/**
 * Sanitize a property name for display and Hedera token creation.
 * Allows alphanumeric, spaces, hyphens, apostrophes, periods, commas, and #.
 */
export function sanitizePropertyName(input: string): string {
  return input
    .replace(/[^\w\s\-'.,#&()]/g, "") // keep safe chars only
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Sanitize an address string.
 * Allows standard address characters.
 */
export function sanitizeAddress(input: string): string {
  return input
    .replace(/[^\w\s\-'.,#&()/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/**
 * Sanitize a general text field (descriptions, notes, etc.)
 * Strips control chars but allows most printable content.
 */
export function sanitizeText(input: string, maxLen: number = 2000): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // strip control chars (keep \n, \r, \t)
    .trim()
    .slice(0, maxLen);
}

/**
 * Sanitize a Hedera account ID.
 * Must match 0.0.XXXXX format.
 */
export function sanitizeAccountId(input: string): string | null {
  const clean = input.trim();
  if (/^0\.0\.\d{1,10}$/.test(clean)) return clean;
  return null;
}

/**
 * Sanitize an email address (basic validation + lowercase).
 */
export function sanitizeEmail(input: string): string | null {
  const clean = input.trim().toLowerCase();
  // Basic email regex — not exhaustive but catches obvious garbage
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) && clean.length <= 320) return clean;
  return null;
}

/**
 * Sanitize a number input (string → validated number or null).
 */
export function sanitizePositiveNumber(input: any): number | null {
  const n = Number(input);
  if (isNaN(n) || !isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Sanitize an integer input.
 */
export function sanitizePositiveInteger(input: any): number | null {
  const n = Number(input);
  if (isNaN(n) || !isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}
