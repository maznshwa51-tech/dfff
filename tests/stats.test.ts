import { describe, expect, it } from "vitest";
import { addDays, lastNDays } from "@/lib/dates";
import { SEED_FOODS } from "@/lib/foods-seed";
import type { Food } from "@/lib/db";
import { DEFAULT_SETTINGS as S } from "@/lib/targets";
import { healthAlerts, movingAverage, periodStats, proteinStreak, suggestProtein, summarizeDays, topProteinFoods, weeklyAvgChange } from "@/lib/stats";

const END = "2026-11-15";

describe("المتوسط المتحرك", () => {
  it("يتجاهل الأيام الناقصة", () => {
    const w = new Map([["2026-11-13", 75], ["2026-11-15", 74]]);
    expect(movingAverage(w, ["2026-11-15", "2026-11-14"])).toEqual([74.5, 75]);
    expect(movingAverage(w, ["2026-11-01"])).toEqual([null]);
  });
  it("نزول أكثر من 0.5 بالأسبوع", () => {
    const w = new Map<string, number>();
    lastNDays(END, 14).forEach((d, i) => w.set(d, 76 - i * 0.15)); // ~1 كغ بالأسبوع
    const ch = weeklyAvgChange(w, END)!;
    expect(ch).toBeCloseTo(-1.05, 2);
  });
  it("بيانات قليلة ← بدون حكم", () => {
    expect(weeklyAvgChange(new Map([[END, 75]]), END)).toBeNull();
  });
});

describe("السلسلة", () => {
  it("تعد الأيام المتتالية", () => {
    const p = new Map([[END, 50], [addDays(END, -1), 120], [addDays(END, -2), 110], [addDays(END, -3), 90]]);
    expect(proteinStreak(p, END, 110)).toBe(2); // اليوم ما خلص، يبدأ من أمس
    p.set(END, 115);
    expect(proteinStreak(p, END, 110)).toBe(3);
  });
});

const entry = (date: string, name: string, kcal: number, protein: number) => ({ date, meal: "lunch" as const, name, grams: 100, kcal, protein, carbs: 0, fat: 0, createdAt: 0 });

describe("التجميع والتنبيهات", () => {
  const data = {
    entries: [entry(END, "تونة", 116, 25.5), entry(END, "رز", 1300, 27), entry(addDays(END, -1), "دجاج", 2000, 120)],
    weights: new Map([[END, 75]]),
    steps: new Map([[END, 8000]]),
    workouts: [{ date: addDays(END, -1), type: "ملاكمة", durationMin: 60, intensity: "high" as const, createdAt: 0 }],
    overrides: new Map(),
  };
  const days = summarizeDays(lastNDays(END, 7), data, S);
  it("يجمع اليوم", () => {
    const today = days.at(-1)!;
    expect(today).toMatchObject({ kcal: 1416, protein: 52.5, steps: 8000, weight: 75, dayType: "rest" });
    expect(days.at(-2)!.dayType).toBe("training"); // سبت + تمرين
  });
  it("المتوسطات تحسب الأيام المسجلة فقط", () => {
    const p = periodStats(days);
    expect(p.avgKcal).toBe(Math.round((1416 + 2000) / 2));
    expect(p.workoutDays).toBe(1);
  });
  it("أكثر الأكلات بروتين", () => {
    expect(topProteinFoods(data.entries)[0].name).toBe("دجاج");
  });
  it("تنبيه السعرات القليلة والبروتين", () => {
    const a = healthAlerts(days.at(-1)!, true, null, S);
    expect(a.map((x) => x.id.split("-")[0])).toEqual(["lowkcal", "lowprotein"]);
    expect(healthAlerts(days.at(-1)!, false, null, S)).toEqual([]); // اليوم ما خلص
  });
  it("تنبيه نزول الوزن", () => {
    const a = healthAlerts(days.at(-2)!, true, -0.8, S);
    expect(a.some((x) => x.id.startsWith("weightloss"))).toBe(true);
    expect(healthAlerts(days.at(-2)!, true, -0.3, S).some((x) => x.id.startsWith("weightloss"))).toBe(false);
  });
});

describe("اقتراح البروتين", () => {
  const foods = SEED_FOODS.map((f, i) => ({ ...f, id: i, source: "seed" })) as Food[];
  it("يقترح أكلات غنية بالبروتين", () => {
    const s = suggestProtein(25, 600, foods, new Set(["تونة معلبة بالماء"]));
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].food.name).toBe("تونة معلبة بالماء");
    expect(s[0].label).toBe("علبة تونة");
    for (const x of s) expect(x.food.protein).toBeGreaterThanOrEqual(8);
  });
  it("ما يقترح إذا البروتين كامل", () => {
    expect(suggestProtein(0, 500, foods, new Set())).toEqual([]);
  });
});
