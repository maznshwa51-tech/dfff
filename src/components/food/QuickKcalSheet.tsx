"use client";

import { LoaderCircle, Sparkles, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button, Field, Input, Segmented, Sheet, fmt } from "@/components/ui";
import { uid } from "@/lib/ids";
import type { QuickRequest, QuickResult } from "@/lib/quick";
import { putRow } from "@/lib/repo";
import { authHeader } from "@/lib/supabase";
import { MEALS, type FoodEntry, type Locale, type Meal } from "@/lib/types";
import { defaultMeal } from "./LogFoodSheet";

const PRESETS = [50, 100, 150, 200, 300];
type AiErr = "no_key" | "rate_limit" | "busy" | "offline" | "auth" | "generic";
type MacroKey = "protein" | "carbs" | "fat";

/**
 * إضافة سريعة بدون المكتبة (مثلاً: 12 لقيمات).
 * - وش أكلت: إجباري (ومعه الكمية)
 * - السعرات: اختيارية (أنت تكتبها أو Gemini يقدّرها)
 * - البروتين والكارب والدهون: إجبارية (Gemini يقدّرها أو تكتبها أنت)
 */
export function QuickKcalSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [reason, setReason] = useState("");
  const [kcal, setKcal] = useState("");
  const [macros, setMacros] = useState<Record<MacroKey, string>>({ protein: "", carbs: "", fat: "" });
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [touched, setTouched] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  // الذكاء الاصطناعي
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<AiErr | null>(null);
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const [question, setQuestion] = useState<{ question: string; options: string[] } | null>(null);
  const [answer, setAnswer] = useState("");
  const [estimate, setEstimate] = useState<{ note: string; for: string } | null>(null);
  const saving = useRef(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setKcal("");
      setMacros({ protein: "", carbs: "", fat: "" });
      setMeal(defaultMeal());
      setTouched(false);
      setAnswers([]);
      setQuestion(null);
      setAnswer("");
      setEstimate(null);
      setAiErr(null);
    }
  }

  const num = (v: string) => {
    const x = parseFloat(v.replace(",", "."));
    return Number.isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : NaN;
  };
  const userKcal = Math.round(parseFloat(kcal));
  const hasUserKcal = Number.isFinite(userKcal) && userKcal > 0 && userKcal <= 5000;
  const m = { protein: num(macros.protein), carbs: num(macros.carbs), fat: num(macros.fat) };
  const macrosOk = [m.protein, m.carbs, m.fat].every((x) => Number.isFinite(x)) && m.protein + m.carbs + m.fat > 0;
  const finalKcal = hasUserKcal ? userKcal : macrosOk ? Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9) : 0;
  const validReason = reason.trim().length > 0;
  const stale = estimate != null && estimate.for !== reason.trim();

  const ask = async (prev: { q: string; a: string }[]) => {
    setTouched(true);
    if (!validReason) return;
    setAiErr(null);
    if (!navigator.onLine) return setAiErr("offline");
    setAiBusy(true);
    try {
      const body: QuickRequest = { locale, description: reason.trim(), kcal: hasUserKcal ? userKcal : undefined, answers: prev };
      const res = await fetch("/api/quick", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data.error as string;
        return setAiErr((["no_key", "rate_limit", "busy", "auth"].includes(code) ? code : "generic") as AiErr);
      }
      const r = data as QuickResult;
      if (r.type === "question") {
        setQuestion({ question: r.question, options: r.options });
        setAnswer("");
      } else {
        setQuestion(null);
        setMacros({ protein: String(r.protein), carbs: String(r.carbs), fat: String(r.fat) });
        if (!hasUserKcal) setKcal(String(r.kcal));
        setEstimate({ note: r.note, for: reason.trim() });
      }
    } catch {
      setAiErr(navigator.onLine ? "generic" : "offline");
    } finally {
      setAiBusy(false);
    }
  };

  const start = () => {
    setAnswers([]);
    setQuestion(null);
    void ask([]);
  };
  const reply = (a: string) => {
    if (!question || !a.trim()) return;
    const next = [...answers, { q: question.question, a: a.trim().slice(0, 120) }];
    setAnswers(next);
    void ask(next);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validReason || !macrosOk || finalKcal <= 0 || saving.current) return;
    saving.current = true;
    const entry: FoodEntry = {
      id: uid(),
      quick: true,
      date,
      meal,
      name: reason.trim().slice(0, 80),
      amount: finalKcal,
      unit: "g",
      kcal: finalKcal,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      createdAt: Date.now(),
    };
    try {
      await putRow("entries", entry);
      onClose();
    } finally {
      saving.current = false;
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("quick.title")}>
      <form onSubmit={save} className="space-y-4">
        <Field label={t("quick.reason")}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("quick.reasonPlaceholder")} maxLength={80} aria-invalid={touched && !validReason} required autoFocus />
        </Field>
        {touched && !validReason && <p className="text-sm text-danger">{t("quick.reasonRequired")}</p>}

        <Field label={t("quick.kcal")} hint={t("quick.kcalHint")}>
          <Input type="number" inputMode="numeric" min="1" max="5000" value={kcal} onChange={(e) => setKcal(e.target.value)} className="num text-2xl font-bold" aria-label={t("quick.kcal")} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setKcal(String((hasUserKcal ? userKcal : 0) + p))} className="num rounded-full bg-gold/12 px-4 py-2 text-sm font-semibold text-gold active:scale-95">
              +{p}
            </button>
          ))}
        </div>

        {/* ---- البروتين والكارب والدهون (إجباري) ---- */}
        <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
          <p className="text-[13px] font-semibold">{t("quick.macrosTitle")}</p>
          {!question && (
            <Button type="button" variant="soft" className="w-full" icon={aiBusy ? LoaderCircle : Sparkles} disabled={aiBusy || !validReason} onClick={start}>
              {aiBusy ? t("quick.estimating") : hasUserKcal ? t("quick.estimate") : t("quick.estimateAll")}
            </Button>
          )}

          {question && (
            <div className="space-y-3">
              <p className="font-semibold leading-relaxed">💬 {question.question}</p>
              {question.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {question.options.map((o) => (
                    <button key={o} type="button" disabled={aiBusy} onClick={() => reply(o)} className="rounded-full bg-gold/12 px-4 py-2 text-sm font-semibold text-gold active:scale-95 disabled:opacity-40">
                      {o}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t("quick.answerPlaceholder")}
                  maxLength={120}
                  aria-label={t("quick.answerPlaceholder")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      reply(answer);
                    }
                  }}
                />
                <Button type="button" variant="soft" disabled={aiBusy || !answer.trim()} onClick={() => reply(answer)}>
                  {t("quick.send")}
                </Button>
              </div>
              <button type="button" disabled={aiBusy} className="text-sm text-muted underline disabled:opacity-40" onClick={() => reply(locale === "ar" ? "ما أعرف، قدّر حسب الشائع" : "Not sure, use the most common version")}>
                {t("quick.dontKnow")}
              </button>
              {aiBusy && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <LoaderCircle className="size-4 animate-spin" /> {t("quick.estimating")}
                </p>
              )}
            </div>
          )}

          {estimate && !stale && <p className="text-[13px] font-semibold text-gold">{t("quick.estimated")}</p>}
          {stale && <p className="text-xs text-gold">{t("quick.stale")}</p>}
          <div className="grid grid-cols-3 gap-2">
            {(["protein", "carbs", "fat"] as const).map((k) => (
              <Field key={k} label={`${t(`common.${k}`)} (${t("common.units.g")})`}>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={macros[k]}
                  onChange={(e) => setMacros({ ...macros, [k]: e.target.value })}
                  aria-invalid={touched && !Number.isFinite(m[k])}
                  className="num text-center font-bold"
                />
              </Field>
            ))}
          </div>
          {estimate?.note && !stale && <p className="text-xs text-muted">{estimate.note}</p>}
          {!hasUserKcal && macrosOk && <p className="num text-xs text-muted">{t("quick.kcalFromMacros", { n: fmt(finalKcal) })}</p>}
          {touched && !macrosOk && <p className="text-sm text-danger">{t("quick.macrosRequired")}</p>}
          {aiErr && (
            <p role="alert" className="text-sm text-danger">
              {t(`plan.errors.${aiErr}`)}
            </p>
          )}
        </div>

        <Segmented label={t("food.meal")} value={meal} onChange={setMeal} options={MEALS.map((id) => ({ id, label: t(`meals.${id}`) }))} />
        <p className="text-xs leading-relaxed text-muted">{t("quick.note")}</p>
        <Button type="submit" icon={Zap} className="w-full" disabled={!validReason || !macrosOk || finalKcal <= 0 || aiBusy}>
          {t("quick.save", { n: fmt(finalKcal) })}
        </Button>
      </form>
    </Sheet>
  );
}
