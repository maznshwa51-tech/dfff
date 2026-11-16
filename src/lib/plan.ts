// اقتراح أكل يوم كامل من أكلات مكتبتي (Gemini يختار الأكلات والكميات، والحساب من قيمي أنا)
import { z } from "zod";
import { round1, scaleMacros } from "./food-match";
import type { Macros, Meal } from "./types";

export const PLAN_MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;

/** الأكلة كما تنرسل لـ Gemini (بدون أي معلومات شخصية) */
export interface PlanFood {
  id: string;
  name: string;
  category: string;
  refAmount: number;
  unit: "g" | "ml";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** كم مرة أكلتها آخر أسبوع */
  recent: number;
}

export const PlanRequest = z.object({
  locale: z.enum(["ar", "en"]),
  dayType: z.enum(["training", "rest"]),
  targets: z.object({ kcal: z.number().positive().max(6000), protein: z.number().min(0).max(400), carbs: z.number().min(0).max(800), fat: z.number().min(0).max(300) }),
  note: z.string().max(200).optional(),
  foods: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        name: z.string().min(1).max(80),
        category: z.string().max(40),
        refAmount: z.number().positive().max(2000),
        unit: z.enum(["g", "ml"]),
        kcal: z.number().min(0).max(5000),
        protein: z.number().min(0).max(1000),
        carbs: z.number().min(0).max(1000),
        fat: z.number().min(0).max(1000),
        recent: z.number().min(0).max(100),
      }),
    )
    .min(3)
    .max(150),
});
export type PlanRequest = z.infer<typeof PlanRequest>;

export interface PlanItem {
  foodId: string;
  amount: number;
}
export interface Plan {
  meals: { meal: Meal; items: PlanItem[] }[];
  tip: string;
}

/** يتحقق من رد Gemini: أكلات من القائمة بس، وكميات منطقية */
export function validatePlan(raw: unknown, foods: Pick<PlanFood, "id" | "unit">[]): Plan | null {
  const S = z.object({
    meals: z.array(z.object({ meal: z.enum(PLAN_MEALS), items: z.array(z.object({ food_id: z.string(), amount: z.number() })) })),
    tip: z.string().optional(),
  });
  const p = S.safeParse(raw);
  if (!p.success) return null;
  const ids = new Set(foods.map((f) => f.id));
  const meals = PLAN_MEALS.map((meal) => {
    const items: PlanItem[] = [];
    for (const m of p.data.meals.filter((x) => x.meal === meal)) {
      for (const it of m.items) {
        if (!ids.has(it.food_id) || !Number.isFinite(it.amount) || it.amount <= 0) continue;
        // كمية معقولة ومقرّبة لأقرب 5
        const amount = Math.min(1000, Math.max(5, Math.round(it.amount / 5) * 5));
        const same = items.find((x) => x.foodId === it.food_id);
        if (same) same.amount = Math.min(1000, same.amount + amount);
        else items.push({ foodId: it.food_id, amount });
      }
    }
    return { meal, items };
  }).filter((m) => m.items.length > 0);
  if (meals.length === 0) return null;
  return { meals, tip: (p.data.tip ?? "").replace(/\s+/g, " ").trim().slice(0, 240) };
}

/** مجموع الخطة محسوب من قيم أكلاتي أنا (مو من أرقام Gemini) */
export function planTotals(plan: Plan, foods: Map<string, Pick<PlanFood, "refAmount" | "kcal" | "protein" | "carbs" | "fat">>): Macros {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const m of plan.meals)
    for (const it of m.items) {
      const f = foods.get(it.foodId);
      if (!f) continue;
      const x = scaleMacros(f, it.amount, f.refAmount);
      t.kcal += x.kcal;
      t.protein += x.protein;
      t.carbs += x.carbs;
      t.fat += x.fat;
    }
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

export function planPrompt(r: PlanRequest): string {
  const lang = r.locale === "ar" ? "Arabic (Gulf dialect, short and friendly)" : "English";
  const list = r.foods
    .map((f) => `${f.id} | ${f.name} | ${f.category} | per ${f.refAmount}${f.unit}: ${f.kcal} kcal, P ${f.protein}g, C ${f.carbs}g, F ${f.fat}g${f.recent ? ` | eaten ${f.recent}x last week` : ""}`)
    .join("\n");
  return `You are a sports nutrition assistant planning ONE full day of eating for a teenage boxer (${r.dayType === "training" ? "training day" : "rest day"}).
Daily targets: ${r.targets.kcal} kcal, protein at least ${r.targets.protein} g, carbs about ${r.targets.carbs} g, fat about ${r.targets.fat} g.
${r.note ? `User request: ${r.note}\n` : ""}Rules:
- Use ONLY foods from the list below, referenced by their exact id in "food_id". Never invent foods.
- Plan breakfast, lunch, dinner and 1-2 snacks (use meal "snack"). 2-4 items per main meal.
- "amount" is in the food's own unit (g or ml), realistic portions, multiples of 5.
- Hit calories within ±5% and protein at or above target. Compute using the per-amount values given.
- Prefer foods eaten recently, but keep some variety. Spread protein across meals.
- "tip": one short encouraging sentence in ${lang} about the plan (max 25 words). No medical advice.

Foods (id | name | category | values):
${list}`;
}
