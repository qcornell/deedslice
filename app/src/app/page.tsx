import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function Home() {
  // If user has a Supabase session cookie, go to dashboard.
  // Otherwise, go straight to login (avoid a double redirect).
  const cookieStore = cookies();
  const hasSession = cookieStore.getAll().some(c => c.name.includes("sb-") && c.name.includes("auth"));
  redirect(hasSession ? "/dashboard" : "/login");
}
