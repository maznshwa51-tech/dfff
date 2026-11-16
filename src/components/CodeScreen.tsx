"use client";

import { motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { markCodeVerified } from "@/lib/otp";
import { getSupabase } from "@/lib/supabase";
import { AppLogo } from "./AppLogo";
import { Button, Field, Input } from "./ui";

const RESEND_SECONDS = 60;
type Err = "wrong" | "rateLimit" | "sendFailed" | "offline" | null;

function mapSendError(e: { status?: number; code?: string; message?: string }): Err {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (e.status === 429 || /rate limit/i.test(e.message ?? "") || e.code?.includes("rate_limit")) return "rateLimit";
  return "sendFailed";
}

/** شاشة رمز التحقق: نرسل رمز لإيميلك وتكتبه عشان تدخل */
export function CodeScreen({ email, userId, onVerified, onCancel }: { email: string; userId: string; onVerified: () => void; onCancel: () => void }) {
  const t = useTranslations("code");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Err>(null);
  const [wait, setWait] = useState(0);
  const started = useRef(false);

  const send = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    setError(null);
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) {
      setError(mapSendError(error));
      if (error.status === 429) setWait(RESEND_SECONDS);
      return;
    }
    try {
      sessionStorage.setItem("lyaqa-code-sent", `${email}|${Date.now()}`);
    } catch {}
    setWait(RESEND_SECONDS);
  }, [email]);

  // نرسل الرمز تلقائياً أول ما تفتح الشاشة (وما نعيد الإرسال لو حدّثت الصفحة خلال دقيقة)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let recent = 0;
    try {
      const [e, ts] = (sessionStorage.getItem("lyaqa-code-sent") ?? "").split("|");
      if (e === email) recent = Number(ts) || 0;
    } catch {}
    const left = Math.ceil((recent + RESEND_SECONDS * 1000 - Date.now()) / 1000);
    if (left > 0) setWait(left);
    else void send();
  }, [email, send]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    const token = code.replace(/\D/g, "");
    if (!sb || token.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error } = await sb.auth.verifyOtp({ email, token, type: "email" });
      if (error || !data.session) {
        setError(!navigator.onLine ? "offline" : "wrong");
        return;
      }
      markCodeVerified(data.session.user.id || userId);
      onVerified();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <AppLogo size={72} className="mx-auto mb-5" />
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {t("sentTo")} <b dir="ltr" className="text-fg">{email}</b>
          </p>
        </div>
        <form onSubmit={verify} className="space-y-4">
          <Field label={t("label")}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              autoFocus
              placeholder="••••••"
              className="num text-center text-3xl font-bold tracking-[0.4em]"
              aria-label={t("label")}
            />
          </Field>
          {error && (
            <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {t(`errors.${error}`)}
            </p>
          )}
          <Button type="submit" className="w-full" icon={MailCheck} disabled={busy || code.length < 6}>
            {t("verify")}
          </Button>
        </form>
        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <button type="button" className="font-semibold text-gold disabled:text-muted" disabled={wait > 0} onClick={() => void send()}>
            {wait > 0 ? t("resendIn", { s: wait }) : t("resend")}
          </button>
          <button type="button" className="text-muted underline" onClick={onCancel}>
            {t("otherAccount")}
          </button>
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted">{t("spam")}</p>
      </motion.div>
    </div>
  );
}
