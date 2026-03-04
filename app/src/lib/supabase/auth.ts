import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UserResult {
  user: { id: string; email?: string; [key: string]: any } | null;
  error: string | null;
}

/**
 * Verify a user's JWT and return the user object.
 * Creates a temporary client scoped to the user's token.
 */
export async function getUserFromToken(token: string): Promise<UserResult> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await (supabase as any).auth.getUser();
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
