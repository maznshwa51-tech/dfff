"use client";

import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { AppLogo } from "./AppLogo";
import { Button, Field, Input } from "./ui";

type ErrKey = "invalid" | "notConfirmed" | "exists" | "weak" | "offline" | "generic" | "googleDisabled";

function mapError(e: { code?: string; message?: string; status?: number } | null): ErrKey {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const code = e?.code ?? "";
  const msg = (e?.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "invalid";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "notConfirmed";
  if (code === "user_already_exists" || msg.includes("already registered")) return "exists";
  if (code === "weak_password" || msg.includes("password should")) return "weak";
  return "generic";
}

export function LoginScreen() {
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrKey | null>(null);
  const [info, setInfo] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    setInfo(false);
    try {
      if (mode === "signIn") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(mapError(error));
      } else {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (error) setError(mapError(error));
        else if (!data.session) setInfo(true); // لازم يأكد الإيميل
      }
    } catch {
      setError(mapError(null));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    // نتأكد إن Google مفعّل في Supabase قبل ما نحولك (بدل صفحة خطأ غريبة)
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      if (res.ok) {
        const s = (await res.json()) as { external?: { google?: boolean } };
        if (s.external && !s.external.google) return setError("googleDisabled");
      }
    } catch {
      if (!navigator.onLine) return setError("offline");
    }
    const { error } = (await getSupabase()?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } })) ?? {};
    if (error) setError(mapError(error));
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <AppLogo size={80} className="mx-auto mb-5" />
          <h1 className="text-3xl font-bold tracking-tight">{t("welcome")}</h1>
          <p className="mt-2 text-[15px] text-muted">{t("subtitle")}</p>
        </div>

        <Button variant="neutral" className="w-full" onClick={google} type="button">
          <GoogleLogo />
          {t("google")}
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          {t("or")}
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label={t("email")}>
            <Input type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t("password")} hint={mode === "signUp" ? t("passwordHint") : undefined}>
            <Input type="password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          </Field>
          {error && (
            <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {t(`errors.${error}`)}
            </p>
          )}
          {info && (
            <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">
              {t("checkEmail")}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy} icon={Mail}>
            {mode === "signIn" ? t("signIn") : t("signUp")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "signIn" ? t("noAccount") : t("haveAccount")}{" "}
          <button className="font-semibold text-gold" onClick={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setError(null); setInfo(false); }}>
            {mode === "signIn" ? t("signUp") : t("signIn")}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15A10.9 10.9 0 0 0 12 1 11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
