"use client";

// رسوم بيانية مبنية على Recharts. محور الوقت معكوس (الأحدث على اليسار) ليناسب القراءة من اليمين لليسار.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { shortDay } from "@/lib/dates";

const AXIS = { fontSize: 11, fill: "var(--muted)" };
const GRID = <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  const locale = useLocale();
  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="rounded-2xl bg-card px-3 py-2 text-xs shadow-soft ring-1 ring-line">
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          {r.color && <span className="inline-block size-2.5 rounded-full" style={{ background: r.color }} />}
          <span className="text-muted">{r.label}</span>
          <span className="ms-auto font-semibold tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function xTicks(n: number) {
  return n <= 8 ? 0 : n <= 31 ? Math.ceil(n / 6) - 1 : Math.ceil(n / 6) - 1;
}

// ---------- الوزن ----------

export interface WeightPoint {
  date: string;
  weight: number | null;
  avg: number | null;
}

export function WeightChart({ data, height = 220 }: { data: WeightPoint[]; height?: number }) {
  const t = useTranslations();
  const rtl = useLocale() === "ar";
  const vals = data.flatMap((d) => [d.weight, d.avg]).filter((v): v is number => v != null);
  if (!vals.length) return <ChartEmpty height={height} />;
  const min = Math.floor(Math.min(...vals) - 0.5);
  const max = Math.ceil(Math.max(...vals) + 0.5);
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          {GRID}
          <XAxis dataKey="date" reversed={rtl} padding={{ left: 10, right: 6 }} tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} interval={xTicks(data.length)} />
          <YAxis orientation={rtl ? "right" : "left"} domain={[min, max]} tick={AXIS} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={shortDay(String(label))}
                  rows={[
                    { label: t("weight.daily"), value: fmtKg(payload[0]?.payload.weight, t("common.kg")), color: "var(--muted)" },
                    { label: t("weight.avg7"), value: fmtKg(payload[0]?.payload.avg, t("common.kg")), color: "var(--gold)" },
                  ]}
                />
              ) : null
            }
          />
          <Line type="monotone" dataKey="weight" stroke="var(--muted)" strokeOpacity={0.45} strokeWidth={1.5} dot={{ r: 2.5, fill: "var(--muted)", fillOpacity: 0.5, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
          <Line type="monotone" dataKey="avg" stroke="var(--gold)" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const fmtKg = (v: number | null | undefined, unit: string) => (v == null ? "—" : `${v.toFixed(1)} ${unit}`);

// ---------- قيمة يومية مقابل هدف ----------

export interface TargetPoint {
  date: string;
  value: number | null;
  target: number;
}

export function BarsVsTarget({
  data,
  color,
  unit,
  label,
  height = 200,
}: {
  data: TargetPoint[];
  color: string;
  unit: string;
  label: string;
  height?: number;
}) {
  const t = useTranslations("common");
  const rtl = useLocale() === "ar";
  if (!data.some((d) => d.value != null && d.value > 0)) return <ChartEmpty height={height} />;
  const many = data.length > 40;
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={many ? 1 : "20%"}>
          {GRID}
          <XAxis dataKey="date" reversed={rtl} padding={{ left: 10, right: 6 }} tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} interval={xTicks(data.length)} />
          <YAxis orientation={rtl ? "right" : "left"} tick={AXIS} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: "var(--track)", opacity: 0.6 }}
            content={({ active, payload, label: l }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TargetPoint;
              return (
                <TooltipBox
                  title={shortDay(String(l))}
                  rows={[
                    { label, value: p.value == null ? "—" : `${Math.round(p.value)} ${unit}`, color },
                    { label: t("goal"), value: `${p.target} ${unit}` },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.date} fill={color} fillOpacity={d.value != null && d.value >= d.target ? 1 : 0.55} />
            ))}
          </Bar>
          <Line type="stepAfter" dataKey="target" stroke="var(--fg)" strokeOpacity={data.length > 31 ? 0.4 : 0.55} strokeDasharray={data.length > 31 ? undefined : "4 3"} strokeWidth={data.length > 31 ? 1 : 1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- أعمدة بسيطة ----------

export function SimpleBars({
  data,
  color,
  unit,
  label,
  goal,
  height = 180,
}: {
  data: { date: string; value: number | null }[];
  color: string;
  unit: string;
  label: string;
  goal?: number;
  height?: number;
}) {
  const rtl = useLocale() === "ar";
  if (!data.some((d) => d.value != null && d.value > 0)) return <ChartEmpty height={height} />;
  return (
    <div dir="ltr" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={data.length > 40 ? 1 : "20%"}>
          {GRID}
          <XAxis dataKey="date" reversed={rtl} padding={{ left: 10, right: 6 }} tickFormatter={shortDay} tick={AXIS} axisLine={false} tickLine={false} interval={xTicks(data.length)} />
          <YAxis orientation={rtl ? "right" : "left"} tick={AXIS} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
          <Tooltip
            cursor={{ fill: "var(--track)", opacity: 0.6 }}
            content={({ active, payload, label: l }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={shortDay(String(l))}
                  rows={[{ label, value: payload[0].value == null ? "—" : `${Number(payload[0].value).toLocaleString("en-US")} ${unit}`, color }]}
                />
              ) : null
            }
          />
          {goal != null && <ReferenceLine y={goal} stroke="var(--fg)" strokeOpacity={0.55} strokeDasharray="4 3" />}
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- دائرة توزيع الماكروز ----------

export function MacroDonut({ protein, carbs, fat, size = 140 }: { protein: number; carbs: number; fat: number; size?: number }) {
  const t = useTranslations();
  const data = [
    { name: "protein", kcal: protein * 4, color: "var(--protein)" },
    { name: "carbs", kcal: carbs * 4, color: "var(--carbs)" },
    { name: "fat", kcal: fat * 9, color: "var(--fat)" },
  ];
  const total = data.reduce((a, d) => a + d.kcal, 0);
  return (
    <div style={{ width: size, height: size }} className="relative shrink-0" role="img" aria-label={t("home.distribution")}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          {total === 0 ? (
            <Pie data={[{ v: 1 }]} dataKey="v" innerRadius="70%" outerRadius="100%" fill="var(--track)" stroke="none" isAnimationActive={false} />
          ) : (
            <Pie
              data={data}
              dataKey="kcal"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
              cornerRadius={4}
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="num text-xl font-bold">{total ? `${Math.round(((protein * 4) / total) * 100)}%` : "—"}</div>
          <div className="text-[11px] text-muted">{t("common.protein")}</div>
        </div>
      </div>
    </div>
  );
}

export function ChartEmpty({ height }: { height: number }) {
  const t = useTranslations("common");
  return (
    <div style={{ height }} className="grid place-items-center rounded-2xl bg-track/40 text-sm text-muted">
      {t("noData")}
    </div>
  );
}
