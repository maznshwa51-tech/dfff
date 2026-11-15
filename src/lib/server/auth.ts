import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SERVER_SUPABASE_ENABLED = Boolean(url && anon);

/** يتأكد من توكن المستخدم. في الوضع المحلي (بدون Supabase) يرجع "local" */
export async function requireUser(req: Request): Promise<User | "local" | null> {
  if (!SERVER_SUPABASE_ENABLED) return "local";
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

let admin: SupabaseClient | null = null;
/** عميل بصلاحيات كاملة (للتقرير التلقائي فقط). يتجاوز RLS، فما يُستخدم إلا على السيرفر */
export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
