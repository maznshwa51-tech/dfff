"use client";

import { PageLoading } from "@/components/PageLoading";
import { Bike, Dumbbell, Flame, Footprints, Scale, Target, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { BarsVsTarget, SimpleBars, WeightChart } from "@/components/charts";
import { Card, CardTitle, Empty, PageHeader, Segmented, Signed, Stat, fmt } from "@/components/ui";
import { addDays, lastNDays } from "@/lib/dates";
import { useRange, useSettings, useToday } from "@/lib/hooks";
import { movingAverage, periodStats, proteinStreak, round2, summarizeDays, topProteinFoods } from "@/lib/stats";
import { compliance, workoutStreak } from "@/lib/workouts";

type Range = "7" | "30" | "90";
const HISTORY = 180;

export default function StatsPage() {
  const t = useTranslations();
  const today = useToday();
  const settings = useSettings();
  const [range, setRange] = useState<Range>("7");
  const data = useRange(addDays(today, -HISTORY), today);

  const v = useMemo(() => {
    if (!settings || !data) return null;
    const n = Number(range);
    const days = lastNDays(today, n);
    const summary = summarizeDays(days, data, settings);
    const ma = movingAverage(data.weights, days);
    const firstMa = ma.find((x) => x != null) ?? null;
    const lastMa = [...ma].reverse().find((x) => x != null) ?? null;
    const proteinByDate = new Map<string, number>();
    for (const e of data.entries) proteinByDate.set(e.date, (proteinByDate.get(e.date) ?? 0) + e.protein);
    const daySet = new Set(days);
    const thisWeek = periodStats(summarizeDays(lastNDays(today, 7), data, settings));
    const lastWeek = periodStats(summarizeDays(lastNDays(addDays(today, -7), 7), data, settings));
    return {
      summary,
      ma,
      period: periodStats(summary),
      weightChange: firstMa != null && lastMa != null ? round2(lastMa - firstMa) : null,
      pStreak: proteinStreak(proteinByDate, today, settings.proteinG),
      wStreak: workoutStreak(today, settings, data.sessions),
      comp: compliance(days, today, settings, data.sessions),
      top: topProteinFoods(data.entries.filter((e) => daySet.has(e.date))),
      thisWeek: { ...thisWeek, avgWeight: movingAverage(data.weights, [today])[0] },
      lastWeek: { ...lastWeek, avgWeight: movingAverage(data.weights, [addDays(today, -7)])[0] },
      thisComp: compliance(lastNDays(today, 7), today, settings, data.sessions),
      lastComp: compliance(lastNDays(addDays(today, -7), 7), today, settings, data.sessions),
    };
  }, [settings, data, range, today]);

  if (!settings || !v) return <PageLoading />;
  const { summary, period } = v;
  const kg = t("common.kg");

  return (
    <>
      <PageHeader title={t("stats.title")} />
      <div className="space-y-4">
        <Segmented value={range} onChange={setRange} options={(["7", "30", "90"] as const).map((id) => ({ id, label: t(`stats.ranges.${id}`) }))} />

        <div className="grid grid-cols-2 gap-3">
          <Card className="flex min-w-0 items-center gap-2.5 !p-3.5 min-[390px]:gap-3 min-[390px]:!p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gold/12 text-xl min-[390px]:size-12 min-[390px]:text-2xl">🔥</span>
            <div className="min-w-0">
              <div className="num text-2xl font-extrabold text-gold min-[390px]:text-3xl" data-testid="protein-streak">
                {v.pStreak}
              </div>
              <div className="text-xs leading-snug text-muted">{t("stats.proteinStreak", { n: v.pStreak })}</div>
            </div>
          </Card>
          <Card className="flex min-w-0 items-center gap-2.5 !p-3.5 min-[390px]:gap-3 min-[390px]:!p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-success/12 min-[390px]:size-12">
              <Flame className="size-6 text-success" />
            </span>
            <div className="min-w-0">
              <div className="num text-2xl font-extrabold text-success min-[390px]:text-3xl">{v.comp.pct == null ? "—" : `${v.comp.pct}%`}</div>
              <div className="text-xs leading-snug text-muted">
                {t("stats.commitment")} · {t("stats.workoutStreak", { n: v.wStreak })}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          <Stat icon={UtensilsCrossed} label={t("stats.avgKcal")} value={fmt(period.avgKcal)} sub={t("stats.loggedDays", { n: summary.filter((d) => d.logged).length })} />
          <Stat icon={Target} label={t("stats.avgProtein")} value={period.avgProtein == null ? "—" : fmt(period.avgProtein)} sub={t("common.units.g")} />
          <Stat icon={Footprints} label={t("stats.avgSteps")} value={fmt(period.avgSteps)} />
          <Stat icon={Dumbbell} label={t("stats.workoutDays")} value={period.workoutDays} sub={`${t("common.of")} ${range}`} />
          <Stat icon={Bike} label={t("stats.cycling")} value={fmt(period.cyclingKm, 1)} sub={t("common.km")} />
          <Stat icon={Scale} label={t("stats.weightChange")} value={<Signed n={v.weightChange} />} sub={kg} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>{t("stats.kcalVsTarget")}</CardTitle>
            <BarsVsTarget data={summary.map((d) => ({ date: d.date, value: d.logged ? d.kcal : null, target: d.targets.kcal }))} color="var(--kcal)" unit={t("common.kcal")} label={t("common.calories")} />
            <Legend items={[{ label: t("common.calories"), swatch: "var(--kcal)" }, { label: t("common.goal"), dashed: true }]} note={t("stats.belowTarget")} />
          </Card>
          <Card>
            <CardTitle>{t("stats.proteinVsTarget")}</CardTitle>
            <BarsVsTarget data={summary.map((d) => ({ date: d.date, value: d.logged ? d.protein : null, target: d.targets.protein }))} color="var(--protein)" unit={t("common.units.g")} label={t("common.protein")} />
            <Legend items={[{ label: t("common.protein"), swatch: "var(--protein)" }, { label: `${t("common.goal")} ${settings.proteinG}`, dashed: true }]} />
          </Card>
          <Card>
            <CardTitle>{t("stats.weightAvg")}</CardTitle>
            <WeightChart data={summary.map((d, i) => ({ date: d.date, weight: d.weight, avg: v.ma[i] }))} />
            <Legend items={[{ label: t("weight.daily"), swatch: "var(--muted)", faint: true }, { label: t("weight.avg7"), swatch: "var(--gold)" }]} />
          </Card>
          <Card>
            <CardTitle>{t("stats.stepsChart")}</CardTitle>
            <SimpleBars data={summary.map((d) => ({ date: d.date, value: d.steps }))} color="var(--success)" unit="" label={t("stats.stepsChart")} goal={settings.stepsGoal} />
            <Legend items={[{ label: t("stats.stepsChart"), swatch: "var(--success)" }, { label: `${t("common.goal")} ${fmt(settings.stepsGoal)}`, dashed: true }]} />
          </Card>
          <Card>
            <CardTitle icon={Bike}>{t("stats.cyclingChart")}</CardTitle>
            <SimpleBars data={summary.map((d) => ({ date: d.date, value: d.cyclingKm || null }))} color="var(--carbs)" unit={t("common.km")} label={t("stats.cycling")} />
          </Card>
          <Card>
            <CardTitle>{t("stats.topProtein")}</CardTitle>
            {v.top.length === 0 ? (
              <Empty>{t("stats.emptyFoods")}</Empty>
            ) : (
              <ol className="space-y-3">
                {v.top.map((f, i) => (
                  <li key={f.name} className="flex items-center gap-3">
                    <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-gold/15 text-sm font-bold text-gold">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{f.name}</span>
                        <span className="num shrink-0 font-semibold">
                          {fmt(f.protein, 1)} {t("common.units.g")}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-track">
                        <div className="h-full rounded-full bg-protein" style={{ width: `${(f.protein / v.top[0].protein) * 100}%` }} />
                      </div>
                      <div className="mt-0.5 text-xs text-muted">{t("stats.times", { n: f.count })}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <Card>
          <CardTitle>{t("stats.compare")}</CardTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 text-start font-medium" />
                <th className="py-1 font-medium">{t("stats.thisWeek")}</th>
                <th className="py-1 font-medium">{t("stats.lastWeek")}</th>
                <th className="py-1 font-medium">{t("stats.diff")}</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-line">
              <CompareRow label={t("common.calories")} a={v.thisWeek.avgKcal} b={v.lastWeek.avgKcal} />
              <CompareRow label={`${t("common.protein")} (${t("common.units.g")})`} a={v.thisWeek.avgProtein} b={v.lastWeek.avgProtein} digits={1} />
              <CompareRow label={t("stats.stepsChart")} a={v.thisWeek.avgSteps} b={v.lastWeek.avgSteps} />
              <CompareRow label={t("stats.workoutDays")} a={v.thisWeek.workoutDays} b={v.lastWeek.workoutDays} />
              <CompareRow label={`${t("stats.commitment")} %`} a={v.thisComp.pct} b={v.lastComp.pct} />
              <CompareRow label={`${t("stats.cycling")} (${t("common.km")})`} a={v.thisWeek.cyclingKm} b={v.lastWeek.cyclingKm} digits={1} />
              <CompareRow label={`${t("stats.avgWeight")} (${kg})`} a={v.thisWeek.avgWeight} b={v.lastWeek.avgWeight} digits={2} neutral />
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">{t("stats.compareNote")}</p>
        </Card>
      </div>
    </>
  );
}

function CompareRow({ label, a, b, digits = 0, neutral }: { label: string; a: number | null; b: number | null; digits?: number; neutral?: boolean }) {
  const diff = a != null && b != null ? Math.round((a - b) * 10 ** digits) / 10 ** digits : null;
  const cls = neutral || diff == null || diff === 0 ? "text-muted" : diff > 0 ? "text-success" : "text-gold";
  return (
    <tr>
      <td className="py-2.5 text-start font-sans">{label}</td>
      <td className="py-2.5 text-center font-semibold">{fmt(a, digits)}</td>
      <td className="py-2.5 text-center text-muted">{fmt(b, digits)}</td>
      <td className={`py-2.5 text-center text-xs font-semibold ${cls}`}>
        <Signed n={diff} digits={digits} />
      </td>
    </tr>
  );
}

function Legend({ items, note }: { items: { label: string; swatch?: string; dashed?: boolean; faint?: boolean }[]; note?: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? (
            <span className="inline-block w-4 border-t-2 border-dashed border-fg/50" />
          ) : (
            <span className="inline-block size-2.5 rounded-sm" style={{ background: it.swatch, opacity: it.faint ? 0.5 : 1 }} />
          )}
          {it.label}
        </span>
      ))}
      {note && <span>· {note}</span>}
    </div>
  );
}
