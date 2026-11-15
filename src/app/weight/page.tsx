"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { WeightChart } from "@/components/charts";
import { Button, Card, CardTitle, Empty, Field, Input, PageHeader, Segmented, Stat, fmt } from "@/components/ui";
import { addDays, formatDay, lastNDays } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { useToday } from "@/lib/hooks";
import { movingAverage, weeklyAvgChange } from "@/lib/stats";

type Range = "30" | "90" | "365";

export default function WeightPage() {
  const today = useToday();
  const [range, setRange] = useState<Range>("30");
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today);
  const [waist, setWaist] = useState("");

  const weights = useLiveQuery(() => getDb().weights.orderBy("date").toArray(), []);
  const waists = useLiveQuery(() => getDb().waists.orderBy("date").reverse().toArray(), []);
  if (!weights) return null;

  const map = new Map(weights.map((w) => [w.date, w.kg]));
  const days = lastNDays(today, Number(range));
  const avgs = movingAverage(map, days);
  const chart = days.map((d, i) => ({ date: d, weight: map.get(d) ?? null, avg: avgs[i] }));
  const currentAvg = movingAverage(map, [today])[0];
  const change = weeklyAvgChange(map, today);
  const lastWaist = waists?.[0];
  const waistThisWeek = lastWaist && lastWaist.date > addDays(today, -7);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(kg.replace(",", "."));
    if (!(v > 20 && v < 300)) return;
    await getDb().weights.put({ date, kg: Math.round(v * 10) / 10 });
    setKg("");
  };

  return (
    <>
      <PageHeader title="الوزن" />
      <div className="space-y-4">
        <Card>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="الوزن (كغ)">
                <Input type="number" inputMode="decimal" step="0.1" placeholder={map.get(today) ? String(map.get(today)) : "75.0"} value={kg} onChange={(e) => setKg(e.target.value)} aria-label="الوزن بالكيلو" />
              </Field>
              <Field label="التاريخ">
                <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
              </Field>
            </div>
            <Button type="submit" className="w-full" disabled={!kg}>
              {map.has(date) ? "حدّث الوزن" : "سجّل الوزن"}
            </Button>
          </form>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="اليوم" value={map.has(today) ? fmt(map.get(today), 1) : "—"} sub="كغ" />
          <Stat label="متوسط 7 أيام" value={fmt(currentAvg, 1)} sub="كغ" />
          <Stat
            label="تغير المتوسط"
            value={change == null ? "—" : <span dir="ltr">{`${change > 0 ? "+" : ""}${change.toFixed(2)}`}</span>}
            sub="عن الأسبوع الماضي"
          />
        </div>

        <Card>
          <CardTitle action={<div className="w-44"><Segmented value={range} onChange={setRange} options={[{ id: "30", label: "شهر" }, { id: "90", label: "3 شهور" }, { id: "365", label: "سنة" }]} /></div>}>
            الرسم البياني
          </CardTitle>
          <WeightChart data={chart} />
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded bg-muted opacity-50" /> الوزن اليومي
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1 w-4 rounded bg-brand" /> متوسط 7 أيام
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">الوزن اليومي يتغير بسبب الماء والأكل. المتوسط هو اللي يوضح التغير الحقيقي.</p>
        </Card>

        <Card>
          <CardTitle>مقاس الخصر (مرة بالأسبوع، اختياري)</CardTitle>
          {!waistThisWeek && (
            <form
              className="mb-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const v = parseFloat(waist);
                if (!(v > 30 && v < 200)) return;
                await getDb().waists.put({ date: today, cm: v });
                setWaist("");
              }}
            >
              <Input type="number" inputMode="decimal" step="0.5" placeholder="سم" value={waist} onChange={(e) => setWaist(e.target.value)} aria-label="مقاس الخصر بالسم" />
              <Button type="submit" disabled={!waist}>
                سجّل
              </Button>
            </form>
          )}
          {waistThisWeek && <p className="mb-2 text-sm text-muted">سجلت مقاس الخصر هذا الأسبوع ✓</p>}
          {waists && waists.length > 0 ? (
            <ul className="divide-y divide-line text-sm">
              {waists.slice(0, 8).map((w) => (
                <li key={w.date} className="flex justify-between py-2">
                  <span className="text-muted">{formatDay(w.date)}</span>
                  <span className="flex items-center gap-2 font-semibold tabular-nums">
                    {w.cm} سم
                    <button className="text-muted" aria-label="حذف" onClick={() => getDb().waists.delete(w.date)}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>ما فيه قياسات</Empty>
          )}
        </Card>

        <Card>
          <CardTitle>آخر القياسات</CardTitle>
          {weights.length === 0 ? (
            <Empty>سجل وزنك كل يوم الصبح بعد الحمام وقبل الأكل</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {[...weights].reverse().slice(0, 14).map((w) => (
                <li key={w.date} className="flex justify-between py-2">
                  <span className="text-muted">{formatDay(w.date)}</span>
                  <span className="flex items-center gap-2 font-semibold tabular-nums">
                    {w.kg.toFixed(1)} كغ
                    <button className="text-muted" aria-label={`حذف وزن ${w.date}`} onClick={() => getDb().weights.delete(w.date)}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
