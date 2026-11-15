// حسابات: المتوسط المتحرك، تجميع الأيام، السلاسل، التنبيهات، والاقتراحات
// (دوال صافية بدون قاعدة بيانات، تشتغل في المتصفح وعلى السيرفر للتقرير)

import { addDays, lastNDays } from "./dates";
import { round1, scaleMacros } from "./food-match";
import { computeTargets, resolveDayType, type Targets } from "./targets";
import type { DayType, Food, FoodEntry, Macros, Session, Settings } from "./types";

export function sumMacros(items: Macros[]): Macros {
  const t = items.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** المتوسط المتحرك لآخر `window` أيام (من القياسات الموجودة فقط) */
export function movingAverage(weights: Map<string, number>, days: string[], window = 7): (number | null)[] {
  return days.map((d) => {
    const vals: number[] = [];
    for (let i = 0; i < window; i++) {
      const v = weights.get(addDays(d, -i));
      if (v != null) vals.push(v);
    }
    return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
}

/** التغير في متوسط 7 أيام بين `end` وقبله بأسبوع (يحتاج 3 قياسات على الأقل بكل أسبوع) */
export function weeklyAvgChange(weights: Map<string, number>, end: string): number | null {
  const [prev, cur] = movingAverage(weights, [addDays(end, -7), end]);
  if (prev == null || cur == null) return null;
  const count = (e: string) => lastNDays(e, 7).filter((d) => weights.has(d)).length;
  if (count(end) < 3 || count(addDays(end, -7)) < 3) return null;
  return round2(cur - prev);
}

export interface RawData {
  entries: FoodEntry[];
  weights: Map<string, number>;
  steps: Map<string, number>;
  sessions: Map<string, Session>;
  overrides: Map<string, DayType>;
}

export interface DaySummary extends Macros {
  date: string;
  logged: boolean;
  dayType: DayType;
  targets: Targets;
  steps: number | null;
  weight: number | null;
  session?: Session;
  workoutDone: boolean;
  cyclingKm: number;
}

export function summarizeDays(days: string[], data: RawData, s: Settings): DaySummary[] {
  const byDate = new Map<string, FoodEntry[]>();
  for (const e of data.entries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  return days.map((date) => {
    const entries = byDate.get(date) ?? [];
    const session = data.sessions.get(date);
    const info = resolveDayType(date, s, { override: data.overrides.get(date), session });
    return {
      date,
      ...sumMacros(entries),
      logged: entries.length > 0,
      dayType: info.type,
      targets: computeTargets(info.type, s),
      steps: data.steps.get(date) ?? null,
      weight: data.weights.get(date) ?? null,
      session,
      workoutDone: !!session?.done && session.type !== "rest",
      cyclingKm: session?.km ? round1(session.km) : 0,
    };
  });
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export interface PeriodStats {
  avgKcal: number | null;
  avgProtein: number | null;
  avgSteps: number | null;
  workoutDays: number;
  cyclingKm: number;
  avgWeight: number | null;
}

/** المتوسطات تحسب الأيام اللي سجلت فيها فقط */
export function periodStats(days: DaySummary[]): PeriodStats {
  const logged = days.filter((d) => d.logged);
  const stepDays = days.filter((d) => d.steps != null);
  const weightDays = days.filter((d) => d.weight != null);
  const k = avg(logged.map((d) => d.kcal));
  const p = avg(logged.map((d) => d.protein));
  const st = avg(stepDays.map((d) => d.steps!));
  const w = avg(weightDays.map((d) => d.weight!));
  return {
    avgKcal: k == null ? null : Math.round(k),
    avgProtein: p == null ? null : round1(p),
    avgSteps: st == null ? null : Math.round(st),
    workoutDays: days.filter((d) => d.workoutDone).length,
    cyclingKm: round1(days.reduce((a, d) => a + d.cyclingKm, 0)),
    avgWeight: w == null ? null : round2(w),
  };
}

/** أيام متتالية وصلت فيها هدف البروتين. إذا اليوم لسا ما وصل نبدأ من أمس */
export function proteinStreak(proteinByDate: Map<string, number>, end: string, goal: number): number {
  let d = end;
  if ((proteinByDate.get(d) ?? 0) < goal) d = addDays(d, -1);
  let n = 0;
  while ((proteinByDate.get(d) ?? 0) >= goal) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function topProteinFoods(entries: FoodEntry[], n = 5): { name: string; protein: number; count: number }[] {
  const m = new Map<string, { protein: number; count: number }>();
  for (const e of entries) {
    if (e.quick || e.protein <= 0) continue; // السعرات السريعة ما فيها بروتين
    const r = m.get(e.name) ?? { protein: 0, count: 0 };
    r.protein += e.protein;
    r.count++;
    m.set(e.name, r);
  }
  return [...m.entries()]
    .map(([name, r]) => ({ name, protein: round1(r.protein), count: r.count }))
    .sort((a, b) => b.protein - a.protein)
    .slice(0, n);
}

// ---------- التنبيهات الصحية ----------

export type AlertKind = "lowKcal" | "lowProtein" | "weightLoss";
export interface HealthAlert {
  id: string;
  kind: AlertKind;
  level: "info" | "warn";
  /** اليوم أو أمس */
  when: "today" | "yesterday";
  value: number;
  limit: number;
}

/**
 * @param dayEnded هل انتهى اليوم (أمس، أو اليوم بعد الساعة 9 بالليل)
 * @param weeklyChange تغير متوسط الوزن عن الأسبوع الماضي (سالب = نزول)
 */
export function healthAlerts(day: DaySummary, dayEnded: boolean, weeklyChange: number | null, s: Settings, when: "today" | "yesterday"): HealthAlert[] {
  const out: HealthAlert[] = [];
  if (dayEnded && day.logged && day.kcal < s.lowKcalAlert) {
    out.push({ id: `lowKcal-${day.date}`, kind: "lowKcal", level: "warn", when, value: day.kcal, limit: s.lowKcalAlert });
  }
  if (dayEnded && day.logged && day.protein < s.lowProteinAlert) {
    out.push({ id: `lowProtein-${day.date}`, kind: "lowProtein", level: "info", when, value: day.protein, limit: s.lowProteinAlert });
  }
  if (weeklyChange != null && weeklyChange < -s.weeklyLossAlertKg) {
    out.push({ id: `weightLoss-${day.date}`, kind: "weightLoss", level: "warn", when, value: Math.abs(weeklyChange), limit: s.weeklyLossAlertKg });
  }
  return out;
}

// ---------- اقتراح أكلة تكمّل البروتين ----------

export interface Suggestion {
  food: Food;
  /** كمية مرجعية للعرض فقط (آخر كمية استخدمتها أو الكمية المرجعية). الكمية الفعلية تكتبها أنت */
  amount: number;
  protein: number;
  kcal: number;
}

export function suggestProtein(remainingProtein: number, remainingKcal: number, foods: Food[], recentIds: Set<string>, limit = 3): Suggestion[] {
  if (remainingProtein <= 3) return [];
  return foods
    .filter((f) => f.refAmount > 0 && f.kcal > 0 && (f.protein * 4) / f.kcal >= 0.3 && f.protein / f.refAmount >= 0.06)
    .map((f) => {
      const amount = f.lastAmount ?? f.refAmount;
      const m = scaleMacros(f, amount, f.refAmount);
      const density = (f.protein * 4) / f.kcal;
      const fit = 1 - Math.min(Math.abs(remainingProtein - m.protein) / Math.max(remainingProtein, 1), 1);
      const kcalPenalty = remainingKcal > 0 && m.kcal > remainingKcal + 150 ? 0.5 : 0;
      const score = density + fit * 0.6 + (recentIds.has(f.id) ? 0.5 : 0) - kcalPenalty;
      return { food: f, amount, protein: m.protein, kcal: m.kcal, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...rest }) => rest);
}
