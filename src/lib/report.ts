// بناء التقرير اليومي (نفس الكود للزر داخل التطبيق والتقرير التلقائي من السيرفر)

import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { addDays, lastNDays, shortDay } from "./dates";
import { BUILTIN_WORKOUTS } from "./defaults";
import { movingAverage, summarizeDays, type RawData } from "./stats";
import type { Locale, Settings, WorkoutType } from "./types";

export interface ReportData {
  date: string;
  kcal: number;
  kcalTarget: number;
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbsTarget: number;
  fat: number;
  fatTarget: number;
  steps: number | null;
  stepsGoal: number;
  weight: number | null;
  avg7: number | null;
  /** null = يوم راحة */
  workout: { name: string; done: boolean } | null;
  logged: boolean;
}

/** يحتاج بيانات آخر 7 أيام على الأقل (للمتوسط) */
export function computeReportData(date: string, raw: RawData, s: Settings, types: WorkoutType[], locale: Locale): ReportData {
  const [day] = summarizeDays([date], raw, s);
  const [avg7] = movingAverage(raw.weights, [date]);
  const typeId = day.session?.type ?? s.schedule[new Date(`${date}T12:00:00`).getDay()] ?? "rest";
  const name = (id: string) =>
    id === "rest" || BUILTIN_WORKOUTS.some((b) => b.id === id)
      ? (locale === "ar" ? ar : en).workouts[id as keyof typeof ar.workouts]
      : (types.find((x) => x.id === id)?.name ?? id);
  return {
    date,
    kcal: day.kcal,
    kcalTarget: day.targets.kcal,
    protein: day.protein,
    proteinTarget: day.targets.protein,
    carbs: day.carbs,
    carbsTarget: day.targets.carbs,
    fat: day.fat,
    fatTarget: day.targets.fat,
    steps: day.steps,
    stepsGoal: s.stepsGoal,
    weight: day.weight,
    avg7,
    workout: typeId === "rest" ? null : { name: name(typeId), done: day.workoutDone },
    logged: day.logged,
  };
}

const n0 = (n: number) => Math.round(n).toLocaleString("en-US");
const n1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-US");

export interface ReportLine {
  key: "kcal" | "protein" | "carbs" | "fat" | "steps" | "weight" | "workout";
  icon: string;
  label: string;
  value: string;
  ok?: boolean;
}

export function reportLines(r: ReportData, locale: Locale): { title: string; lines: ReportLine[] } {
  const m = locale === "ar" ? ar : en;
  const g = m.common.units.g;
  const kg = m.common.kg;
  // في العربي نعزل الأرقام باتجاه LTR عشان "1,850 / 2,150" ما تنقلب في واتساب والإيميل
  const L = (x: string) => (locale === "ar" ? `\u2066${x}\u2069` : x);
  const lines: ReportLine[] = [
    { key: "kcal", icon: "🔥", label: m.report.kcal, value: L(`${n0(r.kcal)} / ${n0(r.kcalTarget)}`), ok: r.kcal >= r.kcalTarget * 0.9 },
    { key: "protein", icon: "💪", label: m.report.protein, value: `${L(`${n1(r.protein)} / ${r.proteinTarget}`)} ${g}`, ok: r.protein >= r.proteinTarget },
    { key: "carbs", icon: "🍚", label: m.report.carbs, value: `${L(`${n0(r.carbs)} / ${r.carbsTarget}`)} ${g}` },
    { key: "fat", icon: "🥑", label: m.report.fat, value: `${L(`${n0(r.fat)} / ${r.fatTarget}`)} ${g}` },
    { key: "steps", icon: "👟", label: m.report.steps, value: r.steps == null ? m.report.noData : L(`${n0(r.steps)} / ${n0(r.stepsGoal)}`), ok: r.steps != null && r.steps >= r.stepsGoal },
    {
      key: "weight",
      icon: "⚖️",
      label: m.report.weight,
      value: `${r.weight == null ? m.report.noData : `${L(r.weight.toFixed(1))} ${kg}`} (${m.report.avg7}: ${r.avg7 == null ? m.report.noData : L(r.avg7.toFixed(1))})`,
    },
    {
      key: "workout",
      icon: "🥊",
      label: m.report.workout,
      value: r.workout ? `${r.workout.name} ${r.workout.done ? "✅" : "❌"}` : m.report.noWorkout,
      ok: r.workout ? r.workout.done : undefined,
    },
  ];
  return { title: m.report.title.replace("{date}", shortDay(r.date)), lines };
}

/** نص التقرير (للواتساب) */
export function reportText(r: ReportData, locale: Locale, encouragement?: string): string {
  const { title, lines } = reportLines(r, locale);
  return [`📊 ${title}`, "", ...lines.map((l) => `${l.icon} ${l.label}: ${l.value}`), ...(encouragement ? ["", encouragement] : [])].join("\n");
}

// جمل تشجيع جاهزة (إذا Gemini ما اشتغل)
const FALLBACK = {
  ar: [
    "كل يوم تسجّل فيه هو خطوة لقدام. استمر يا بطل 👊",
    "الالتزام أهم من الكمال. بكرة يوم جديد 💪",
    "جسمك يكبر ويقوى مع كل تمرين ووجبة صح. فخور فيك 🥊",
    "الأبطال يُصنعون بالعادات الصغيرة كل يوم 🔥",
    "نام زين الليلة، النوم جزء من التمرين 😴",
  ],
  en: [
    "Every day you log is a step forward. Keep going, champ 👊",
    "Consistency beats perfection. Tomorrow is a new day 💪",
    "Your body grows stronger with every workout and good meal 🥊",
    "Champions are built by small daily habits 🔥",
    "Sleep well tonight — rest is part of training 😴",
  ],
};

export function fallbackEncouragement(locale: Locale, seed: string): string {
  const list = FALLBACK[locale];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return list[Math.abs(h) % list.length];
}

/** مدخلات Gemini للتشجيع: أرقام فقط بدون أي معلومات شخصية */
export function encouragementPrompt(r: ReportData, locale: Locale): string {
  const facts = {
    calories: `${r.kcal}/${r.kcalTarget}`,
    protein_g: `${r.protein}/${r.proteinTarget}`,
    steps: r.steps == null ? "not logged" : `${r.steps}/${r.stepsGoal}`,
    workout: r.workout ? (r.workout.done ? "completed" : "missed") : "rest day",
    food_logged: r.logged,
  };
  const lang = locale === "ar" ? "Arabic (Gulf dialect, simple and warm)" : "English";
  return `Write ONE short encouraging sentence (max 20 words) in ${lang} for a teenage boxer based on today's numbers. Be positive and specific; if calories or protein are low, gently encourage eating enough to grow. No medical advice, no hashtags. Today: ${JSON.stringify(facts)}`;
}

export function reportWindow(date: string): { from: string; to: string } {
  return { from: addDays(date, -7), to: date };
}

export { lastNDays };
