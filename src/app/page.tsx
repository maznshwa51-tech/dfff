"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { Dumbbell, Footprints, Info, Lightbulb, MessageCircle, Plus, Scale, Sparkles, TriangleAlert, X, Zap } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { DayTypeControl } from "@/components/DayTypeControl";
import { MacroDonut } from "@/components/charts";
import { LogFoodSheet } from "@/components/food/LogFoodSheet";
import { QuickKcalSheet } from "@/components/food/QuickKcalSheet";
import { AppLogo } from "@/components/AppLogo";
import { Card, CardTitle, PageHeader, Progress, Ring, fmt, useDayLabel } from "@/components/ui";
import { addDays } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { foodName, useHour, useRange, useSettings, useToday, useWorkoutName, useWorkoutTypes } from "@/lib/hooks";
import { computeReportData, fallbackEncouragement, reportText } from "@/lib/report";
import { healthAlerts, summarizeDays, suggestProtein, weeklyAvgChange, type HealthAlert } from "@/lib/stats";
import { scheduledType } from "@/lib/targets";
import type { Food, Locale } from "@/lib/types";

export default function TodayPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const today = useToday();
  const hour = useHour();
  const settings = useSettings();
  const dayLabel = useDayLabel();
  const wname = useWorkoutName();
  const types = useWorkoutTypes();
  const data = useRange(addDays(today, -14), today);
  const foods = useLiveQuery(() => getDb().foods.toArray(), []);
  const recent = useLiveQuery(
    () =>
      getDb()
        .entries.where("date")
        .aboveOrEqual(addDays(today, -30))
        .toArray()
        .then((es) => new Set(es.map((e) => e.foodId).filter(Boolean) as string[])),
    [today],
  );
  const [logFood, setLogFood] = useState<Food | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);

  const view = useMemo(() => {
    if (!settings || !data) return null;
    const [yesterday, day] = summarizeDays([addDays(today, -1), today], data, settings);
    const change = weeklyAvgChange(data.weights, today);
    const alerts: HealthAlert[] = [
      ...healthAlerts(day, hour >= 21, change, settings, "today"),
      // تنبيهات أمس (اليوم خلص) بدون تكرار تنبيه الوزن
      ...healthAlerts(yesterday, true, null, settings, "yesterday"),
    ];
    return { day, alerts };
  }, [settings, data, today, hour]);

  if (!settings || !view || !data) return null;
  const { day, alerts } = view;
  const tg = day.targets;
  const proteinLeft = Math.max(0, Math.round((tg.protein - day.protein) * 10) / 10);
  const kcalLeft = tg.kcal - day.kcal;
  const suggestions = foods && recent ? suggestProtein(proteinLeft, kcalLeft, foods, recent) : [];
  const workoutId = day.session?.type ?? scheduledType(today, settings);

  const share = () => {
    const r = computeReportData(today, data, settings, types, locale);
    const text = reportText(r, locale, fallbackEncouragement(locale, today));
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <>
      <PageHeader title={t("nav.today")} subtitle={dayLabel(today, "")} logo={<AppLogo size={46} />} />

      <div className="space-y-4">
        <Alerts alerts={alerts} />

        <div className="grid gap-4 md:grid-cols-2">
          {/* البروتين: الرقم الأهم */}
          <Card>
            <CardTitle>{t("home.proteinToday")}</CardTitle>
            <div className="flex items-center gap-5">
              <Ring value={day.protein} max={tg.protein} size={108} stroke={11} label={t("home.proteinToday")}>
                <span className="num text-sm font-semibold text-muted">{tg.protein > 0 ? Math.round((day.protein / tg.protein) * 100) : 0}%</span>
              </Ring>
              <div className="min-w-0">
                <div className="num text-6xl font-extrabold leading-none text-gold" data-testid="protein-today">
                  {fmt(day.protein, 1)}
                </div>
                <div className="mt-1.5 text-[15px] text-muted">{t("home.ofTarget", { target: tg.protein })}</div>
                <p className="mt-2 text-[15px] font-semibold">{proteinLeft > 0 ? t("home.proteinLeft", { n: fmt(proteinLeft, 1) }) : t("home.proteinDone")}</p>
              </div>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-5 rounded-2xl bg-gold/10 p-4">
                <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-gold">
                  <Lightbulb className="size-4" /> {t("home.suggestion")}
                </div>
                <ul className="space-y-2.5">
                  {suggestions.map((s) => (
                    <li key={s.food.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        {t("home.suggestionItem", {
                          name: foodName(s.food, locale),
                          amount: fmt(s.amount),
                          unit: t(`common.units.${s.food.unit}`),
                          protein: fmt(s.protein, 1),
                        })}
                      </span>
                      <button onClick={() => setLogFood(s.food)} className="shrink-0 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold text-gold shadow-soft ring-1 ring-line active:scale-95">
                        {t("home.logIt")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* السعرات والتوزيع */}
          <Card>
            <CardTitle
              action={
                <button onClick={() => setQuickOpen(true)} className="flex items-center gap-1 rounded-full bg-gold/12 px-3 py-1.5 text-xs font-semibold text-gold active:scale-95">
                  <Zap className="size-3.5" /> {t("quick.button")}
                </button>
              }
            >
              {t("home.distribution")}
            </CardTitle>
            <button type="button" onClick={() => setQuickOpen(true)} aria-label={t("quick.tapHint")} className="flex w-full items-center gap-5 text-start">
              <MacroDonut protein={day.protein} carbs={day.carbs} fat={day.fat} size={108} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-muted">{kcalLeft >= 0 ? t("home.kcalLeft") : t("home.kcalOver")}</div>
                <div className={`num text-4xl font-extrabold ${kcalLeft < 0 ? "text-danger" : ""}`} data-testid="kcal-left">
                  {fmt(Math.abs(kcalLeft))}
                </div>
                <div className="num mt-0.5 text-xs text-muted">{t("home.eaten", { eaten: fmt(day.kcal), target: fmt(tg.kcal) })}</div>
                <div className="mt-2.5">
                  <Progress value={day.kcal} max={tg.kcal} color="var(--kcal)" label={t("common.calories")} />
                </div>
                <div className="mt-1.5 text-[11px] font-medium text-gold">{t("quick.tapHint")} +</div>
              </div>
            </button>
            <div className="mt-5 space-y-3.5">
              <MacroRow label={t("common.protein")} value={day.protein} target={tg.protein} color="var(--protein)" />
              <MacroRow label={t("common.carbs")} value={day.carbs} target={tg.carbs} color="var(--carbs)" />
              <MacroRow label={t("common.fat")} value={day.fat} target={tg.fat} color="var(--fat)" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Tile href="/training" icon={Footprints} label={t("home.steps")} value={day.steps == null ? "—" : fmt(day.steps)}>
            <Progress value={day.steps ?? 0} max={settings.stepsGoal} color="var(--success)" height="h-1.5" label={t("home.steps")} />
          </Tile>
          <Tile href="/training" icon={Dumbbell} label={t("home.workout")} value={wname(workoutId)}>
            <span className={`text-xs font-semibold ${day.workoutDone ? "text-success" : "text-muted"}`}>
              {workoutId === "rest" ? "😌" : day.workoutDone ? `${t("common.done")} ✅` : "—"}
            </span>
          </Tile>
          <Tile href="/weight" icon={Scale} label={t("home.weight")} value={day.weight == null ? "—" : day.weight.toFixed(1)}>
            <span className="text-xs text-muted">{day.weight == null ? t("home.logWeight") : t("common.kg")}</span>
          </Tile>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>{t("dayType.title")}</CardTitle>
            <DayTypeControl date={today} settings={settings} />
          </Card>
          <div className="grid content-start gap-3">
            <Link href="/food" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gold text-[15px] font-semibold text-gold-ink shadow-soft transition active:scale-[0.98]">
              <Plus className="size-5" /> {t("home.logFood")}
            </Link>
            <Link href="/plan" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gold/12 text-[15px] font-semibold text-gold transition active:scale-[0.98]">
              <Sparkles className="size-5" /> {t("plan.homeButton")}
            </Link>
            <button onClick={share} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-card text-[15px] font-semibold text-success shadow-soft ring-1 ring-line transition active:scale-[0.98]">
              <MessageCircle className="size-5" /> {t("home.share")}
            </button>
          </div>
        </div>
      </div>

      <LogFoodSheet food={logFood} date={today} onClose={() => setLogFood(null)} />
      <QuickKcalSheet open={quickOpen} onClose={() => setQuickOpen(false)} date={today} />
    </>
  );
}

function MacroRow({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="num text-muted">
          <b className="text-fg">{fmt(value)}</b> / {target}
        </span>
      </div>
      <Progress value={value} max={target} color={color} height="h-2" label={label} />
    </div>
  );
}

function Tile({ href, icon: Icon, label, value, children }: { href: string; icon: typeof Scale; label: string; value: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-w-0 flex-col gap-1.5 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-line transition active:scale-[0.98]">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="size-3.5 shrink-0 text-gold" /> <span className="truncate">{label}</span>
      </span>
      <span className="num line-clamp-2 text-lg font-bold leading-tight">{value}</span>
      {children}
    </Link>
  );
}

function Alerts({ alerts }: { alerts: HealthAlert[] }) {
  const t = useTranslations("alerts");
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem("dismissedAlerts") || "[]"));
    } catch {}
  }, []);
  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-60);
    setDismissed(next);
    try {
      localStorage.setItem("dismissedAlerts", JSON.stringify(next));
    } catch {}
  };
  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  if (!visible.length) return null;
  const ideas = t.raw("ideas") as string[];
  return (
    <div className="space-y-3" role="status">
      {visible.map((a) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`relative flex gap-3 rounded-3xl p-4 pe-12 ring-1 ${a.level === "warn" ? "bg-gold/10 ring-gold/25" : "bg-carbs/10 ring-carbs/25"}`}
        >
          {a.level === "warn" ? <TriangleAlert className="mt-0.5 size-5 shrink-0 text-gold" /> : <Info className="mt-0.5 size-5 shrink-0 text-carbs" />}
          <div>
            <div className="font-semibold">{t(`${a.kind}.title`, { when: t(a.when) })}</div>
            <p className="mt-1 text-sm leading-relaxed opacity-85">
              {t(`${a.kind}.body`, { when: t(a.when), value: fmt(a.value, 2), limit: a.limit, idea: ideas[new Date().getDate() % ideas.length] })}
            </p>
          </div>
          <button className="absolute end-3 top-3 grid size-8 place-items-center rounded-full text-muted hover:bg-track/60" aria-label={t("dismiss")} onClick={() => dismiss(a.id)}>
            <X className="size-4" />
          </button>
        </motion.div>
      ))}
    </div>
  );
}
