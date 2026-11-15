import { describe, expect, it } from "vitest";
import { bestMatch, normalizeAr, parseFoodInput, scaleMacros, searchFoods } from "@/lib/food-match";
import { SEED_FOODS } from "@/lib/foods-seed";

describe("parseFoodInput", () => {
  it("يفصل الاسم والوزن", () => {
    expect(parseFoodInput("رز أبيض مطبوخ 150 غ")).toEqual({ name: "رز أبيض مطبوخ", grams: 150 });
    expect(parseFoodInput("صدر دجاج 200غ")).toEqual({ name: "صدر دجاج", grams: 200 });
    expect(parseFoodInput("تونة ١٢٠ غرام")).toEqual({ name: "تونة", grams: 120 });
    expect(parseFoodInput("150 g rice")).toEqual({ name: "rice", grams: 150 });
    expect(parseFoodInput("موز")).toEqual({ name: "موز", grams: null });
    expect(parseFoodInput("حليب 250.5 جم")).toEqual({ name: "حليب", grams: 250.5 });
  });
});

describe("matching", () => {
  it("يوحد الكتابة", () => {
    expect(normalizeAr("أرزٌ")).toBe("ارز");
    expect(normalizeAr("تونة")).toBe(normalizeAr("تونه"));
  });
  const cases: [string, string][] = [
    ["رز أبيض مطبوخ", "رز أبيض مطبوخ"],
    ["رز", "رز أبيض مطبوخ"],
    ["الرز", "رز أبيض مطبوخ"],
    ["بيضة", "بيض"],
    ["صدر دجاج", "صدر دجاج مطبوخ"],
    ["تونه", "تونة معلبة بالماء"],
    ["خبز اسمر", "خبز أسمر"],
    ["افخاذ دجاج", "أفخاذ دجاج مطبوخة"],
    ["لبنة", "لبنة"],
    ["زبادي", "زبادي عادي"],
    ["عدس", "عدس مطبوخ"],
    ["حليب", "حليب كامل الدسم"],
    ["زيت زيتون", "زيت زيتون"],
    ["صدر دجاج مشوي بالفرن", "صدر دجاج مطبوخ"],
  ];
  for (const [q, expected] of cases) {
    it(`"${q}" ← ${expected}`, () => expect(bestMatch(q, SEED_FOODS)?.name).toBe(expected));
  }
  it("ما يطابق أكلات غريبة", () => {
    expect(bestMatch("كبسة لحم", SEED_FOODS)).toBeNull();
    expect(bestMatch("بيتزا مارغريتا", SEED_FOODS)).toBeNull();
    expect(bestMatch("شاورما", SEED_FOODS)).toBeNull();
  });
  it("البحث أثناء الكتابة يعطي نتائج", () => {
    expect(searchFoods("دجا", SEED_FOODS).length).toBeGreaterThan(0);
  });
  it("يحسب القيم حسب الوزن", () => {
    expect(scaleMacros({ kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }, 150)).toEqual({ kcal: 195, protein: 4.1, carbs: 42, fat: 0.5 });
  });
  it("كل أكلة في القاعدة قيمها منطقية", () => {
    for (const f of SEED_FOODS) {
      const calc = f.protein * 4 + f.carbs * 4 + f.fat * 9;
      // الخضار فيها ألياف فالفرق النسبي أكبر، نسمح بهامش أوسع للأكلات الخفيفة
      const tol = f.kcal < 60 ? 0.35 : 0.2;
      expect(Math.abs(calc - f.kcal) / f.kcal, f.name).toBeLessThan(tol);
    }
  });
});
