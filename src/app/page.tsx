"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { defaultMeal } from "@/components/AddFood";
import { DayTypeControl } from "@/components/DayTypeControl";
import { MacroDonut } from "@/components/charts";
import { Card, CardTitle, Progress, fmt } from "@/components/ui";
import { addDays, formatDay } from "@/lib/dates";
import { getDb, INTENSITIES } from "@/lib/db";
import { scaleMacros } from "@/lib/food-match";
import { useHour, useRange, useSettings, useToday } from "@/lib/hooks";
import { healthAlerts, summarizeDays, suggestProtein, weeklyAvgChange, type HealthAlert } from "@/lib/stats";

export default function TodayPage() {
  const today = useToday();
  const hour = useHour();
  const settings = useSettings();
  // نحتاج 14 يوم للوزن (مقارنة المتوسط بالأسبوع اللي قبله) وأمس للتنبيهات
  const data = useRange(addDays(today, -14), today);
  const foods = useLiveQuery(() => getDb().foods.toArray(), []);
  const recent = useLiveQuery(
    () => getDb().entries.where("date").aboveOrEqual(addDays(today, -30)).toArray().then((es) => new Set(es.map((e) => e.name))),
    [today],
  );

  const view = useMemo(() => {
    if (!settings || !data) return null;
    const [yesterday, day] = summarizeDays([addDays(today, -1), today], data, settings);
    const change = weeklyAvgChange(data.weights, today);
    const alerts: HealthAlert[] = [
      ...healthAlerts(day, hour >= 21, change, settings, "اليوم"),
      // تنبيهات أمس (اليوم خلص) بدون تكرار تنبيه الوزن
      ...healthAlerts(yesterday, true, null, settings, "أمس"),
    ];
    return { day, alerts };
  }, [settings, data, today, hour]);

  if (!settings || !view) return <div className="pt-10 text-center text-muted">…</div>;
  const { day, alerts } = view;
  const t = day.targets;
  const proteinLeft = Math.max(0, Math.round((t.protein - day.protein) * 10) / 10);
  const kcalLeft = t.kcal - day.kcal;
  const suggestions = foods && recent ? suggestProtein(proteinLeft, kcalLeft, foods, recent) : [];

  return (
    <>
      <header className="flex items-center justify-between pb-3 pt-2">
        <div>
          <h1 className="text-2xl font-bold">اليوم</h1>
          <p className="text-sm text-muted">{formatDay(today)}</p>
        </div>
        <Link href="/settings" aria-label="الإعدادات" className="grid size-11 place-items-center rounded-full bg-card text-muted ring-1 ring-line">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Link>
      </header>

      <div className="space-y-4">
        <Alerts alerts={alerts} />

        {/* البروتين: الرقم الأهم */}
        <Card>
          <div className="text-sm font-semibold text-muted">البروتين اليوم</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-5xl font-extrabold tabular-nums text-protein">{fmt(day.protein, 1)}</span>
            <span className="text-lg text-muted">من {t.protein} غ</span>
          </div>
          <div className="mt-3">
            <Progress value={day.protein} max={t.protein} color="var(--protein)" label="البروتين" />
          </div>
          <p className="mt-2 text-sm font-medium">{proteinLeft > 0 ? `باقي لك ${fmt(proteinLeft, 1)} غ بروتين` : "وصلت هدف البروتين اليوم 💪🔥"}</p>

          {suggestions.length > 0 && (
            <div className="mt-3 rounded-xl bg-protein/10 p-3">
              <div className="mb-2 text-xs font-semibold text-protein">💡 اقتراح يكمّل البروتين</div>
              <ul className="space-y-1.5">
                {suggestions.map((s) => (
                  <li key={s.food.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {s.label} = <b className="tabular-nums">{s.protein} غ</b>
                      <span className="text-xs text-muted"> ({s.kcal} سعرة)</span>
                    </span>
                    <button
                      className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-semibold text-brand ring-1 ring-line active:bg-track"
                      onClick={() =>
                        getDb().entries.add({
                          date: today,
                          meal: defaultMeal(),
                          name: s.food.name,
                          grams: s.grams,
                          foodId: s.food.id,
                          ...scaleMacros(s.food, s.grams),
                          createdAt: Date.now(),
                        })
                      }
                    >
                      + أكلته
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* السعرات + التوزيع */}
        <Card>
          <div className="flex items-center gap-4">
            <MacroDonut protein={day.protein} carbs={day.carbs} fat={day.fat} size={128} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-muted">السعرات المتبقية</div>
              <div className={`text-3xl font-bold tabular-nums ${kcalLeft < 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{fmt(kcalLeft)}</div>
              <div className="text-xs text-muted tabular-nums">
                أكلت {fmt(day.kcal)} من {fmt(t.kcal)} ({day.dayType === "training" ? "يوم تمرين" : "يوم راحة"})
              </div>
              <div className="mt-2">
                <Progress value={day.kcal} max={t.kcal} color="var(--kcal)" label="السعرات" />
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <MacroRow label="بروتين" value={day.protein} target={t.protein} color="var(--protein)" />
            <MacroRow label="كربوهيدرات" value={day.carbs} target={t.carbs} color="var(--carbs)" />
            <MacroRow label="دهون" value={day.fat} target={t.fat} color="var(--fat)" />
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Tile href="/activity" label="الخطوات" value={day.steps == null ? "—" : fmt(day.steps)} sub={<Progress value={day.steps ?? 0} max={settings.stepsGoal} label="الخطوات" />} />
          <Tile
            href="/activity"
            label="تمرين اليوم"
            value={day.workouts.length ? day.workouts.map((w) => w.type).join("، ") : "—"}
            sub={
              day.workouts.length
                ? `${day.workouts.reduce((a, w) => a + w.durationMin, 0)} د · ${INTENSITIES.find((i) => i.id === day.workouts[0].intensity)?.label}`
                : day.dayType === "training"
                  ? "مجدول اليوم"
                  : "راحة"
            }
          />
          <Tile href="/weight" label="وزن اليوم" value={day.weight == null ? "—" : `${day.weight.toFixed(1)}`} sub={day.weight == null ? "سجّل وزنك" : "كغ"} />
        </div>

        <Card>
          <CardTitle>نوع اليوم</CardTitle>
          <DayTypeControl date={today} settings={settings} />
        </Card>

        <Link href="/food" className="flex min-h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white dark:text-slate-950">
          + سجّل أكل
        </Link>
      </div>
    </>
  );
}

function MacroRow({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="tabular-nums text-muted">
          <b className="text-fg">{fmt(value)}</b> / {target} غ
        </span>
      </div>
      <Progress value={value} max={target} color={color} label={label} />
    </div>
  );
}

function Tile({ href, label, value, sub }: { href: string; label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-2xl bg-card p-3 ring-1 ring-line">
      <span className="text-xs text-muted">{label}</span>
      <span className="truncate text-lg font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted">{sub}</span>
    </Link>
  );
}

function Alerts({ alerts }: { alerts: HealthAlert[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem("dismissedAlerts") || "[]"));
    } catch {}
  }, []);
  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem("dismissedAlerts", JSON.stringify(next));
    } catch {}
  };
  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  if (!visible.length) return null;
  return (
    <div className="space-y-2" role="status">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`relative rounded-2xl p-4 pe-10 ring-1 ${a.level === "warn" ? "bg-amber-500/10 ring-amber-500/30" : "bg-sky-500/10 ring-sky-500/30"}`}
        >
          <div className="font-semibold">{a.title}</div>
          <p className="mt-1 text-sm leading-relaxed">{a.body}</p>
          <button className="absolute end-2 top-2 grid size-8 place-items-center rounded-full text-muted" aria-label="إخفاء التنبيه" onClick={() => dismiss(a.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

