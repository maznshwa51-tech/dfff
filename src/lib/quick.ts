// الإضافة السريعة: Gemini يقدّر البروتين والكارب والدهون (إجباري)، والسعرات من عندك أو من عنده
// وممكن يسألك سؤال أو سؤالين إذا الوصف ناقص
import { z } from "zod";
import { round1 } from "./food-match";
import { referenceTable, refFood } from "./food-reference";

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
      /** الوزن اللي انحسب عليه (غرام) */
      grams: number;
      /** المدى اللي قاله Gemini للسعرات (إذا ما كتبتها أنت) */
      kcalMin?: number;
      kcalMax?: number;
    };

const macroKcal = (p: number, c: number, f: number) => p * 4 + c * 4 + f * 9;
const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/**
 * Gemini يعطي: كم غرام أكلت + القيم لكل 100 غرام (من - إلى). الحساب نسويه احنا
 * (القيم لكل 100 غ ثابتة ومعروفة، فالنتيجة متقاربة كل مرة). ونختار بشكل محافظ:
 * - السعرات: الرقم **الأعلى**
 * - البروتين والكارب والدهون: الرقم **الأقل**
 * إذا كتبت السعرات أنت، هي المرجع، والقيم ما تتجاوزها.
 * إذا كتبت الوزن أنت، نستخدمه بدل تقدير Gemini.
 */
export function validateQuick(raw: unknown, userKcal: number | undefined, mustEstimate: boolean, userGrams?: number): QuickResult | null {
  const n = z.number().optional().catch(undefined);
  const S = z.object({
    action: z.enum(["ask", "estimate"]),
    question: z.string().optional(),
    options: z.array(z.string()).optional(),
    grams: n,
    ref: z.string().optional().catch(undefined),
    ...Object.fromEntries(QUICK_KEYS.filter((k) => k !== "grams").map((k) => [k, n])),
    note: z.string().optional(),
  });
  const p = S.safeParse(raw);
  if (!p.success) return null;
  const v = p.data as Record<string, number | undefined> & { action: "ask" | "estimate"; question?: string; options?: string[]; note?: string };
  const lo = (a?: number, b?: number) => {
    const good = [a, b].filter(ok);
    return good.length ? Math.min(...good) : undefined;
  };
  const hi = (a?: number, b?: number) => {
    const good = [a, b].filter((x): x is number => ok(x) && x > 0);
    return good.length ? Math.max(...good) : undefined;
  };
  // الأكل موجود في الجدول المرجعي؟ نستخدم أرقامه الثابتة (نفس النتيجة مهما كان الموديل)
  const ref = refFood(p.data.ref);
  if (ref) {
    [v.kcal100_min, v.kcal100_max] = ref.kcal;
    [v.protein100_min, v.protein100_max] = ref.protein;
    [v.carbs100_min, v.carbs100_max] = ref.carbs;
    [v.fat100_min, v.fat100_max] = ref.fat;
  }
  const kMin = lo(v.kcal100_min, v.kcal100_max);
  const kMax = hi(v.kcal100_min, v.kcal100_max);
  let pr = lo(v.protein100_min, v.protein100_max);
  let cb = lo(v.carbs100_min, v.carbs100_max);
  let ft = lo(v.fat100_min, v.fat100_max);
  const hasNumbers = (kMax ?? 0) > 0 && [pr, cb, ft].filter((x) => x != null && x > 0).length >= 2;
  if (v.action === "ask" && !mustEstimate && !(hasNumbers && !v.question?.trim())) {
    // سؤال واحد قصير: نقص عند أول علامة استفهام
    const question = (v.question ?? "").replace(/\s+/g, " ").trim().replace(/^(.*?[؟?]).*$/, "$1").slice(0, 120);
    if (!question) return null;
    const options = (v.options ?? []).map((o) => o.replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean).slice(0, 4);
    return { type: "question", question, options };
  }
  // لكل 100 غ: ما يمكن تتجاوز 900 سعرة (الزيت الصافي ~900)
  if (kMin == null || kMax == null || kMax > 950) return null;
  // قيمة وحدة ناقصة: نحسبها من الباقي (من أقل السعرات، عشان تبقى محافظة)
  const missing = [pr, cb, ft].filter((x) => x == null).length;
  if (missing > 1) return null;
  if (missing === 1) {
    if (pr == null) pr = Math.max(0, (kMin - 4 * cb! - 9 * ft!) / 4);
    else if (cb == null) cb = Math.max(0, (kMin - 4 * pr - 9 * ft!) / 4);
    else ft = Math.max(0, (kMin - 4 * pr - 4 * cb!) / 9);
  }
  if (pr! + cb! + ft! > 100.5) return null; // أكثر من 100 غ في 100 غ = غلط
  // الوزن: وزنك أنت، وإلا تقدير Gemini. وإذا كتبت السعرات: الوزن = سعراتك ÷ أعلى سعرات لكل 100 غ (عشان القيم تبقى الأقل)
  const aiGrams = ok(v.grams) && v.grams > 0 && v.grams <= 5000 ? v.grams : undefined;
  const grams = userKcal != null ? (userKcal / kMax) * 100 : (userGrams ?? aiGrams);
  if (grams == null || grams <= 0) return null;
  const f = grams / 100;
  const kcal = Math.round(userKcal ?? kMax * f);
  if (kcal <= 0 || kcal > 5000) return null;
  let [P, C, F] = [pr! * f, cb! * f, ft! * f];
  const computed = macroKcal(P, C, F);
  if (computed <= 0 || computed < kcal * 0.3) return null;
  // القيم ما تتجاوز السعرات
  if (computed > kcal * 1.05) [P, C, F] = [P, C, F].map((x) => (x * kcal) / computed);
  const kcalMinTotal = Math.round(kMin * f);
  const range = userKcal == null && kMax > kMin && kcalMinTotal < kcal ? { kcalMin: kcalMinTotal, kcalMax: kcal } : {};
  return {
    type: "estimate",
    kcal,
    protein: round1(P),
    carbs: round1(C),
    fat: round1(F),
    grams: Math.round(grams),
    note: (v.note ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    ...range,
  };
}

export const QUICK_KEYS = [
  "grams",
  "kcal100_min",
  "kcal100_max",
  "protein100_min",
  "protein100_max",
  "carbs100_min",
  "carbs100_max",
  "fat100_min",
  "fat100_max",
] as const;

export function quickPrompt(r: QuickRequest, opts: { search?: boolean } = {}): string {
  const lang = r.locale === "ar" ? "Arabic (Gulf dialect, short and friendly)" : "English";
  const qa = r.answers.map((x, i) => `Q${i + 1}: ${x.q}\nA${i + 1}: ${x.a}`).join("\n");
  const must = r.answers.length >= MAX_QUESTIONS;
  const amount = r.grams
    ? `The user weighed it: ${r.grams} g in total. Set "grams" to ${r.grams}.`
    : r.kcal
      ? `The user says it was ${r.kcal} kcal. Set "grams" to your best estimate of the weight eaten.`
      : `The description may include the amount (e.g. "12 لقيمات" = 12 pieces of luqaimat). Set "grams" = your best single estimate of the TOTAL weight eaten (number of pieces × typical weight of one piece, or a typical portion).`;
  const askRule = must
    ? 'You MUST answer with action "estimate" now (assume the most common version and a typical portion).'
    : r.kcal || r.grams
      ? 'If the food itself is too vague (e.g. unknown type or main ingredient), you may ask ONE short clarifying question with action "ask". Otherwise answer with action "estimate". Do not ask about the calories, the weight or the amount eaten.'
      : 'If the type, size or amount is too unclear (e.g. "sandwich" with no type, "rice" with no amount), you may ask ONE short clarifying question with action "ask" (you may ask about the amount or size). If a count or size is given, or it is a well-known single product, estimate directly with action "estimate".';
  const research = opts.search
    ? "Use Google Search to look up reliable nutrition facts (official product labels/brand websites, USDA FoodData Central, trusted nutrition databases) before answering."
    : "";
  const format = opts.search
    ? `Reply with ONLY one JSON object (no markdown) with keys: action ("ask" or "estimate"), question, options (array), ref, ${QUICK_KEYS.join(", ")}, note.`
    : "";
  return `You are a precise sports nutritionist. A teenage athlete logged a quick food entry: "${r.description}".
${amount}
${qa ? `Previous clarifications:\n${qa}\n` : ""}${askRule}
${research}
REFERENCE TABLE (id: food — typical piece/portion weight):
${referenceTable()}
If the food is one of these (same food, not just similar), set "ref" to its id and use its piece/portion weight to compute "grams". Otherwise set "ref" to "".
Give the nutrition values PER 100 g of this food as eaten (with any usual syrup/sauce/oil), as a narrow range (_min / _max):
kcal100_*, protein100_*, carbs100_*, fat100_* (grams per 100 g).
Accuracy and consistency are critical — the same food must always get the same numbers:
- Use standard reference values (USDA FoodData Central, official product labels, standard Gulf/Emirati recipes). Do not guess randomly.
- The per-100 g values of a food are fixed facts; the range must be narrow (max ±10% around the standard value) and only reflect normal recipe differences.
- For branded products use the official label values (e.g. KitKat 4-finger 41.5 g, ~518 kcal/100 g).
- Check: protein100*4 + carbs100*4 + fat100*9 ≈ kcal100, and protein100 + carbs100 + fat100 ≤ 100.
The description may use Gulf Arabic slang or brand names (e.g. "كيكات" = KitKat, "كندر" = Kinder, "لقيمات", "شاورما", "فلافل", "مندي", "سمبوسة"). For well-known products, brands and common dishes with a clear amount, estimate directly — do not ask.
When you ask, keep "question" short (max 12 words, no emojis, do not list the options inside it), ALWAYS give 2-4 short options in "options" and set all numbers to 0.
When you estimate, ALWAYS fill grams and every _min and _max number, and leave "question" empty.
Use ${lang} for "question", "options" and "note". "note" = very short (max 12 words): the weight you assumed, e.g. "12 حبة × 18 غ = 216 غ".
${format}`.trim();
}
