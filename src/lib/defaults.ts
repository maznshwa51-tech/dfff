// البيانات الافتراضية. المعرّفات ثابتة عشان لو انضافت من جهازين ما تتكرر

import type { Category, Food, Unit, WorkoutType } from "./types";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-dairy", key: "dairy", name: "ألبان", order: 1 },
  { id: "cat-protein", key: "protein", name: "بروتينات", order: 2 },
  { id: "cat-carbs", key: "carbs", name: "نشويات", order: 3 },
  { id: "cat-fruits", key: "fruits", name: "فواكه", order: 4 },
  { id: "cat-vegetables", key: "vegetables", name: "خضار", order: 5 },
  { id: "cat-fats", key: "fats", name: "دهون ومكسرات", order: 6 },
  { id: "cat-snacks", key: "snacks", name: "سناكات", order: 7 },
  { id: "cat-drinks", key: "drinks", name: "مشروبات", order: 8 },
];

export const BUILTIN_WORKOUTS: WorkoutType[] = [
  { id: "boxing", name: "ملاكمة", kind: "simple", builtin: true },
  { id: "sparring", name: "سبار", kind: "simple", builtin: true },
  { id: "cycling", name: "سيكل", kind: "distance", builtin: true },
  { id: "home", name: "تمرين البيت", kind: "rounds", builtin: true },
];

/** تمارين جولة البيت (ثابتة) */
export const HOME_EXERCISES = ["pushups", "squats", "plank", "lunges"] as const;

type Seed = [cat: string, name: string, nameEn: string, kcal: number, protein: number, carbs: number, fat: number, unit?: Unit];

// القيم لكل 100 غ (أو 100 مل للمشروبات)، تقريبية من جداول التغذية المعروفة. تقدر تعدلها أو تحذفها
const SEEDS: Seed[] = [
  ["dairy", "بيض", "Eggs", 143, 12.6, 0.7, 9.5],
  ["dairy", "زبادي عادي", "Plain yogurt", 61, 3.5, 4.7, 3.3],
  ["dairy", "زبادي يوناني", "Greek yogurt", 73, 10, 3.9, 2],
  ["dairy", "لبنة", "Labneh", 160, 6.5, 4.5, 13],
  ["dairy", "جبن أبيض", "White cheese", 264, 14.2, 4.1, 21.3],
  ["dairy", "جبن قريش", "Cottage cheese", 98, 11.1, 3.4, 4.3],
  ["protein", "صدر دجاج مطبوخ", "Chicken breast, cooked", 165, 31, 0, 3.6],
  ["protein", "أفخاذ دجاج مطبوخة", "Chicken thighs, cooked", 209, 26, 0, 10.9],
  ["protein", "تونة معلبة بالماء", "Canned tuna in water", 116, 25.5, 0, 0.8],
  ["protein", "لحم مفروم مطبوخ", "Ground beef, cooked", 250, 26, 0, 15],
  ["protein", "سمك أبيض مطبوخ", "White fish, cooked", 105, 23, 0, 1],
  ["protein", "عدس مطبوخ", "Lentils, cooked", 116, 9, 20, 0.4],
  ["protein", "فول مدمس", "Foul medames", 110, 7.6, 19.7, 0.4],
  ["protein", "حمص مطبوخ", "Chickpeas, cooked", 164, 8.9, 27.4, 2.6],
  ["carbs", "رز أبيض مطبوخ", "White rice, cooked", 130, 2.7, 28, 0.3],
  ["carbs", "خبز أسمر", "Brown bread", 247, 13, 41, 3.4],
  ["carbs", "خبز أبيض", "White bread", 275, 9, 55, 1.2],
  ["carbs", "مكرونة مطبوخة", "Pasta, cooked", 158, 5.8, 31, 0.9],
  ["carbs", "شوفان", "Oats", 389, 16.9, 66.3, 6.9],
  ["carbs", "بطاطس مسلوقة", "Boiled potato", 87, 1.9, 20, 0.1],
  ["fruits", "تمر", "Dates", 282, 2.5, 75, 0.4],
  ["fruits", "موز", "Banana", 89, 1.1, 22.8, 0.3],
  ["fruits", "تفاح", "Apple", 52, 0.3, 13.8, 0.2],
  ["fruits", "برتقال", "Orange", 47, 0.9, 11.8, 0.1],
  ["vegetables", "خيار", "Cucumber", 15, 0.7, 3.6, 0.1],
  ["vegetables", "طماطم", "Tomato", 18, 0.9, 3.9, 0.2],
  ["vegetables", "خس", "Lettuce", 15, 1.4, 2.9, 0.2],
  ["vegetables", "جزر", "Carrot", 41, 0.9, 9.6, 0.2],
  ["vegetables", "بروكلي", "Broccoli", 34, 2.8, 6.6, 0.4],
  ["fats", "مكسرات مشكلة", "Mixed nuts", 607, 20, 21, 54],
  ["fats", "لوز", "Almonds", 579, 21, 21.6, 49.9],
  ["fats", "زبدة فول سوداني", "Peanut butter", 588, 25, 20, 50],
  ["fats", "زيت زيتون", "Olive oil", 884, 0, 0, 100],
  ["snacks", "عسل", "Honey", 304, 0.3, 82, 0],
  ["drinks", "حليب كامل الدسم", "Whole milk", 61, 3.2, 4.8, 3.3, "ml"],
  ["drinks", "حليب قليل الدسم", "Low-fat milk", 42, 3.4, 5, 1, "ml"],
  ["drinks", "عصير برتقال", "Orange juice", 45, 0.7, 10.4, 0.2, "ml"],
];

export const DEFAULT_FOODS: Food[] = SEEDS.map(([cat, name, nameEn, kcal, protein, carbs, fat, unit], i) => ({
  id: `seed-${String(i + 1).padStart(3, "0")}`,
  categoryId: `cat-${cat}`,
  name,
  nameEn,
  refAmount: 100,
  unit: unit ?? "g",
  kcal,
  protein,
  carbs,
  fat,
  createdAt: 0,
}));
