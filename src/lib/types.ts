// أنواع البيانات. كل صف له id نصي عشان يتزامن بين الأجهزة بدون تعارض

export type Unit = "g" | "ml";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
export type Intensity = "light" | "medium" | "high";
export const INTENSITIES: Intensity[] = ["light", "medium", "high"];
export type DayType = "training" | "rest";
export type Locale = "ar" | "en";
export type Theme = "system" | "light" | "dark";
export type ReportChannel = "whatsapp" | "email" | "both";

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Category {
  id: string;
  name: string;
  /** الأصناف الافتراضية لها مفتاح ترجمة */
  key?: string;
  order: number;
}

/** أكلة في مكتبتي. القيم حسب الكمية المرجعية (refAmount) */
export interface Food extends Macros {
  id: string;
  categoryId: string;
  name: string;
  nameEn?: string;
  brand?: string;
  refAmount: number;
  unit: Unit;
  /** آخر كمية سجلتها لهذي الأكلة (للزر السريع) */
  lastAmount?: number;
  createdAt: number;
}

export interface FoodEntry extends Macros {
  id: string;
  date: string;
  meal: Meal;
  foodId?: string;
  name: string;
  brand?: string;
  amount: number;
  unit: Unit;
  createdAt: number;
}

export interface WeightEntry {
  id: string; // = date
  date: string;
  kg: number;
}
export interface WaistEntry {
  id: string;
  date: string;
  cm: number;
}
export interface StepsEntry {
  id: string;
  date: string;
  count: number;
}
export interface DayTypeOverride {
  id: string;
  date: string;
  type: DayType;
}

/** نوع تمرين. الأنواع الافتراضية: boxing, sparring, cycling, home */
export interface WorkoutType {
  id: string;
  name: string;
  /** simple = علامة إنجاز، distance = كيلومترات، rounds = جولات */
  kind: "simple" | "distance" | "rounds";
  builtin?: boolean;
}

/** تمرين يوم معين (id = التاريخ) */
export interface Session {
  id: string;
  date: string;
  /** id نوع التمرين */
  type: string;
  done: boolean;
  /** لتمرين البيت: جولة خلصت أو لا */
  rounds?: boolean[];
  /** عدد الضغط في كل جولة (اختياري) */
  pushups?: (number | null)[];
  km?: number;
  durationMin?: number;
  intensity?: Intensity;
  notes?: string;
  updatedAt: number;
}

export interface FavoriteItem extends Macros {
  name: string;
  amount: number;
  unit: Unit;
  foodId?: string;
}
export interface Favorite {
  id: string;
  name: string;
  items: FavoriteItem[];
  createdAt: number;
}

export interface Settings {
  id: "settings";
  profile: { age: number; heightCm: number; startWeightKg: number; sport: string };
  /** رقم اليوم (0 الأحد ... 6 السبت) ← id نوع التمرين أو "rest" */
  schedule: Record<number, string>;
  homeRounds: number;
  kcalTraining: number;
  kcalRest: number;
  proteinG: number;
  /** نسبة الدهون من السعرات */
  fatPct: number;
  stepsGoal: number;
  lowKcalAlert: number;
  lowProteinAlert: number;
  weeklyLossAlertKg: number;
  theme: Theme;
  locale: Locale;
  defaultUnit: Unit;
  report: {
    enabled: boolean;
    /** "HH:MM" */
    time: string;
    timezone: string;
    channel: ReportChannel;
    email?: string;
    /** رقم بالصيغة الدولية بدون + (مثلاً 9715xxxxxxx) */
    whatsapp?: string;
  };
}

export const SYNCED_TABLES = [
  "categories",
  "foods",
  "entries",
  "weights",
  "waists",
  "steps",
  "sessions",
  "workoutTypes",
  "dayTypes",
  "favorites",
  "settings",
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];
