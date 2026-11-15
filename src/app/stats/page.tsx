"use client";

import { useMemo, useState } from "react";
import { BarsVsTarget, SimpleBars, WeightChart } from "@/components/charts";
import { Card, CardTitle, Empty, PageHeader, Segmented, Stat, fmt } from "@/components/ui";
import { addDays, lastNDays } from "@/lib/dates";
import { useRange, useSettings, useToday } from "@/lib/hooks";
import { movingAverage, periodStats, proteinStreak, round2, summarizeDays, topProteinFoods } from "@/lib/stats";

type Range = "7" | "30" | "90";
const HISTORY = 180;

export default function StatsPage() {
  const today = useToday();
  const settings = useSettings();
  const [range, setRange] = useState<Range>("7");
  const data = useRange(addDays(today, -HISTORY), today);

  const v = useMemo(() => {
    if (!settings || !data) return null;
    const n = Number(range);
    const days = lastNDays(today, n);
    const summary = summarizeDays(days, data, settings);
    const period = periodStats(summary);
    const ma = movingAverage(data.weights, days);
    const firstMa = ma.find((x) => x != null) ?? null;
    const lastMa = [...ma].reverse().find((x) => x != null) ?? null;

    const proteinByDate = new Map<string, number>();
    for (const e of data.entries) proteinByDate.set(e.date, (proteinByDate.get(e.date) ?? 0) + e.protein);
    const streak = proteinStreak(proteinByDate, today, settings.proteinG);

    const daySet = new Set(days);
    const top = topProteinFoods(data.entries.filter((e) => daySet.has(e.date)));

    const thisWeek = periodStats(summarizeDays(lastNDays(today, 7), data, settings));
    const lastWeek = periodStats(summarizeDays(lastNDays(addDays(today, -7), 7), data, settings));
    const thisMa = movingAverage(data.weights, [today])[0];
    const lastMa7 = movingAverage(data.weights, [addDays(today, -7)])[0];

    return {
      summary,
      period,
      weightChange: firstMa != null && lastMa != null ? round2(lastMa - firstMa) : null,
      ma,
      streak,
      top,
      thisWeek: { ...thisWeek, avgWeight: thisMa },
      lastWeek: { ...lastWeek, avgWeight: lastMa7 },
    };
  }, [settings, data, range, today]);

  if (!settings || !v) return null;
  const { summary, period } = v;
  const loggedDays = summary.filter((d) => d.logged).length;

  return (
    <>
      <PageHeader title="الإحصائيات" />
      <div className="space-y-4">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { id: "7", label: "أسبوع" },
            { id: "30", label: "شهر" },
            { id: "90", label: "3 شهور" },
          ]}
        />

        <Card className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            🔥
          </span>
          <div>
            <div className="text-2xl font-bold tabular-nums">{v.streak} {v.streak === 1 ? "يوم" : "أيام"}</div>
            <div className="text-sm text-muted">متتالية وصلت فيها هدف البروتين ({settings.proteinG} غ)</div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="متوسط السعرات" value={fmt(period.avgKcal)} sub={`${loggedDays} يوم مسجل`} />
          <Stat label="متوسط البروتين" value={period.avgProtein == null ? "—" : `${fmt(period.avgProtein)} غ`} />
          <Stat label="متوسط الخطوات" value={fmt(period.avgSteps)} />
          <Stat label="أيام التمرين" value={period.workoutDays} sub={`من ${range}`} />
          <Stat label="السيكل" value={`${fmt(period.cyclingKm, 1)}`} sub="كم" />
          <Stat
            label="تغير متوسط الوزن"
            value={v.weightChange == null ? "—" : <span dir="ltr">{`${v.weightChange > 0 ? "+" : ""}${v.weightChange.toFixed(1)}`}</span>}
            sub="كغ"
          />
        </div>

        <Card>
          <CardTitle>السعرات اليومية مقابل الهدف</CardTitle>
          <BarsVsTarget data={summary.map((d) => ({ date: d.date, value: d.logged ? d.kcal : null, target: d.targets.kcal }))} color="var(--kcal)" unit="سعرة" label="السعرات" />
          <Legend items={[{ label: "السعرات", swatch: "var(--kcal)" }, { label: "الهدف", dashed: true }]} note="العمود الباهت = أقل من الهدف" />
        </Card>

        <Card>
          <CardTitle>البروتين اليومي مقابل الهدف</CardTitle>
          <BarsVsTarget data={summary.map((d) => ({ date: d.date, value: d.logged ? d.protein : null, target: d.targets.protein }))} color="var(--protein)" unit="غ" label="البروتين" />
          <Legend items={[{ label: "البروتين", swatch: "var(--protein)" }, { label: `الهدف ${settings.proteinG} غ`, dashed: true }]} />
        </Card>

        <Card>
          <CardTitle>متوسط الوزن (7 أيام)</CardTitle>
          <WeightChart data={summary.map((d, i) => ({ date: d.date, weight: d.weight, avg: v.ma[i] }))} />
          <Legend items={[{ label: "الوزن اليومي", swatch: "var(--muted)", faint: true }, { label: "متوسط 7 أيام", swatch: "var(--brand)" }]} />
        </Card>

        <Card>
          <CardTitle>الخطوات</CardTitle>
          <SimpleBars data={summary.map((d) => ({ date: d.date, value: d.steps }))} color="var(--brand)" unit="خطوة" label="الخطوات" goal={settings.stepsGoal} />
          <Legend items={[{ label: "الخطوات", swatch: "var(--brand)" }, { label: `الهدف ${fmt(settings.stepsGoal)}`, dashed: true }]} />
        </Card>

        <Card>
          <CardTitle>الكيلومترات على السيكل 🚴</CardTitle>
          <SimpleBars data={summary.map((d) => ({ date: d.date, value: d.cyclingKm || null }))} color="var(--fat)" unit="كم" label="السيكل" />
        </Card>

        <Card>
          <CardTitle>أكثر 5 أكلات أعطتني بروتين</CardTitle>
          {v.top.length === 0 ? (
            <Empty>ما فيه أكل مسجل في هذي الفترة</Empty>
          ) : (
            <ol className="space-y-2">
              {v.top.map((f, i) => (
                <li key={f.name} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-protein/15 text-sm font-bold text-protein">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="shrink-0 tabular-nums font-semibold">{fmt(f.protein, 1)} غ</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-track">
                      <div className="h-full rounded-full bg-protein" style={{ width: `${(f.protein / v.top[0].protein) * 100}%` }} />
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{f.count} مرة</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardTitle>هذا الأسبوع مقابل الأسبوع اللي قبله</CardTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 text-start font-medium"></th>
                <th className="py-1 font-medium">هذا الأسبوع</th>
                <th className="py-1 font-medium">اللي قبله</th>
                <th className="py-1 font-medium">الفرق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              <CompareRow label="السعرات" a={v.thisWeek.avgKcal} b={v.lastWeek.avgKcal} />
              <CompareRow label="البروتين (غ)" a={v.thisWeek.avgProtein} b={v.lastWeek.avgProtein} digits={1} />
              <CompareRow label="الخطوات" a={v.thisWeek.avgSteps} b={v.lastWeek.avgSteps} />
              <CompareRow label="أيام التمرين" a={v.thisWeek.workoutDays} b={v.lastWeek.workoutDays} />
              <CompareRow label="السيكل (كم)" a={v.thisWeek.cyclingKm} b={v.lastWeek.cyclingKm} digits={1} />
              <CompareRow label="متوسط الوزن" a={v.thisWeek.avgWeight} b={v.lastWeek.avgWeight} digits={2} neutral />
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">المتوسطات تحسب الأيام اللي سجلت فيها فقط. الأسبوع = آخر 7 أيام.</p>
        </Card>
      </div>
    </>
  );
}

function CompareRow({ label, a, b, digits = 0, neutral }: { label: string; a: number | null; b: number | null; digits?: number; neutral?: boolean }) {
  const diff = a != null && b != null ? a - b : null;
  const sign = diff == null ? "" : diff > 0 ? "+" : "";
  const cls = neutral || diff == null || diff === 0 ? "text-muted" : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  return (
    <tr>
      <td className="py-2 text-start">{label}</td>
      <td className="py-2 text-center font-semibold">{fmt(a, digits)}</td>
      <td className="py-2 text-center text-muted">{fmt(b, digits)}</td>
      <td className={`py-2 text-center text-xs font-semibold ${cls}`} dir="ltr">{diff == null ? "—" : `${sign}${fmt(diff, digits)}`}</td>
    </tr>
  );
}

function Legend({ items, note }: { items: { label: string; swatch?: string; dashed?: boolean; faint?: boolean }[]; note?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.dashed ? (
            <span className="inline-block w-4 border-t-2 border-dashed border-fg/50" />
          ) : (
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.swatch, opacity: it.faint ? 0.5 : 1 }} />
          )}
          {it.label}
        </span>
      ))}
      {note && <span>· {note}</span>}
    </div>
  );
}
