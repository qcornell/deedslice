/**
 * Error sanitization — prevent leaking internal details to API consumers.
 *
 * Supabase errors, stack traces, and database column names should never
 * reach the client. This module provides safe error messages.
 */

/**
 * Sanitize an error for the client.
 * Returns a generic message unless it's a known safe error pattern.
 */
export function safeErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!err) return fallback;

  const msg = err instanceof Error ? err.message : String(err);

  // Known safe patterns — okay to show to the user
  const safePatterns = [
    /missing required/i,
    /not found/i,
    /unauthorized/i,
    /invalid token/i,
    /already exists/i,
    /limit reached/i,
    /plan (allows|limited|requires)/i,
    /must (be|have|associate)/i,
    /upgrade/i,
    /maximum \d+/i,
    /too many requests/i,
    /not associated/i,
    /wallet address/i,
    /account .* not found/i,
    /enterprise/i,
    /api key/i,
  ];

  for (const pattern of safePatterns) {
    if (pattern.test(msg)) return msg;
  }

  // Dangerous patterns — never expose these
  const dangerousPatterns = [
    /duplicate key value/i,
    /violates.*constraint/i,
    /relation ".*" does not exist/i,
    /column ".*"/i,
    /syntax error/i,
    /permission denied/i,
    /supabase/i,
    /postgres/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /at .*\.ts:\d+/i,     // stack traces
    /node_modules/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(msg)) {
      console.error("Suppressed unsafe error message:", msg);
      return fallback;
    }
  }

  // If it's short and doesn't look like a stack trace, allow it
  if (msg.length < 200 && !msg.includes("\n") && !msg.includes("Error:")) {
    return msg;
  }

  return fallback;
}
