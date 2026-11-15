// الإعدادات الافتراضية، نوع اليوم، والأهداف اليومية

import { weekday } from "./dates";
import type { DayType, Session, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  targetsVersion: 2,
  profile: { age: 14, heightCm: 174, startWeightKg: 75, sport: "ملاكمة" },
  // السبت والثلاثاء ملاكمة، الخميس سبار، الجمعة سيكل، الأحد والأربعاء تمرين البيت، الإثنين راحة
  schedule: { 6: "boxing", 2: "boxing", 4: "sparring", 5: "cycling", 0: "home", 3: "home", 1: "rest" },
  homeRounds: 3,
  // بعد مراجعة الطبيب: 1900 يوم التمرين، 1700 يوم الراحة
  kcalTraining: 1900,
  kcalRest: 1700,
  proteinG: 110,
  fatPct: 0.25,
  stepsGoal: 10000,
  // أقل من هدف يوم الراحة، عشان التنبيه ما يطلع لو أكلت حسب الهدف
  lowKcalAlert: 1600,
  lowProteinAlert: 80,
  weeklyLossAlertKg: 0.5,
  theme: "system",
  locale: "ar",
  defaultUnit: "g",
  report: { enabled: true, time: "21:30", timezone: "Asia/Dubai", channel: "email" },
};

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...(stored ?? {}),
    id: "settings",
    profile: { ...DEFAULT_SETTINGS.profile, ...(stored?.profile ?? {}) },
    schedule: { ...DEFAULT_SETTINGS.schedule, ...(stored?.schedule ?? {}) },
    report: { ...DEFAULT_SETTINGS.report, ...(stored?.report ?? {}) },
    // إعدادات قديمة محفوظة بدون رقم نسخة: نخليها بدون رقم عشان تحديث الأهداف يشتغل عليها
    targetsVersion: stored ? stored.targetsVersion : DEFAULT_SETTINGS.targetsVersion,
  };
}

export function scheduledType(date: string, s: Settings): string {
  return s.schedule[weekday(date)] ?? "rest";
}

export interface DayTypeInfo {
  type: DayType;
  source: "manual" | "workout" | "changed" | "schedule" | "default";
  /** id نوع التمرين المجدول (أو rest) */
  scheduled: string;
}

/**
 * ترتيب الأولوية:
 * 1. تغيير يدوي لهذا اليوم
 * 2. غيّرت تمرين اليوم لراحة ← راحة، أو خلصت تمرين ← يوم تمرين
 * 3. جدول الأسبوع
 * 4. راحة
 */
export function resolveDayType(
  date: string,
  s: Settings,
  opts: { override?: DayType; session?: Pick<Session, "type" | "done"> },
): DayTypeInfo {
  const scheduled = scheduledType(date, s);
  if (opts.override) return { type: opts.override, source: "manual", scheduled };
  if (opts.session?.type === "rest") return { type: "rest", source: "changed", scheduled };
  if (opts.session?.done) return { type: "training", source: "workout", scheduled };
  if (scheduled !== "rest") return { type: "training", source: "schedule", scheduled };
  return { type: "rest", source: "default", scheduled };
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
