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
  /** وزن الأكل بالغرام (اختياري): يخلي التقدير أدق */
  grams: z.number().positive().max(5000).optional(),
  answers: z
    .array(z.object({ q: z.string().max(200), a: z.string().max(120) }))
    .max(MAX_QUESTIONS)
    .default([]),
});
export type QuickRequest = z.infer<typeof QuickRequest>;

export type QuickResult =
  | { type: "question"; question: string; options: string[] }
  | {
      type: "estimate";
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
      note: string;
      /** المدى اللي قاله Gemini للسعرات (إذا ما كتبتها أنت) */
      kcalMin?: number;
      kcalMax?: number;
    };

const macroKcal = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;
const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/**
 * يتحقق من رد Gemini. Gemini يعطي مدى (من - إلى) لكل قيمة، ونختار بشكل محافظ:
 * - السعرات: الرقم **الأعلى** (عشان ما نحسبها أقل من الحقيقة)
 * - البروتين والكارب والدهون: الرقم **الأقل**
 * إذا كتبت السعرات أنت، هي المرجع، والقيم ما تتجاوزها.
 */
export function validateQuick(raw: unknown, userKcal: number | undefined, mustEstimate: boolean): QuickResult | null {
  const n = z.number().optional().catch(undefined);
  const S = z.object({
    action: z.enum(["ask", "estimate"]),
    question: z.string().optional(),
    options: z.array(z.string()).optional(),
    kcal_min: n, kcal_max: n,
    protein_min: n, protein_max: n,
    carbs_min: n, carbs_max: n,
    fat_min: n, fat_max: n,
    // صيغة قديمة (رقم واحد) لو الموديل رجعها
    kcal: n, protein: n, carbs: n, fat: n,
    note: z.string().optional(),
  });
  const p = S.safeParse(raw);
  if (!p.success) return null;
  const v = p.data;
  const lo = (...xs: (number | undefined)[]) => {
    const good = xs.filter(ok);
    return good.length ? Math.min(...good) : undefined;
  };
  const hi = (...xs: (number | undefined)[]) => {
    const good = xs.filter((x): x is number => ok(x) && x > 0 && x <= 5000);
    return good.length ? Math.max(...good) : undefined;
  };
  let pr = lo(v.protein_min, v.protein_max, v.protein);
  let cb = lo(v.carbs_min, v.carbs_max, v.carbs);
  let ft = lo(v.fat_min, v.fat_max, v.fat);
  const hasNumbers = [pr, cb, ft].filter((x) => x != null && x > 0).length >= 2;
  if (v.action === "ask" && !mustEstimate && !(hasNumbers && !v.question?.trim())) {
    const question = (v.question ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    if (!question) return null;
    const options = (v.options ?? []).map((o) => o.replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean).slice(0, 4);
    return { type: "question", question, options };
  }
  const aiMax = hi(v.kcal_min, v.kcal_max, v.kcal);
  const aiMinRaw = [v.kcal_min, v.kcal_max, v.kcal].filter((x): x is number => ok(x) && x > 0);
  const aiMin = aiMinRaw.length ? Math.min(...aiMinRaw) : undefined;
  const target = userKcal ?? aiMax;
  // قيمة وحدة ناقصة: نحسبها من الباقي (من أقل السعرات، عشان تبقى محافظة)
  const missing = [pr, cb, ft].filter((x) => x == null).length;
  const base = userKcal ?? aiMin ?? target;
  if (missing > 1 || (missing === 1 && base == null)) return null;
  if (missing === 1 && base != null) {
    if (pr == null) pr = Math.max(0, (base - 4 * cb! - 9 * ft!) / 4);
    else if (cb == null) cb = Math.max(0, (base - 4 * pr - 9 * ft!) / 4);
    else ft = Math.max(0, (base - 4 * pr - 4 * cb!) / 9);
  }
  if (![pr, cb, ft].every(ok)) return null;
  const computed = macroKcal(pr!, cb!, ft!);
  if (computed <= 0) return null;
  const kcal = Math.round(target ?? computed);
  if (kcal <= 0 || kcal > 5000) return null;
  // القيم ما تتجاوز السعرات، وإذا أقل منها بكثير الرد غلط
  let factor = 1;
  if (computed > kcal * 1.05) factor = kcal / computed;
  if (factor < 0.4 || computed < kcal * 0.3) return null;
  const range = userKcal == null && aiMin != null && aiMax != null && aiMax > aiMin ? { kcalMin: Math.round(aiMin), kcalMax: Math.round(aiMax) } : {};
  return {
    type: "estimate",
    kcal,
    protein: round1(pr! * factor),
    carbs: round1(cb! * factor),
    fat: round1(ft! * factor),
    note: (v.note ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    ...range,
  };
}

export const QUICK_KEYS = ["kcal_min", "kcal_max", "protein_min", "protein_max", "carbs_min", "carbs_max", "fat_min", "fat_max"] as const;

export function quickPrompt(r: QuickRequest, opts: { search?: boolean } = {}): string {
  const lang = r.locale === "ar" ? "Arabic (Gulf dialect, short and friendly)" : "English";
  const qa = r.answers.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a}`).join("\n");
  const must = r.answers.length >= MAX_QUESTIONS;
  const weight = r.grams ? ` The user weighed it: ${r.grams} g in total (use this weight — compute from per-100 g values).` : "";
  const head = r.kcal
    ? `A teenage athlete logged a quick food entry: "${r.description}" = ${r.kcal} kcal (the calories are fixed, given by the user).${weight}
Estimate how those ${r.kcal} kcal split into protein, carbs and fat (grams). Set kcal_min and kcal_max to ${r.kcal}.`
    : `A teenage athlete logged a quick food entry: "${r.description}". The description may include the amount (e.g. "12 لقيمات" = 12 pieces of luqaimat, "2 slices").${weight}
Estimate the TOTAL calories and protein, carbs and fat (grams) for the whole amount eaten.`;
  const askRule = must
    ? 'You MUST answer with action "estimate" now (assume the most common version and a typical portion).'
    : r.kcal || r.grams
      ? 'If the description is too vague to estimate well (e.g. unknown type or main ingredient), you may ask ONE short clarifying question with action "ask". Otherwise answer with action "estimate". Do not ask about the calories, the weight or the amount eaten.'
      : 'If the type, size or amount is too unclear to estimate the calories reasonably (e.g. "sandwich" with no type, "rice" with no amount), you may ask ONE short clarifying question with action "ask" (you may ask about the amount or size). If a count or size is given, or it is a well-known single product, estimate directly with action "estimate".';
  const research = opts.search
    ? "Use Google Search to look up reliable nutrition facts (official product labels/brand websites, USDA FoodData Central, trusted nutrition databases, typical Gulf recipes) before answering."
    : "Be careful and accurate: base the numbers on reliable nutrition data you know (official product labels, USDA FoodData Central, trusted nutrition databases, typical Gulf/Emirati recipes). Think about the typical weight of one piece/portion and the per-100 g values, then multiply.";
  const format = opts.search
    ? `Reply with ONLY one JSON object (no markdown) with keys: action ("ask" or "estimate"), question, options (array), ${QUICK_KEYS.join(", ")}, note.`
    : "";
  return `${head}
${qa ? `Previous clarifications:\n${qa}\n` : ""}${askRule}
${research}
Give a realistic RANGE for each value (_min = lowest typical, _max = highest typical) that covers common recipes, brands and piece sizes. If the exact product or weight is known, keep the range narrow.
The description may use Gulf Arabic slang or brand names (e.g. "كيكات" = KitKat, "كندر" = Kinder, "لقيمات", "شاورما", "فلافل", "مندي", "سمبوسة"). For well-known products, brands and common dishes with a clear amount, estimate directly — do not ask.
When you ask, keep "question" short (max 12 words, no emojis, do not list the options inside it), ALWAYS give 2-4 short options in "options" and set all numbers to 0.
When you estimate, ALWAYS fill every _min and _max number, and leave "question" empty.
Rules: protein*4 + carbs*4 + fat*9 should be about the calories. Use ${lang} for "question", "options" and "note". "note" = very short description of what you assumed (max 12 words, e.g. piece weight or portion).
${format}`.trim();
}
