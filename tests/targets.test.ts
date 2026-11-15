import { describe, expect, it } from "vitest";
import { computeTargets, DEFAULT_SETTINGS as S, resolveDayType } from "@/lib/targets";

// 2026-11-14 = سبت، 2026-11-15 = أحد، 2026-11-17 = ثلاثاء، 2026-11-19 = خميس، 2026-11-20 = جمعة
describe("نوع اليوم", () => {
  it("حسب الجدول", () => {
    expect(resolveDayType("2026-11-14", S, {})).toMatchObject({ type: "training", scheduled: "ملاكمة" });
    expect(resolveDayType("2026-11-17", S, {})).toMatchObject({ type: "training", scheduled: "ملاكمة" });
    expect(resolveDayType("2026-11-19", S, {})).toMatchObject({ type: "training", scheduled: "سبار" });
    expect(resolveDayType("2026-11-20", S, {})).toMatchObject({ type: "training", scheduled: "سيكل" });
    expect(resolveDayType("2026-11-15", S, {}).type).toBe("rest");
    expect(resolveDayType("2026-11-16", S, {}).type).toBe("rest");
  });
  it("تمرين مسجل يحوّل اليوم لتمرين", () => {
    expect(resolveDayType("2026-11-15", S, { hasWorkout: true })).toMatchObject({ type: "training", source: "workout" });
  });
  it("التغيير اليدوي له الأولوية", () => {
    expect(resolveDayType("2026-11-14", S, { override: "rest", hasWorkout: true })).toMatchObject({ type: "rest", source: "manual" });
  });
});

describe("الأهداف", () => {
  it("يوم تمرين 1900", () => {
    const t = computeTargets("training", S);
    expect(t).toEqual({ kcal: 1900, protein: 110, fat: 53, carbs: 246 });
  });
  it("يوم راحة 1700", () => {
    const t = computeTargets("rest", S);
    expect(t.kcal).toBe(1700);
    expect(t.fat).toBe(47); // 1700*0.25/9
    expect(t.carbs).toBe(Math.round((1700 - 440 - 47 * 9) / 4));
  });
});
