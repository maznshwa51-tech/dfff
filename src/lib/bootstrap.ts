// تجهيز البيانات: الأصناف والأكلات الافتراضية، ونقل بيانات النسخة الأولى من التطبيق

import Dexie from "dexie";
import { getMeta, setMeta, type AppDB } from "./db";
import { BUILTIN_WORKOUTS, DEFAULT_CATEGORIES, DEFAULT_FOODS } from "./defaults";
import { uid } from "./ids";
import { putRows } from "./repo";
import { DEFAULT_SETTINGS } from "./targets";
import type { DayTypeOverride, Favorite, Food, FoodEntry, Meal, Session, Settings, StepsEntry, WaistEntry, WeightEntry } from "./types";

/** يضيف الافتراضيات إذا الحساب فاضي (أول مرة) */
export async function ensureDefaults(db: AppDB) {
  if (await getMeta(db, "defaultsSeeded")) return;
  if ((await db.categories.count()) === 0) {
    await putRows("categories", DEFAULT_CATEGORIES, db);
    await putRows("foods", DEFAULT_FOODS, db);
  }
  const existing = new Set((await db.workoutTypes.toCollection().primaryKeys()) as string[]);
  await putRows("workoutTypes", BUILTIN_WORKOUTS.filter((w) => !existing.has(w.id)), db);
  if (!(await db.settings.get("settings"))) await putRows("settings", [DEFAULT_SETTINGS], db);
  await setMeta(db, "defaultsSeeded", true);
}

// ---------- نقل بيانات النسخة الأولى (قاعدة "lyaqa") ----------

const V1_WORKOUT_IDS: Record<string, string> = { ملاكمة: "boxing", سبار: "sparring", سيكل: "cycling", "تمرين بيت": "home" };

interface V1Food { id: number; name: string; aliases?: string[]; kcal: number; protein: number; carbs: number; fat: number; source: string }
interface V1Entry { date: string; meal: Meal; name: string; grams: number; foodId?: number; kcal: number; protein: number; carbs: number; fat: number; createdAt: number }
interface V1Workout { date: string; type: string; durationMin: number; intensity: "light" | "medium" | "high"; distanceKm?: number; notes?: string; createdAt: number }

export async function migrateLegacy(db: AppDB, legacyName = "lyaqa"): Promise<number> {
  if (await getMeta(db, "legacyMigrated")) return 0;
  if (!(await Dexie.exists(legacyName))) {
    await setMeta(db, "legacyMigrated", true);
    return 0;
  }
  const old = new Dexie(legacyName);
  await old.open(); // يفتح بالجداول الموجودة
  const read = async <T,>(t: string): Promise<T[]> => (old.tables.some((x) => x.name === t) ? ((await old.table(t).toArray()) as T[]) : []);

  const [foods, entries, weights, waists, steps, workouts, favorites, dayTypes, settingsRows] = await Promise.all([
    read<V1Food>("foods"),
    read<V1Entry>("entries"),
    read<{ date: string; kg: number }>("weights"),
    read<{ date: string; cm: number }>("waists"),
    read<{ date: string; count: number }>("steps"),
    read<V1Workout>("workouts"),
    read<{ name: string; items: { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number }[]; createdAt: number }>("favorites"),
    read<{ date: string; type: "training" | "rest" }>("dayTypes"),
    read<{ key: string; value: Partial<Settings> & { schedule?: Record<number, string> } }>("settings"),
  ]);
  old.close();

  // الأكلات اللي أضفتها بنفسك أو من الذكاء الاصطناعي تنتقل لصنف "سناكات"
  // (الأكلات الجاهزة القديمة موجودة أصلاً في المكتبة الجديدة)
  const seedByName = new Map(DEFAULT_FOODS.map((f) => [f.name, f.id]));
  const foodIdMap = new Map<number, string>();
  const newFoods: Food[] = [];
  for (const f of foods) {
    if (f.source === "seed") {
      const sid = seedByName.get(f.name);
      if (sid) foodIdMap.set(f.id, sid);
      continue;
    }
    const id = uid();
    foodIdMap.set(f.id, id);
    newFoods.push({ id, categoryId: "cat-snacks", name: f.name, refAmount: 100, unit: "g", kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, createdAt: Date.now() });
  }

  const newEntries: FoodEntry[] = entries.map((e) => ({
    id: uid(),
    date: e.date,
    meal: e.meal,
    foodId: e.foodId != null ? foodIdMap.get(e.foodId) : undefined,
    name: e.name,
    amount: e.grams,
    unit: "g",
    kcal: e.kcal,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    createdAt: e.createdAt,
  }));

  // التمارين القديمة تصير تمارين منجزة (تمرين واحد لكل يوم)
  const sessions = new Map<string, Session>();
  for (const w of workouts) {
    if (sessions.has(w.date)) continue;
    sessions.set(w.date, {
      id: w.date,
      date: w.date,
      type: V1_WORKOUT_IDS[w.type] ?? "boxing",
      done: true,
      km: w.distanceKm,
      durationMin: w.durationMin,
      intensity: w.intensity,
      notes: w.notes ?? (V1_WORKOUT_IDS[w.type] ? undefined : w.type),
      updatedAt: w.createdAt,
    });
  }

  const s1 = settingsRows.find((r) => r.key === "settings")?.value;
  if (newFoods.length) await ensureDefaults(db);
  await putRows("foods", newFoods, db);
  await putRows("entries", newEntries, db);
  await putRows<WeightEntry>("weights", weights.map((w) => ({ id: w.date, date: w.date, kg: w.kg })), db);
  await putRows<WaistEntry>("waists", waists.map((w) => ({ id: w.date, date: w.date, cm: w.cm })), db);
  await putRows<StepsEntry>("steps", steps.map((s) => ({ id: s.date, date: s.date, count: s.count })), db);
  await putRows<DayTypeOverride>("dayTypes", dayTypes.map((d) => ({ id: d.date, date: d.date, type: d.type })), db);
  await putRows("sessions", [...sessions.values()], db);
  await putRows<Favorite>(
    "favorites",
    favorites.map((f) => ({
      id: uid(),
      name: f.name,
      createdAt: f.createdAt,
      items: f.items.map((i) => ({ name: i.name, amount: i.grams, unit: "g" as const, kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat })),
    })),
    db,
  );
  if (s1) {
    // نحتفظ بالإعدادات الشخصية، والأهداف ترجع للقيم الجديدة (2150 / 1900)
    const base = (await db.settings.get("settings")) ?? DEFAULT_SETTINGS;
    await putRows<Settings>("settings", [{ ...base, stepsGoal: s1.stepsGoal ?? base.stepsGoal, theme: s1.theme ?? base.theme }], db);
  }
  await setMeta(db, "legacyMigrated", true);
  return newEntries.length + weights.length + steps.length + sessions.size;
}
