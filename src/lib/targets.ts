// الملف الشخصي، جدول التمرين، ونوع اليوم، والأهداف اليومية

import { weekday } from "./dates";

export type DayType = "training" | "rest";

export interface Settings {
  profile: {
    age: number;
    heightCm: number;
    startWeightKg: number;
    sport: string;
  };
  /** مفتاح = رقم اليوم (0 الأحد ... 6 السبت)، القيمة = اسم التمرين المجدول */
  schedule: Record<number, string>;
  kcalTraining: number;
  kcalRest: number;
  proteinG: number;
  /** نسبة الدهون من السعرات (0.25 = 25%) */
  fatPct: number;
  stepsGoal: number;
  /** تنبيه إذا السعرات في نهاية اليوم أقل من هذا */
  lowKcalAlert: number;
  /** تذكير إذا البروتين أقل من هذا */
  lowProteinAlert: number;
  /** تنبيه إذا متوسط الوزن نزل أكثر من هذا بالأسبوع */
  weeklyLossAlertKg: number;
  theme: "system" | "light" | "dark";
}

export const DEFAULT_SETTINGS: Settings = {
  profile: { age: 14, heightCm: 174, startWeightKg: 75, sport: "ملاكمة" },
  // السبت والثلاثاء ملاكمة، الخميس سبار، الجمعة سيكل
  schedule: { 6: "ملاكمة", 2: "ملاكمة", 4: "سبار", 5: "سيكل" },
  kcalTraining: 1900,
  kcalRest: 1700,
  proteinG: 110,
  fatPct: 0.25,
  stepsGoal: 10000,
  lowKcalAlert: 1800,
  lowProteinAlert: 80,
  weeklyLossAlertKg: 0.5,
  theme: "system",
};

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(stored ?? {}),
    profile: { ...DEFAULT_SETTINGS.profile, ...(stored?.profile ?? {}) },
    schedule: stored?.schedule ?? DEFAULT_SETTINGS.schedule,
  };
}

export interface DayTypeInfo {
  type: DayType;
  /** سبب التحديد */
  source: "manual" | "workout" | "schedule" | "default";
  scheduled?: string;
}

/**
 * ترتيب الأولوية:
 * 1. تغيير يدوي لهذا اليوم
 * 2. فيه تمرين مسجل ← يوم تمرين
 * 3. جدول الأسبوع
 * 4. راحة
 */
export function resolveDayType(
  dateKey: string,
  settings: Settings,
  opts: { override?: DayType; hasWorkout?: boolean },
): DayTypeInfo {
  const scheduled = settings.schedule[weekday(dateKey)];
  if (opts.override) return { type: opts.override, source: "manual", scheduled };
  if (opts.hasWorkout) return { type: "training", source: "workout", scheduled };
  if (scheduled) return { type: "training", source: "schedule", scheduled };
  return { type: "rest", source: "default" };
}

export interface Targets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** البروتين ثابت، الدهون نسبة من السعرات، والكربوهيدرات الباقي */
export function computeTargets(type: DayType, s: Settings): Targets {
  const kcal = type === "training" ? s.kcalTraining : s.kcalRest;
  const protein = s.proteinG;
  const fat = Math.round((kcal * s.fatPct) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs };
}
