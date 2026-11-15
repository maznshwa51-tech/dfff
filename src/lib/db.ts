import Dexie, { type EntityTable } from "dexie";
import { SEED_FOODS } from "./foods-seed";
import type { DayType, Settings } from "./targets";
import type { Macros } from "./food-match";

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: { id: Meal; label: string }[] = [
  { id: "breakfast", label: "فطور" },
  { id: "lunch", label: "غداء" },
  { id: "dinner", label: "عشاء" },
  { id: "snack", label: "سناك" },
];

export interface Food extends Macros {
  id?: number;
  name: string;
  aliases?: string[];
  serving?: { grams: number; label: string };
  source: "seed" | "ai" | "custom";
}

export interface FoodEntry extends Macros {
  id?: number;
  date: string;
  meal: Meal;
  name: string;
  grams: number;
  foodId?: number;
  createdAt: number;
}

export interface WeightEntry {
  date: string;
  kg: number;
}
export interface WaistEntry {
  date: string;
  cm: number;
}
export interface StepsEntry {
  date: string;
  count: number;
}

export type Intensity = "light" | "medium" | "high";
export const INTENSITIES: { id: Intensity; label: string }[] = [
  { id: "light", label: "خفيف" },
  { id: "medium", label: "متوسط" },
  { id: "high", label: "عالي" },
];

export interface Workout {
  id?: number;
  date: string;
  type: string;
  durationMin: number;
  intensity: Intensity;
  distanceKm?: number;
  notes?: string;
  createdAt: number;
}

export interface WorkoutType {
  id?: number;
  name: string;
  hasDistance: boolean;
}

export interface FavoriteItem extends Macros {
  name: string;
  grams: number;
  foodId?: number;
}
export interface Favorite {
  id?: number;
  name: string;
  items: FavoriteItem[];
  createdAt: number;
}

export interface DayTypeOverride {
  date: string;
  type: DayType;
}

export interface SettingsRow {
  key: "settings";
  value: Partial<Settings>;
}

export const DEFAULT_WORKOUT_TYPES: WorkoutType[] = [
  { name: "ملاكمة", hasDistance: false },
  { name: "سبار", hasDistance: false },
  { name: "سيكل", hasDistance: true },
  { name: "ضغط", hasDistance: false },
  { name: "تمرين بيت", hasDistance: false },
];

export class AppDB extends Dexie {
  foods!: EntityTable<Food, "id">;
  entries!: EntityTable<FoodEntry, "id">;
  weights!: EntityTable<WeightEntry, "date">;
  waists!: EntityTable<WaistEntry, "date">;
  steps!: EntityTable<StepsEntry, "date">;
  workouts!: EntityTable<Workout, "id">;
  workoutTypes!: EntityTable<WorkoutType, "id">;
  favorites!: EntityTable<Favorite, "id">;
  dayTypes!: EntityTable<DayTypeOverride, "date">;
  settings!: EntityTable<SettingsRow, "key">;

  constructor(name = "lyaqa") {
    super(name);
    this.version(1).stores({
      foods: "++id, name, source",
      entries: "++id, date, meal, name, [date+meal]",
      weights: "&date",
      waists: "&date",
      steps: "&date",
      workouts: "++id, date, type",
      workoutTypes: "++id, &name",
      favorites: "++id, name",
      dayTypes: "&date",
      settings: "&key",
    });
    this.on("populate", (tx) => {
      tx.table("foods").bulkAdd(SEED_FOODS.map((f) => ({ ...f, source: "seed" })));
      tx.table("workoutTypes").bulkAdd(DEFAULT_WORKOUT_TYPES);
    });
  }
}

export const TABLES = [
  "foods",
  "entries",
  "weights",
  "waists",
  "steps",
  "workouts",
  "workoutTypes",
  "favorites",
  "dayTypes",
  "settings",
] as const;

let _db: AppDB | null = null;
export function getDb(): AppDB {
  if (!_db) _db = new AppDB();
  return _db;
}
