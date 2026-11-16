"use client";

import { PageLoading } from "@/components/PageLoading";
import { useLiveQuery } from "dexie-react-hooks";
import { Ruler, Scale, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { WeightChart } from "@/components/charts";
import { Button, Card, CardTitle, Empty, Field, IconButton, Input, PageHeader, Segmented, Signed, Stat, fmt, useDayLabel } from "@/components/ui";
import { addDays, lastNDays } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { useToday } from "@/lib/hooks";
import { putRow, removeRow } from "@/lib/repo";
import { movingAverage, weeklyAvgChange } from "@/lib/stats";

type Range = "30" | "90" | "365";

export default function WeightPage() {
  const t = useTranslations();
  const today = useToday();
  const dayLabel = useDayLabel();
  const [range, setRange] = useState<Range>("30");
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today);
  const [waist, setWaist] = useState("");
  const weights = useLiveQuery(() => getDb().weights.orderBy("date").toArray(), []);
  const waists = useLiveQuery(() => getDb().waists.orderBy("date").reverse().toArray(), []);
  if (!weights) return <PageLoading />;

  const map = new Map(weights.map((w) => [w.date, w.kg]));
  const days = lastNDays(today, Number(range));
  const avgs = movingAverage(map, days);
  const chart = days.map((d, i) => ({ date: d, weight: map.get(d) ?? null, avg: avgs[i] }));
  const currentAvg = movingAverage(map, [today])[0];
  const change = weeklyAvgChange(map, today);
  const waistThisWeek = waists?.[0] && waists[0].date > addDays(today, -7);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(kg.replace(",", "."));
    if (!(v > 20 && v < 300)) return;
    await putRow("weights", { id: date, date, kg: Math.round(v * 10) / 10 });
    setKg("");
  };

  return (
    <>
      <PageHeader title={t("weight.title")} />
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle icon={Scale}>{t("weight.save")}</CardTitle>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("weight.label")}>
                  <Input type="number" inputMode="decimal" step="0.1" placeholder={map.get(date)?.toFixed(1) ?? "75.0"} value={kg} onChange={(e) => setKg(e.target.value)} aria-label={t("weight.label")} className="num text-xl font-bold" />
                </Field>
                <Field label={t("weight.date")}>
                  <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
                </Field>
              </div>
              <Button type="submit" className="w-full" disabled={!kg}>
                {map.has(date) ? t("weight.update") : t("weight.save")}
              </Button>
            </form>
          </Card>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
            <Stat label={t("weight.today")} value={map.has(today) ? fmt(map.get(today), 1) : "—"} sub={t("common.kg")} />
            <Stat label={t("weight.avg7")} value={fmt(currentAvg, 1)} sub={t("common.kg")} />
            <Stat label={t("weight.change")} value={<Signed n={change} digits={2} />} sub={t("weight.vsLastWeek")} />
          </div>
        </div>

        <Card>
          <CardTitle
            action={
              <div className="w-48">
                <Segmented value={range} onChange={setRange} options={(["30", "90", "365"] as const).map((id) => ({ id, label: t(`weight.ranges.${id}`) }))} />
              </div>
            }
          >
            {t("weight.chart")}
          </CardTitle>
          <WeightChart data={chart} />
          <div className="mt-3 flex items-center justify-center gap-5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded bg-muted opacity-50" /> {t("weight.daily")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 w-4 rounded bg-gold" /> {t("weight.avg7")}
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t("weight.note")}</p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle icon={Ruler}>{t("weight.waist")}</CardTitle>
            {waistThisWeek ? (
              <p className="mb-2 text-sm font-medium text-success">{t("weight.waistDone")}</p>
            ) : (
              <form
                className="mb-3 flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const v = parseFloat(waist);
                  if (!(v > 30 && v < 200)) return;
                  await putRow("waists", { id: today, date: today, cm: v });
                  setWaist("");
                }}
              >
                <Input type="number" inputMode="decimal" step="0.5" placeholder={t("common.cm")} value={waist} onChange={(e) => setWaist(e.target.value)} aria-label={t("weight.waist")} />
                <Button type="submit" disabled={!waist}>
                  {t("common.save")}
                </Button>
              </form>
            )}
            {waists && waists.length > 0 ? (
              <ul className="divide-y divide-line text-sm">
                {waists.slice(0, 8).map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-2">
                    <span className="text-muted">{dayLabel(w.date, today)}</span>
                    <span className="num flex items-center gap-1 font-semibold">
                      {w.cm} {t("common.cm")}
                      <IconButton icon={Trash2} label={t("common.delete")} onClick={() => removeRow("waists", w.id)} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>—</Empty>
            )}
          </Card>

          <Card>
            <CardTitle>{t("weight.recent")}</CardTitle>
            {weights.length === 0 ? (
              <Empty>{t("weight.emptyHint")}</Empty>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {[...weights]
                  .reverse()
                  .slice(0, 14)
                  .map((w) => (
                    <li key={w.id} className="flex items-center justify-between py-1.5">
                      <span className="text-muted">{dayLabel(w.date, today)}</span>
                      <span className="num flex items-center gap-1 font-semibold">
                        {w.kg.toFixed(1)} {t("common.kg")}
                        <IconButton icon={Trash2} label={`${t("common.delete")} ${w.date}`} onClick={() => removeRow("weights", w.id)} />
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
