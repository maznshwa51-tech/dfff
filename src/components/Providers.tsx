"use client";

import { MotionConfig } from "framer-motion";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { ensureDefaults, migrateLegacy, migrateSettings } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { getSupabase, SUPABASE_ENABLED } from "@/lib/supabase";
import { clearLocal, prepareForUser } from "@/lib/sync";
import { syncManager } from "@/lib/sync-client";
import type { Locale } from "@/lib/types";
import { LoginScreen } from "./LoginScreen";
import { SlowNotice } from "./PageLoading";
import { CodeScreen } from "./CodeScreen";
import { clearCodeVerified, isCodeVerified } from "@/lib/otp";

const MESSAGES = { ar, en };

function readCached<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

/** اللغة والاتجاه والوضع الداكن (من الإعدادات، ونحفظها في localStorage عشان ما يصير وميض) */
function IntlAndTheme({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [cached, setCached] = useState<Locale>("ar");
  useEffect(() => setCached(readCached<Locale>("locale", "ar")), []);
  const locale: Locale = settings?.locale ?? cached;

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("locale", locale);
    } catch {}
  }, [locale]);

  useEffect(() => {
    if (!settings) return;
    const t = settings.theme;
    try {
      localStorage.setItem("theme", t);
    } catch {}
    const accent = settings.accent ?? "gold";
    document.documentElement.dataset.accent = accent;
    // أيقونة التطبيق (الشاشة الرئيسية) حسب الثيم
    document.querySelector('link[rel="manifest"]')?.setAttribute("href", `/manifest.webmanifest?accent=${accent}`);
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute("href", `/icons/${accent}/apple-touch-icon.png`);
    document.querySelector('link[rel="icon"]')?.setAttribute("href", `/icons/${accent}/icon-192.png`);
    try {
      localStorage.setItem("accent", accent);
    } catch {}
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = t === "dark" || (t === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      // لون شريط الجوال (فوق وتحت) = لون خلفية التطبيق
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0a0a0b" : "#f6f5f2"));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings]);

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone} onError={() => {}}>
      {children}
    </NextIntlClientProvider>
  );
}

// ---------- الحساب ----------

interface AuthState {
  enabled: boolean;
  user: User | null;
  signOut: () => Promise<void>;
}
const AuthCtx = createContext<AuthState>({ enabled: false, user: null, signOut: async () => {} });
export const useAuth = () => useContext(AuthCtx);

function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(SUPABASE_ENABLED ? undefined : null);
  const [booted, setBooted] = useState(false);
  const [migratedNotice, setMigratedNotice] = useState(false);

  // الوضع المحلي (بدون Supabase): ننقل البيانات القديمة ونضيف الافتراضيات
  useEffect(() => {
    if (SUPABASE_ENABLED) return;
    (async () => {
      const db = getDb();
      await migrateLegacy(db).catch((e) => console.warn("legacy migration failed", e));
      await ensureDefaults(db);
      await migrateSettings(db);
      setBooted(true);
    })();
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // بعد تسجيل الدخول لازم رمز التحقق على الإيميل قبل ما نفتح التطبيق أو نزامن أي بيانات
  const [codeOkFor, setCodeOkFor] = useState<string | null>(null);
  const verified = !!session && (codeOkFor === session.user.id || isCodeVerified(session));
  const userId = verified ? session?.user.id : undefined;
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !userId) return;
    let cancelled = false;
    (async () => {
      const db = getDb();
      await migrateLegacy(db).catch((e) => console.warn("legacy migration failed", e));
      const result = await prepareForUser(db, userId);
      if (cancelled) return;
      syncManager.start(sb, userId);
      setBooted(true);
      await syncManager.runNow();
      if (result === "first" && (await db.entries.count()) > 0) setMigratedNotice(true);
    })();
    return () => {
      cancelled = true;
      syncManager.stop();
    };
  }, [userId]);

  const signOut = async () => {
    await syncManager.runNow(); // نرفع أي تغييرات باقية
    const db = getDb();
    // نمسح النسخة المحلية فقط إذا كل شي ارتفع (عشان ما يضيع شي)
    if ((await db.outbox.count()) === 0) await clearLocal(db);
    clearCodeVerified();
    setCodeOkFor(null);
    await getSupabase()?.auth.signOut();
    setBooted(false);
  };

  if (session === undefined) return <Splash />;
  if (SUPABASE_ENABLED && !session) return <LoginScreen />;
  if (SUPABASE_ENABLED && session && !verified)
    return (
      <CodeScreen
        key={session.user.id}
        email={session.user.email ?? ""}
        userId={session.user.id}
        onVerified={() => setCodeOkFor(session.user.id)}
        onCancel={async () => {
          clearCodeVerified();
          await getSupabase()?.auth.signOut();
        }}
      />
    );
  if (!booted) return <Splash />;
  return (
    <AuthCtx.Provider value={{ enabled: SUPABASE_ENABLED, user: session?.user ?? null, signOut }}>
      {migratedNotice && <MigratedToast onClose={() => setMigratedNotice(false)} />}
      {children}
    </AuthCtx.Provider>
  );
}

function Splash() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 8000);
    const blocked = () => setSlow(true);
    window.addEventListener("lyaqa-db-blocked", blocked);
    return () => {
      clearTimeout(id);
      window.removeEventListener("lyaqa-db-blocked", blocked);
    };
  }, []);
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="size-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" aria-label="loading" />
        {slow && <SlowNotice />}
      </div>
    </div>
  );
}

function MigratedToast({ onClose }: { onClose: () => void }) {
  const t = useTranslations("auth");
  useEffect(() => {
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <div role="status" className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[60] mx-auto max-w-md rounded-2xl bg-success px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
      {t("migrated")}
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      // لما يوصل تحديث للتطبيق ويستلم الـ Service Worker الجديد: نعيد التحميل مرة وحدة
      // عشان ما تشتغل صفحة من النسخة القديمة وصفحة من الجديدة
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // نشيك على التحديثات لما ترجع للتطبيق
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update().catch(() => {}));
        })
        .catch(() => {});
    }
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 34 }}>
      <IntlAndTheme>
        <AuthGate>{children}</AuthGate>
      </IntlAndTheme>
    </MotionConfig>
  );
}
