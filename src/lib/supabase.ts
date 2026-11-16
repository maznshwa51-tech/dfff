"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RemoteAdapter, RemoteRecord } from "./sync";

// هذي المفاتيح عامة (anon) ومسموح تكون في المتصفح. الحماية من Row Level Security في قاعدة البيانات
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_ENABLED = Boolean(url && anonKey);

/** أي طلب لـ Supabase ياخذ أكثر من 25 ثانية ينلغي (عشان المزامنة ما تعلق للأبد لو النت ضعيف) */
const REQUEST_TIMEOUT_MS = 25_000;
const fetchWithTimeout: typeof fetch = (input, init = {}) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Request timed out", "TimeoutError")), REQUEST_TIMEOUT_MS);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason);
    else outer.addEventListener("abort", () => ctrl.abort(outer.reason), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
};

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_ENABLED) return null;
  client ??= createClient(url!, anonKey!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    global: { fetch: fetchWithTimeout },
  });
  return client;
}

export function supabaseAdapter(sb: SupabaseClient, userId: string): RemoteAdapter {
  return {
    async push(rows) {
      const { error } = await sb
        .from("records")
        .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: "user_id,table_name,id" });
      if (error) throw error;
    },
    async pull(since, limit) {
      let q = sb
        .from("records")
        .select("table_name,id,data,deleted,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: true })
        .limit(limit);
      if (since) q = q.gt("updated_at", since);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RemoteRecord[];
    },
  };
}

/** توكن الدخول الحالي (نرسله لـ API Routes عشان نتأكد إنك أنت) */
export async function authHeader(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data } = await sb.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
