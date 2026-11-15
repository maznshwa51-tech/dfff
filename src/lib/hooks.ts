"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { getDb } from "./db";
import { addDays, todayKey } from "./dates";
import { mergeSettings, type Settings } from "./targets";
import type { RawData } from "./stats";

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const row = await getDb().settings.get("settings");
    return mergeSettings(row?.value);
  }, []);
}

export async function saveSettings(patch: Partial<Settings>) {
  const db = getDb();
  const row = await db.settings.get("settings");
  await db.settings.put({ key: "settings", value: { ...(row?.value ?? {}), ...patch } });
}

/** كل البيانات من `from` إلى `to` (شامل) */
export function useRange(from: string, to: string): RawData | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const [entries, weights, steps, workouts, overrides] = await Promise.all([
      db.entries.where("date").between(from, to, true, true).toArray(),
      db.weights.where("date").between(from, to, true, true).toArray(),
      db.steps.where("date").between(from, to, true, true).toArray(),
      db.workouts.where("date").between(from, to, true, true).toArray(),
      db.dayTypes.where("date").between(from, to, true, true).toArray(),
    ]);
    return {
      entries,
      weights: new Map(weights.map((w) => [w.date, w.kg])),
      steps: new Map(steps.map((s) => [s.date, s.count])),
      workouts,
      overrides: new Map(overrides.map((o) => [o.date, o.type])),
    };
  }, [from, to]);
}

/** مفتاح اليوم الحالي، ويتحدث تلقائياً بعد منتصف الليل */
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

export { addDays };
