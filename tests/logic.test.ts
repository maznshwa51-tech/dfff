import { describe, expect, it } from "vitest";
import { addDays, lastNDays, nowInZone, parseHHMM } from "@/lib/dates";
import { DEFAULT_FOODS } from "@/lib/defaults";
import { normalizeAr, parseFoodInput, scaleMacros, searchFoods } from "@/lib/food-match";
import { computeTargets, DEFAULT_SETTINGS as S, resolveDayType } from "@/lib/targets";
import { healthAlerts, movingAverage, periodStats, proteinStreak, suggestProtein, summarizeDays, topProteinFoods, weeklyAvgChange } from "@/lib/stats";
import { compliance, newSession, toggleRound, workoutStreak } from "@/lib/workouts";
import type { FoodEntry, Session } from "@/lib/types";

// 2026-11-14 سبت، 15 أحد، 16 إثنين، 17 ثلاثاء، 18 أربعاء، 19 خميس، 20 جمعة
const SUN = "2026-11-15";

describe("الكمية والقيم", () => {
  it("يحسب حسب الكمية المرجعية", () => {
    expect(scaleMacros({ kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, 150, 100)).toEqual({ kcal: 195, protein: 4.1, carbs: 42, fat: 0.5 });
    // ملصق: الحصة 30 غ = 120 سعرة
    expect(scaleMacros({ kcal: 120, protein: 3, carbs: 20, fat: 3 }, 45, 30)).toEqual({ kcal: 180, protein: 4.5, carbs: 30, fat: 4.5 });
    expect(scaleMacros({ kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 }, 250, 100).kcal).toBe(153);
    expect(scaleMacros({ kcal: 100, protein: 1, carbs: 1, fat: 1 }, 0, 100).kcal).toBe(0);
  });
  it("يفهم الكمية والوحدة من النص", () => {
    expect(parseFoodInput("رز أبيض مطبوخ 150 غ")).toEqual({ name: "رز أبيض مطبوخ", amount: 150, unit: "g" });
    expect(parseFoodInput("حليب ٢٥٠ مل")).toEqual({ name: "حليب", amount: 250, unit: "ml" });
    expect(parseFoodInput("تونة")).toEqual({ name: "تونة", amount: null, unit: null });
  });
  it("البحث بالعربي والإنجليزي والماركة", () => {
    const foods = [...DEFAULT_FOODS, { ...DEFAULT_FOODS[0], id: "x", name: "زبادي", brand: "المراعي" }];
    expect(searchFoods("الرز", foods)[0].food.name).toBe("رز أبيض مطبوخ");
    expect(searchFoods("دجاج", foods)[0].food.name).toMatch(/دجاج/);
    expect(searchFoods("tuna", foods)[0].food.name).toBe("تونة معلبة بالماء");
    expect(searchFoods("المراعي", foods)[0].food.id).toBe("x");
    expect(searchFoods("بيتزا", foods)).toEqual([]);
    expect(normalizeAr("أرزٌ")).toBe("ارز");
  });
  it("قيم الأكلات الافتراضية منطقية", () => {
    for (const f of DEFAULT_FOODS) {
      const calc = f.protein * 4 + f.carbs * 4 + f.fat * 9;
      expect(Math.abs(calc - f.kcal) / f.kcal, f.name).toBeLessThan(f.kcal < 60 ? 0.35 : 0.2);
    }
  });
});

describe("الجدول ونوع اليوم والأهداف", () => {
  it("الجدول الافتراضي", () => {
    const t = (d: string) => resolveDayType(d, S, {});
    expect(t("2026-11-14")).toMatchObject({ type: "training", scheduled: "boxing" });
    expect(t("2026-11-15")).toMatchObject({ type: "training", scheduled: "home" });
    expect(t("2026-11-16")).toMatchObject({ type: "rest", scheduled: "rest" });
    expect(t("2026-11-17").scheduled).toBe("boxing");
    expect(t("2026-11-18").scheduled).toBe("home");
    expect(t("2026-11-19").scheduled).toBe("sparring");
    expect(t("2026-11-20").scheduled).toBe("cycling");
  });
  it("تمرين منجز يوم الراحة ← تمرين، واليدوي يفوز", () => {
    expect(resolveDayType("2026-11-16", S, { session: { type: "boxing", done: true } })).toMatchObject({ type: "training", source: "workout" });
    expect(resolveDayType("2026-11-14", S, { override: "rest" })).toMatchObject({ type: "rest", source: "manual" });
    expect(resolveDayType("2026-11-14", S, { session: { type: "rest", done: false } })).toMatchObject({ type: "rest", source: "changed" });
  });
  it("الأهداف 2150 / 1900 و110 بروتين و25% دهون", () => {
    expect(computeTargets("training", S)).toEqual({ kcal: 2150, protein: 110, fat: 60, carbs: 293 });
    expect(computeTargets("rest", S)).toEqual({ kcal: 1900, protein: 110, fat: 53, carbs: 246 });
  });
});

describe("قائمة الإنجاز والالتزام", () => {
  it("جولات البيت", () => {
    let s = newSession(SUN, "home", S, "rounds");
    expect(s.rounds).toEqual([false, false, false]);
    s = toggleRound(s, 0); s = toggleRound(s, 1);
    expect(s.done).toBe(false);
    s = toggleRound(s, 2);
    expect(s.done).toBe(true);
    s = toggleRound(s, 1);
    expect(s.done).toBe(false);
  });
  const ses = (date: string, type: string, done = true): [string, Session] => [date, { id: date, date, type, done, updatedAt: 0 }];
  it("النسبة والسلسلة", () => {
    // الأسبوع 9-15: سبت 14 ملاكمة ✓، جمعة 13 سيكل ✓، خميس 12 سبار ✗، أربعاء 11 بيت ✓، ثلاثاء 10 ملاكمة ✓، إثنين 9 راحة
    const m = new Map([ses("2026-11-14", "boxing"), ses("2026-11-13", "cycling"), ses("2026-11-11", "home"), ses("2026-11-10", "boxing")]);
    const c = compliance(lastNDays(SUN, 7), SUN, S, m);
    // 9..15: الأحد 15 (اليوم، ما خلص) ما ينحسب، الإثنين راحة → المجدول: 10،11،12،13،14 = 5، المنجز 4
    expect(c).toEqual({ planned: 5, done: 4, pct: 80 });
    expect(workoutStreak(SUN, S, m)).toBe(2); // 14، 13 ثم 12 ما خلص
    m.set("2026-11-12", { id: "2026-11-12", date: "2026-11-12", type: "sparring", done: true, updatedAt: 0 });
    expect(workoutStreak(SUN, S, m)).toBe(5); // الإثنين 9 راحة، الأحد 8 بيت ما خلص
    m.set(SUN, { id: SUN, date: SUN, type: "home", done: true, updatedAt: 0 });
    expect(workoutStreak(SUN, S, m)).toBe(6);
  });
});

const e = (date: string, name: string, kcal: number, protein: number): FoodEntry => ({ id: date + name, date, meal: "lunch", name, amount: 100, unit: "g", kcal, protein, carbs: 0, fat: 0, createdAt: 0 });

describe("الإحصائيات والتنبيهات", () => {
  const data = {
    entries: [e(SUN, "تونة", 116, 25.5), e(SUN, "رز", 1300, 27), e(addDays(SUN, -1), "دجاج", 2000, 120)],
    weights: new Map([[SUN, 75]]),
    steps: new Map([[SUN, 8000]]),
    sessions: new Map<string, Session>([[addDays(SUN, -1), { id: "x", date: addDays(SUN, -1), type: "boxing", done: true, km: 0, updatedAt: 0 }]]),
    overrides: new Map(),
  };
  const days = summarizeDays(lastNDays(SUN, 7), data, S);
  it("يجمع اليوم", () => {
    expect(days.at(-1)).toMatchObject({ kcal: 1416, protein: 52.5, steps: 8000, weight: 75, dayType: "training" });
    expect(periodStats(days)).toMatchObject({ avgKcal: 1708, workoutDays: 1 });
    expect(topProteinFoods(data.entries)[0].name).toBe("دجاج");
  });
  it("تنبيه السعرات أقل من 1800 والبروتين", () => {
    const a = healthAlerts(days.at(-1)!, true, null, S, "today");
    expect(a.map((x) => x.kind)).toEqual(["lowKcal", "lowProtein"]);
    expect(healthAlerts(days.at(-1)!, false, null, S, "today")).toEqual([]);
  });
  it("تنبيه نزول الوزن أكثر من 0.5 بالأسبوع", () => {
    const w = new Map<string, number>();
    lastNDays(SUN, 14).forEach((d, i) => w.set(d, 76 - i * 0.15));
    const ch = weeklyAvgChange(w, SUN)!;
    expect(ch).toBeCloseTo(-1.05, 2);
    expect(healthAlerts(days.at(-1)!, false, ch, S, "today").map((x) => x.kind)).toEqual(["weightLoss"]);
    expect(healthAlerts(days.at(-1)!, false, -0.3, S, "today")).toEqual([]);
    expect(movingAverage(new Map([["2026-11-13", 75], [SUN, 74]]), [SUN])).toEqual([74.5]);
  });
  it("السلسلة واقتراح البروتين", () => {
    expect(proteinStreak(new Map([[SUN, 50], [addDays(SUN, -1), 120], [addDays(SUN, -2), 110]]), SUN, 110)).toBe(2);
    const s = suggestProtein(25, 600, DEFAULT_FOODS, new Set(["seed-009"]));
    expect(s[0].food.name).toBe("تونة معلبة بالماء");
    expect(s[0]).toMatchObject({ amount: 100, protein: 25.5 });
    expect(suggestProtein(2, 500, DEFAULT_FOODS, new Set())).toEqual([]);
  });
});

describe("الوقت بمنطقة دبي", () => {
  it("يحسب الوقت المحلي", () => {
    expect(nowInZone("Asia/Dubai", new Date("2026-11-15T17:30:00Z"))).toEqual({ date: "2026-11-15", minutes: 21 * 60 + 30 });
    expect(nowInZone("Asia/Dubai", new Date("2026-11-15T20:30:00Z")).date).toBe("2026-11-16");
    expect(parseHHMM("21:30")).toBe(1290);
    expect(parseHHMM("bad")).toBe(1290);
  });
});
