"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/hooks";

/** يسجّل الـ Service Worker ويطبّق الوضع الداكن حسب الإعدادات */
export function AppBoot() {
  const settings = useSettings();

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // طلب تخزين دائم عشان المتصفح ما يحذف البيانات
    navigator.storage?.persist?.().catch(() => {});
  }, []);

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

  return null;
}
