"use client";

import { MotionConfig } from "framer-motion";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { migrateLegacy, ensureDefaults } from "@/lib/bootstrap";
import { getDb } from "@/lib/db";
import { useSettings } from "@/lib/hooks";
import { getSupabase, SUPABASE_ENABLED } from "@/lib/supabase";
import { clearLocal, prepareForUser } from "@/lib/sync";
import { syncManager } from "@/lib/sync-client";
import type { Locale } from "@/lib/types";
import { LoginScreen } from "./LoginScreen";

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
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", t === "dark" || (t === "system" && mq.matches));
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

  const userId = session?.user.id;
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
    await getSupabase()?.auth.signOut();
    setBooted(false);
  };

  if (session === undefined) return <Splash />;
  if (SUPABASE_ENABLED && !session) return <LoginScreen />;
  if (!booted) return <Splash />;
  return (
    <AuthCtx.Provider value={{ enabled: SUPABASE_ENABLED, user: session?.user ?? null, signOut }}>
      {migratedNotice && <MigratedToast onClose={() => setMigratedNotice(false)} />}
      {children}
    </AuthCtx.Provider>
  );
}

function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-bg">
      <div className="size-10 animate-spin rounded-full border-2 border-gold/30 border-t-gold" aria-label="loading" />
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
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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
