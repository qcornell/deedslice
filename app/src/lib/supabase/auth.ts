import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Verify a user's JWT and return the user object.
 * Creates a temporary client scoped to the user's token.
 */
export async function getUserFromToken(token: string): Promise<{ user: User | null; error: string | null }> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { user: null, error: error?.message || "Invalid token" };
    }
    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message || "Auth error" };
  }
}

/** Extract bearer token from Authorization header */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
