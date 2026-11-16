// الإضافة السريعة: Gemini يقدّر البروتين والكارب والدهون (إجباري)، والسعرات من عندك أو من عنده
// وممكن يسألك سؤال أو سؤالين إذا الوصف ناقص
import { z } from "zod";
import { round1 } from "./food-match";

export const MAX_QUESTIONS = 2;

export const QuickRequest = z.object({
  locale: z.enum(["ar", "en"]),
  /** وش أكلت، والكمية إذا تبي (مثلاً: 12 لقيمات) */
  description: z.string().trim().min(1).max(120),
  /** السعرات اختيارية: إذا كتبتها نلتزم فيها، وإذا لا Gemini يقدّرها */
  kcal: z.number().positive().max(5000).optional(),
  answers: z
    .array(z.object({ q: z.string().max(200), a: z.string().max(120) }))
    .max(MAX_QUESTIONS)
    .default([]),
});
export type QuickRequest = z.infer<typeof QuickRequest>;

export type QuickResult =
  | { type: "question"; question: string; options: string[] }
  | { type: "estimate"; kcal: number; protein: number; carbs: number; fat: number; note: string };

const macroKcal = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;

/**
 * يتحقق من رد Gemini.
 * - إذا كتبت السعرات: الماكروز تتعدّل عشان مجموعها = سعراتك بالضبط.
 * - إذا ما كتبتها: نأخذ سعرات Gemini ونضبط الماكروز عليها.
 */
export function validateQuick(raw: unknown, userKcal: number | undefined, mustEstimate: boolean): QuickResult | null {
  const S = z.object({
    action: z.enum(["ask", "estimate"]),
    question: z.string().optional(),
    options: z.array(z.string()).optional(),
    kcal: z.number().optional(),
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
  const aiKcal = ok(v.kcal) && v.kcal > 0 && v.kcal <= 5000 ? v.kcal : undefined;
  const target = userKcal ?? aiKcal;
  let [pr, cb, ft] = [v.protein, v.carbs, v.fat];
  const missing = [pr, cb, ft].filter((n) => !ok(n)).length;
  if (missing > 1 || (missing === 1 && target == null)) return null;
  // قيمة وحدة ناقصة: نحسبها من الباقي من السعرات
  if (target != null) {
    if (!ok(pr)) pr = Math.max(0, (target - 4 * (cb as number) - 9 * (ft as number)) / 4);
    if (!ok(cb)) cb = Math.max(0, (target - 4 * (pr as number) - 9 * (ft as number)) / 4);
    if (!ok(ft)) ft = Math.max(0, (target - 4 * (pr as number) - 4 * (cb as number)) / 9);
  }
  if (![pr, cb, ft].every(ok)) return null;
  const computed = macroKcal(pr as number, cb as number, ft as number);
  if (computed <= 0) return null;
  const kcal = Math.round(target ?? computed);
  // نقبل فرق معقول بس، وبعدها نعدّل النسب عشان المجموع = السعرات
  const factor = kcal / computed;
  if (factor < 0.4 || factor > 2.5 || kcal > 5000) return null;
  return {
    type: "estimate",
    kcal,
    protein: round1((pr as number) * factor),
    carbs: round1((cb as number) * factor),
    fat: round1((ft as number) * factor),
    note: (v.note ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
  };
}

export function quickPrompt(r: QuickRequest): string {
  const lang = r.locale === "ar" ? "Arabic (Gulf dialect, short and friendly)" : "English";
  const qa = r.answers.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a}`).join("\n");
  const must = r.answers.length >= MAX_QUESTIONS;
  const head = r.kcal
    ? `A teenage athlete logged a quick food entry: "${r.description}" = ${r.kcal} kcal (the calories are fixed, given by the user).
Estimate how those ${r.kcal} kcal split into protein, carbs and fat (grams), based on typical recipes/products for this food. Set "kcal" to ${r.kcal}.`
    : `A teenage athlete logged a quick food entry: "${r.description}". The description may include the amount (e.g. "12 لقيمات" = 12 pieces of luqaimat, "2 slices").
Estimate the TOTAL calories ("kcal") and protein, carbs and fat (grams) for the whole amount eaten, based on typical recipes/products and portion sizes.`;
  const askRule = must
    ? 'You MUST answer with action "estimate" now (assume the most common version and a typical portion).'
    : r.kcal
      ? 'If the description is too vague to estimate well (e.g. unknown type or main ingredient), you may ask ONE short clarifying question with action "ask". Otherwise answer with action "estimate". Do not ask about the calories or the amount eaten.'
      : 'If the type, size or amount is too unclear to estimate the calories reasonably (e.g. "sandwich" with no type, "rice" with no amount), you may ask ONE short clarifying question with action "ask" (you may ask about the amount or size). If a count or size is given, or it is a well-known single product, estimate directly with action "estimate".';
  return `${head}
${qa ? `Previous clarifications:\n${qa}\n` : ""}${askRule}
The description may use Gulf Arabic slang or brand names (e.g. "كيكات" = KitKat, "كندر" = Kinder, "لقيمات", "شاورما", "فلافل", "مندي", "سمبوسة"). For well-known products, brands and common dishes with a clear amount, estimate directly — do not ask.
When you ask, ALWAYS give 2-4 short options in "options" and set kcal, protein, carbs and fat to 0.
When you estimate, ALWAYS fill kcal, protein, carbs AND fat, and leave "question" empty.
Rules: protein*4 + carbs*4 + fat*9 should equal about kcal. Use ${lang} for "question", "options" and "note". "note" = very short description of what you assumed (max 12 words, e.g. the portion).`;
}
