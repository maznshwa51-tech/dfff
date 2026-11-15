// شكل رد قراءة الملصق من Gemini، والتحقق منه قبل ما نعرضه
import { z } from "zod";

export const LabelSchema = z.object({
  is_nutrition_label: z.boolean(),
  name: z.string(),
  reference_amount: z.number(),
  unit: z.enum(["g", "ml"]),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
});
export type LabelRaw = z.infer<typeof LabelSchema>;

export interface LabelResult {
  name: string;
  reference_amount: number;
  unit: "g" | "ml";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type LabelErrorCode = "no_key" | "rate_limit" | "busy" | "not_label" | "too_large" | "auth" | "invalid" | "upstream";

const r1 = (n: number) => Math.round(n * 10) / 10;

/** يتحقق إن القيم منطقية. يرجع null إذا مش صالحة */
export function validateLabel(raw: unknown): LabelResult | "not_label" | null {
  const p = LabelSchema.safeParse(raw);
  if (!p.success) return null;
  const v = p.data;
  if (!v.is_nutrition_label) return "not_label";
  const nums = [v.reference_amount, v.calories, v.protein, v.carbs, v.fat];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (v.reference_amount <= 0 || v.reference_amount > 2000) return null;
  // ما يصير الماكروز أكثر من الكمية نفسها، ولا السعرات أكثر من 9 لكل غرام
  if (v.protein + v.carbs + v.fat > v.reference_amount * 1.05) return null;
  if (v.calories > v.reference_amount * 9.5) return null;
  return {
    name: v.name.trim().slice(0, 80),
    reference_amount: r1(v.reference_amount),
    unit: v.unit,
    calories: Math.round(v.calories),
    protein: r1(v.protein),
    carbs: r1(v.carbs),
    fat: r1(v.fat),
  };
}

export const LABEL_PROMPT = `You are reading a photo of a food product's nutrition facts label.
Extract the values exactly as printed for ONE reference amount: prefer "per 100 g" / "per 100 ml" if printed; otherwise use the per-serving column and its serving size in grams or ml.
- name: the product name if visible on the photo, else a short generic description (e.g. "Greek yogurt"). Keep the label's language.
- reference_amount: the amount (number only) the values refer to, e.g. 100 or 30.
- unit: "g" or "ml".
- calories in kcal (convert from kJ by dividing by 4.184 if only kJ is shown).
- protein, carbs (total carbohydrates), fat (total fat) in grams.
If the image is not a nutrition facts label, set is_nutrition_label to false and use 0 for numbers.
Never guess how much the user ate; only read the label.`;
