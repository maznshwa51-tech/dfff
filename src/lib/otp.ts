"use client";

// رمز التحقق على الإيميل: بعد تسجيل الدخول (بكلمة السر أو Google) لازم تكتب رمز يوصل إيميلك
import type { Session } from "@supabase/supabase-js";

/** تقدر تطفيه بـ NEXT_PUBLIC_REQUIRE_EMAIL_CODE=false (مثلاً لو الإيميلات ما تشتغل) */
export const REQUIRE_EMAIL_CODE = process.env.NEXT_PUBLIC_REQUIRE_EMAIL_CODE !== "false";

const KEY = "lyaqa-code-ok";

/** طريقة تسجيل الدخول من التوكن (Supabase يحطها في amr) */
export function authMethods(session: Session): string[] {
  try {
    const part = session.access_token.split(".")[1];
    const json = JSON.parse(decodeURIComponent(escape(atob(part.replace(/-/g, "+").replace(/_/g, "/")))));
    return Array.isArray(json.amr) ? json.amr.map((a: { method?: string }) => String(a?.method ?? a)) : [];
  } catch {
    return [];
  }
}

/** هل هذي الجلسة تحققت برمز الإيميل؟ */
export function isCodeVerified(session: Session): boolean {
  if (!REQUIRE_EMAIL_CODE || !session.user.email) return true;
  const m = authMethods(session);
  if (m.includes("otp") || m.includes("magiclink") || m.includes("email/signup")) return true;
  try {
    return localStorage.getItem(KEY) === session.user.id;
  } catch {
    return false;
  }
}

export function markCodeVerified(userId: string) {
  try {
    localStorage.setItem(KEY, userId);
  } catch {}
}

export function clearCodeVerified() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem("lyaqa-code-sent");
  } catch {}
}
