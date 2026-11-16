// تقدير البروتين والكارب والدهون للسعرات السريعة (Gemini، وممكن يسألك سؤال أو سؤالين)
import { z } from "zod";
import { round1 } from "./food-match";

export const MAX_QUESTIONS = 2;

export const QuickRequest = z.object({
  locale: z.enum(["ar", "en"]),
  description: z.string().trim().min(1).max(120),
  kcal: z.number().positive().max(5000),
  answers: z
    .array(z.object({ q: z.string().max(200), a: z.string().max(120) }))
    .max(MAX_QUESTIONS)
    .default([]),
});
export type QuickRequest = z.infer<typeof QuickRequest>;

export type QuickResult =
  | { type: "question"; question: string; options: string[] }
  | { type: "estimate"; protein: number; carbs: number; fat: number; note: string };

/**
 * يتحقق من رد Gemini. التقدير يتعدل عشان يطابق السعرات اللي كتبتها أنت بالضبط
 * (السعرات = بروتين×4 + كارب×4 + دهون×9).
 */
export function validateQuick(raw: unknown, kcal: number, mustEstimate: boolean): QuickResult | null {
  const S = z.object({
    action: z.enum(["ask", "estimate"]),
    question: z.string().optional(),
    options: z.array(z.string()).optional(),
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fat: z.number().optional(),
    note: z.string().optional(),
  });
  const p = S.safeParse(raw);
  if (!p.success) return null;
  const v = p.data;
  const hasNumbers = [v.protein, v.carbs, v.fat].filter((n) => n != null && n > 0).length >= 2;
  if (v.action === "ask" && !mustEstimate && !(hasNumbers && !v.question?.trim())) {
    const question = (v.question ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!question) return null;
    const options = (v.options ?? []).map((o) => o.replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean).slice(0, 4);
    return { type: "question", question, options };
  }
  const ok = (n: number | undefined): n is number => n != null && Number.isFinite(n) && n >= 0;
  let [pr, cb, ft] = [v.protein, v.carbs, v.fat];
  const missing = [pr, cb, ft].filter((n) => !ok(n)).length;
  if (missing > 1) return null;
  // قيمة وحدة ناقصة: نحسبها من الباقي من السعرات
  if (!ok(pr)) pr = Math.max(0, (kcal - 4 * (cb as number) - 9 * (ft as number)) / 4);
  if (!ok(cb)) cb = Math.max(0, (kcal - 4 * (pr as number) - 9 * (ft as number)) / 4);
  if (!ok(ft)) ft = Math.max(0, (kcal - 4 * (pr as number) - 4 * (cb as number)) / 9);
  if (![pr, cb, ft].every(ok)) return null;
  const computed = pr * 4 + cb * 4 + ft * 9;
  if (computed <= 0) return null;
  // نقبل فرق معقول بس، وبعدها نعدّل النسب عشان المجموع = سعراتك
  const factor = kcal / computed;
  if (factor < 0.4 || factor > 2.5) return null;
  return {
    type: "estimate",
    protein: round1(pr * factor),
    carbs: round1(cb * factor),
    fat: round1(ft * factor),
    note: (v.note ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
  };
}

export function quickPrompt(r: QuickRequest): string {
  const lang = r.locale === "ar" ? "Arabic (Gulf dialect, short and friendly)" : "English";
  const qa = r.answers.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a}`).join("\n");
  const must = r.answers.length >= MAX_QUESTIONS;
  return `A teenage athlete logged a quick food entry: "${r.description}" = ${r.kcal} kcal (the calories are fixed, given by the user).
Estimate how those ${r.kcal} kcal split into protein, carbs and fat (grams), based on typical recipes/products for this food.
${qa ? `Previous clarifications:\n${qa}\n` : ""}${
    must
      ? 'You MUST answer with action "estimate" now.'
      : 'If the description is too vague to estimate well (e.g. unknown type, size or main ingredient), you may ask ONE short clarifying question with action "ask" and 2-4 short answer options. Otherwise answer with action "estimate". Do not ask about the calories or the amount eaten.'
  }
The description may use Gulf Arabic slang or brand names (e.g. "كيكات" = KitKat, "كندر" = Kinder, "شاورما", "فلافل", "مندي"). For well-known products, brands and common dishes, estimate directly — do not ask.
When you ask, ALWAYS give 2-4 short options in "options" and set protein, carbs and fat to 0.
When you estimate, ALWAYS fill protein, carbs AND fat, and leave "question" empty.
Rules: protein*4 + carbs*4 + fat*9 should equal about ${r.kcal}. Use ${lang} for "question", "options" and "note". "note" = very short reason (max 12 words).`;
}
