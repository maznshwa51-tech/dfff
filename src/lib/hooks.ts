"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { getDb } from "./db";
import { todayKey } from "./dates";
import { BUILTIN_WORKOUTS } from "./defaults";
import { putRow } from "./repo";
import type { RawData } from "./stats";
import { syncManager } from "./sync-client";
import { mergeSettings } from "./targets";
import type { Category, Food, Settings, WorkoutType } from "./types";

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => mergeSettings(await getDb().settings.get("settings")), []);
}

let settingsQueue: Promise<void> = Promise.resolve();
/**
 * حفظ الإعدادات بالترتيب (عشان لو انحفظ شيئين بنفس اللحظة ما يمسح واحد الثاني).
 * تقدر ترسل دالة تاخذ الإعدادات الحالية وترجع التعديل.
 */
export function saveSettings(patch: Partial<Settings> | ((cur: Settings) => Partial<Settings>)): Promise<void> {
  settingsQueue = settingsQueue
    .then(async () => {
      const cur = mergeSettings(await getDb().settings.get("settings"));
      const p = typeof patch === "function" ? patch(cur) : patch;
      await putRow("settings", { ...cur, ...p, id: "settings" });
    })
    .catch((e) => console.error("saveSettings failed", e));
  return settingsQueue;
}

/** كل البيانات من `from` إلى `to` (شامل) */
export function useRange(from: string, to: string): RawData | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const [entries, weights, steps, sessions, overrides] = await Promise.all([
      db.entries.where("date").between(from, to, true, true).toArray(),
      db.weights.where("date").between(from, to, true, true).toArray(),
      db.steps.where("date").between(from, to, true, true).toArray(),
      db.sessions.where("date").between(from, to, true, true).toArray(),
      db.dayTypes.where("date").between(from, to, true, true).toArray(),
    ]);
    return {
      entries,
      weights: new Map(weights.map((w) => [w.date, w.kg])),
      steps: new Map(steps.map((s) => [s.date, s.count])),
      sessions: new Map(sessions.map((s) => [s.date, s])),
      overrides: new Map(overrides.map((o) => [o.date, o.type])),
    };
  }, [from, to]);
}

export function useFoods(): Food[] | undefined {
  return useLiveQuery(() => getDb().foods.toArray(), []);
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(() => getDb().categories.orderBy("order").toArray(), []);
}

export function useWorkoutTypes(): WorkoutType[] {
  return useLiveQuery(async () => {
    const custom = await getDb().workoutTypes.toArray();
    const ids = new Set(custom.map((c) => c.id));
    return [...BUILTIN_WORKOUTS.filter((b) => !ids.has(b.id)), ...custom];
  }, []) ?? BUILTIN_WORKOUTS;
}

/** اسم نوع التمرين (الافتراضية مترجمة) */
export function useWorkoutName() {
  const t = useTranslations("workouts");
  const types = useWorkoutTypes();
  return (id: string) => {
    if (id === "rest" || BUILTIN_WORKOUTS.some((b) => b.id === id)) return t(id as "rest");
    return types.find((x) => x.id === id)?.name ?? id;
  };
}

/** اسم الصنف (الافتراضية مترجمة) */
export function useCategoryName() {
  const t = useTranslations("categories");
  return (c: Category) => (c.key ? t(c.key as "dairy") : c.name);
}

/** اسم الأكلة حسب اللغة */
export function foodName(f: Pick<Food, "name" | "nameEn">, locale: string) {
  return locale === "en" && f.nameEn ? f.nameEn : f.name;
}

export function useSyncStatus() {
  return useSyncExternalStore(syncManager.subscribe, syncManager.getStatus, syncManager.getStatus);
}

/** مفتاح اليوم الحالي، ويتحدث بعد منتصف الليل */
export function useToday(): string {
  const [key, setKey] = useState(todayKey);
  useEffect(() => {
    const id = setInterval(() => setKey(todayKey()), 60_000);
    return () => clearInterval(id);
  }, []);
  return key;
}

export function useHour(): number {
  const [h, setH] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setH(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);
  return h;
}
