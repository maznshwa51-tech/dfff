// حسابات: المتوسط المتحرك، تجميع الأيام، السلاسل، التنبيهات، والاقتراحات

import { addDays, lastNDays } from "./dates";
import type { Food, FoodEntry, Workout } from "./db";
import { round1, type Macros } from "./food-match";
import { computeTargets, resolveDayType, type DayType, type Settings, type Targets } from "./targets";

export function sumMacros(items: Macros[]): Macros {
  const t = items.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

/**
 * المتوسط المتحرك لآخر `window` أيام لكل يوم في `days`.
 * يُحسب من القياسات الموجودة فقط ضمن النافذة (الأيام بدون وزن تُتجاهل).
 */
export function movingAverage(
  weights: Map<string, number>,
  days: string[],
  window = 7,
): (number | null)[] {
  return days.map((d) => {
    const vals: number[] = [];
    for (let i = 0; i < window; i++) {
      const v = weights.get(addDays(d, -i));
      if (v != null) vals.push(v);
    }
    return vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DaySummary extends Macros {
  date: string;
  logged: boolean;
  dayType: DayType;
  targets: Targets;
  steps: number | null;
  weight: number | null;
  workouts: Workout[];
  cyclingKm: number;
}

export interface RawData {
  entries: FoodEntry[];
  weights: Map<string, number>;
  steps: Map<string, number>;
  workouts: Workout[];
  overrides: Map<string, DayType>;
}

export function summarizeDays(days: string[], data: RawData, settings: Settings): DaySummary[] {
  const byDate = new Map<string, FoodEntry[]>();
  for (const e of data.entries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const wByDate = new Map<string, Workout[]>();
  for (const w of data.workouts) {
    const arr = wByDate.get(w.date) ?? [];
    arr.push(w);
    wByDate.set(w.date, arr);
  }
  return days.map((date) => {
    const entries = byDate.get(date) ?? [];
    const workouts = wByDate.get(date) ?? [];
    const info = resolveDayType(date, settings, {
      override: data.overrides.get(date),
      hasWorkout: workouts.length > 0,
    });
    return {
      date,
      ...sumMacros(entries),
      logged: entries.length > 0,
      dayType: info.type,
      targets: computeTargets(info.type, settings),
      steps: data.steps.get(date) ?? null,
      weight: data.weights.get(date) ?? null,
      workouts,
      cyclingKm: round1(workouts.reduce((a, w) => a + (w.distanceKm ?? 0), 0)),
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
  /** متوسط الوزن في الفترة */
  avgWeight: number | null;
}

/** المتوسطات تحسب فقط الأيام اللي سجلت فيها (عشان يوم ما سجلت فيه ما ينزّل المتوسط) */
export function periodStats(days: DaySummary[]): PeriodStats {
  const logged = days.filter((d) => d.logged);
  const stepDays = days.filter((d) => d.steps != null);
  const weightDays = days.filter((d) => d.weight != null);
  const a = (n: number | null, r = 0) => (n == null ? null : r ? round1(n) : Math.round(n));
  return {
    avgKcal: a(avg(logged.map((d) => d.kcal))),
    avgProtein: a(avg(logged.map((d) => d.protein)), 1),
    avgSteps: a(avg(stepDays.map((d) => d.steps!))),
    workoutDays: days.filter((d) => d.workouts.length > 0).length,
    cyclingKm: round1(days.reduce((s, d) => s + d.cyclingKm, 0)),
    avgWeight: (() => {
      const v = avg(weightDays.map((d) => d.weight!));
      return v == null ? null : round2(v);
    })(),
  };
}

/**
 * سلسلة الأيام المتتالية اللي وصلت فيها هدف البروتين، تنتهي باليوم `end`.
 * إذا اليوم نفسه لسا ما وصل للهدف، نبدأ العد من أمس (اليوم ما خلص).
 */
export function proteinStreak(
  proteinByDate: Map<string, number>,
  end: string,
  goal: number,
): number {
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

// ---------- التنبيهات ----------

export interface HealthAlert {
  id: string;
  level: "info" | "warn";
  title: string;
  body: string;
}

export const SNACK_IDEAS = [
  "ساندويتش خبز أسمر مع لبنة أو جبن",
  "موزة مع ملعقتين زبدة فول سوداني",
  "زبادي مع شوفان وتمر",
  "كوب حليب مع حفنة مكسرات",
];

/**
 * @param day ملخص اليوم المراد فحصه
 * @param dayEnded هل انتهى اليوم (أمس، أو اليوم بعد الساعة 9 بالليل)
 * @param weeklyChange التغير في متوسط الوزن (7 أيام) مقارنة بقبل أسبوع، سالب = نزول
 */
export function healthAlerts(
  day: DaySummary,
  dayEnded: boolean,
  weeklyChange: number | null,
  s: Settings,
  dayLabel = "اليوم",
): HealthAlert[] {
  const out: HealthAlert[] = [];
  if (dayEnded && day.logged && day.kcal < s.lowKcalAlert) {
    const idea = SNACK_IDEAS[new Date().getDate() % SNACK_IDEAS.length];
    out.push({
      id: `lowkcal-${day.date}`,
      level: "warn",
      title: `أكلك ${dayLabel} قليل 🍽️`,
      body: `أكلت ${day.kcal} سعرة بس، وهذا قليل على رياضي جسمه لسا يكبر. جسمك يحتاج طاقة عشان يكبر ويتعافى من التمرين. جرّب وجبة خفيفة زي: ${idea}.`,
    });
  }
  if (day.logged && day.protein < s.lowProteinAlert && dayEnded) {
    out.push({
      id: `lowprotein-${day.date}`,
      level: "info",
      title: "تذكير بالبروتين 💪",
      body: `البروتين ${dayLabel} ${day.protein} غ، أقل من ${s.lowProteinAlert} غ. البروتين يساعد عضلاتك تتعافى بعد الملاكمة.`,
    });
  }
  if (weeklyChange != null && weeklyChange < -s.weeklyLossAlertKg) {
    out.push({
      id: `weightloss-${day.date}`,
      level: "warn",
      title: "وزنك ينزل بسرعة ⚠️",
      body: `متوسط وزنك نزل ${Math.abs(weeklyChange).toFixed(2)} كغ خلال أسبوع، وهذا أسرع من اللازم لعمرك. زِد أكلك شوي (مثلاً سناك إضافي كل يوم)، وإذا استمر كلّم أهلك أو طبيب.`,
    });
  }
  return out;
}

/** التغير في المتوسط المتحرك (7 أيام) بين يوم `end` وقبله بأسبوع */
export function weeklyAvgChange(weights: Map<string, number>, end: string): number | null {
  const [prev, cur] = movingAverage(weights, [addDays(end, -7), end]);
  if (prev == null || cur == null) return null;
  // نحتاج على الأقل 3 قياسات في كل أسبوع عشان النتيجة تكون منطقية
  const count = (e: string) => lastNDays(e, 7).filter((d) => weights.has(d)).length;
  if (count(end) < 3 || count(addDays(end, -7)) < 3) return null;
  return round2(cur - prev);
}

// ---------- اقتراح أكلة لتكملة البروتين ----------

export interface Suggestion {
  food: Food;
  grams: number;
  label: string;
  protein: number;
  kcal: number;
}

/**
 * يقترح أكلات من القاعدة المحلية تكمّل البروتين الناقص.
 * يفضّل الأكلات الغنية بالبروتين مقابل السعرات، واللي أكلتها قبل.
 */
export function suggestProtein(
  remainingProtein: number,
  remainingKcal: number,
  foods: Food[],
  recentNames: Set<string>,
  limit = 3,
): Suggestion[] {
  if (remainingProtein <= 3) return [];
  return foods
    .filter((f) => f.serving && f.protein >= 8 && (f.protein * 4) / Math.max(f.kcal, 1) >= 0.3)
    .map((f) => {
      const grams = f.serving!.grams;
      const protein = round1((f.protein * grams) / 100);
      const kcal = Math.round((f.kcal * grams) / 100);
      // نقاط: كثافة البروتين + أكلتها قبل + قربها من الكمية الناقصة + ما تتجاوز السعرات المتبقية بكثير
      const density = (f.protein * 4) / f.kcal;
      const fit = 1 - Math.min(Math.abs(remainingProtein - protein) / Math.max(remainingProtein, 1), 1);
      const kcalPenalty = remainingKcal > 0 && kcal > remainingKcal + 150 ? 0.5 : 0;
      const score = density + fit * 0.6 + (recentNames.has(f.name) ? 0.5 : 0) - kcalPenalty;
      return { food: f, grams, label: f.serving!.label, protein, kcal, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...rest }) => rest);
}
