import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { AppDB } from "@/lib/db";
import { exportAll, importAll, validateBackup } from "@/lib/backup";

describe("النسخ الاحتياطي", () => {
  it("تصدير ثم استيراد يرجع نفس البيانات", async () => {
    const a = new AppDB("test-a");
    await a.open();
    expect(await a.foods.count()).toBeGreaterThan(40); // البذور انضافت
    await a.weights.put({ date: "2026-11-15", kg: 75 });
    await a.entries.add({ date: "2026-11-15", meal: "lunch", name: "رز", grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.5, createdAt: 1 });
    const json = JSON.parse(JSON.stringify(await exportAll(a)));

    const b = new AppDB("test-b");
    await b.open();
    await b.weights.put({ date: "2020-01-01", kg: 60 });
    await importAll(b, validateBackup(json));
    expect(await b.weights.toArray()).toEqual([{ date: "2026-11-15", kg: 75 }]);
    expect(await b.entries.count()).toBe(1);
    expect(await b.foods.count()).toBe(await a.foods.count());
  });
  it("يرفض ملف غلط", () => {
    expect(() => validateBackup({ foo: 1 })).toThrow();
    expect(() => validateBackup({ app: "lyaqa", version: 1, data: { foods: "x" } })).toThrow();
  });
});
