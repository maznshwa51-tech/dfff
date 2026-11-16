import "server-only";
// كل طلبات Gemini تمر من السيرفر فقط. المفتاح GEMINI_API_KEY ما يوصل للمتصفح أبداً
import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { LABEL_PROMPT, validateLabel, type LabelErrorCode, type LabelResult } from "../label";
import { planPrompt, validatePlan, type Plan, type PlanRequest } from "../plan";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
/**
 * موديلات احتياطية: إذا الموديل الأساسي مشغول (ضغط عالي 503، أو حد الطلبات 429، أو تأخر)
 * نجرب اللي بعده تلقائياً. تقدر تغيّرها بـ GEMINI_FALLBACK_MODELS (مفصولة بفاصلة)
 */
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash,gemini-3.1-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
export const MODEL_CHAIN = [...new Set([GEMINI_MODEL, ...FALLBACK_MODELS])];

let ai: GoogleGenAI | null = null;
function client(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  ai ??= new GoogleGenAI({ apiKey: key });
  return ai;
}

export class GeminiError extends Error {
  constructor(public code: LabelErrorCode, public status: number) {
    super(code);
  }
}

/** أخطاء مؤقتة تستاهل نجرب موديل ثاني */
function isRetryable(e: unknown): boolean {
  if (e instanceof ApiError) return [404, 429, 500, 502, 503, 504].includes(e.status);
  const name = (e as { name?: string })?.name;
  return name === "AbortError" || name === "TimeoutError" || e instanceof TypeError; // انتهى الوقت أو مشكلة شبكة
}

/**
 * يجرب الموديلات بالترتيب، وكل محاولة لها وقت محدد، والمجموع ما يتجاوز `totalMs`.
 * يرجع أول نجاح. إذا كل الموديلات فشلت يرمي آخر خطأ.
 */
async function withModels<T>(fn: (model: string, signal: AbortSignal) => Promise<T>, totalMs: number, perTryMs: number): Promise<T> {
  const deadline = Date.now() + totalMs;
  let last: unknown = new GeminiError("upstream", 502);
  let allRateLimited = true;
  for (const model of MODEL_CHAIN) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    try {
      return await fn(model, AbortSignal.timeout(Math.min(perTryMs, remaining)));
    } catch (e) {
      last = e;
      if (!(e instanceof ApiError && e.status === 429)) allRateLimited = false;
      if (!isRetryable(e)) throw e;
      console.warn(`Gemini ${model} failed (${e instanceof ApiError ? e.status : (e as Error).name}), trying next model`);
    }
  }
  if (allRateLimited && last instanceof ApiError) throw new GeminiError("rate_limit", 429);
  throw last;
}

function mapError(e: unknown): GeminiError {
  if (e instanceof GeminiError) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new GeminiError("rate_limit", 429);
    if ([500, 502, 503, 504].includes(e.status)) return new GeminiError("busy", 503);
    if (e.status === 400 && /api key/i.test(e.message)) return new GeminiError("no_key", 503);
    console.error("Gemini API error", e.status, e.message);
    return new GeminiError("upstream", 502);
  }
  const name = (e as { name?: string })?.name;
  if (name === "AbortError" || name === "TimeoutError") return new GeminiError("busy", 503);
  console.error("Gemini error", e);
  return new GeminiError("upstream", 502);
}

const LABEL_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_nutrition_label: { type: Type.BOOLEAN },
    name: { type: Type.STRING },
    reference_amount: { type: Type.NUMBER },
    unit: { type: Type.STRING, enum: ["g", "ml"] },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
    fat: { type: Type.NUMBER },
  },
  required: ["is_nutrition_label", "name", "reference_amount", "unit", "calories", "protein", "carbs", "fat"],
  propertyOrdering: ["is_nutrition_label", "name", "reference_amount", "unit", "calories", "protein", "carbs", "fat"],
};

/** يقرأ صورة ملصق القيم الغذائية ويرجع القيم بعد التحقق منها */
export async function readLabel(image: { data: string; mimeType: string }): Promise<LabelResult> {
  const c = client();
  if (!c) throw new GeminiError("no_key", 503);
  let text: string | undefined;
  try {
    const res = await withModels(
      (model, signal) =>
        c.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ inlineData: { data: image.data, mimeType: image.mimeType } }, { text: LABEL_PROMPT }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: LABEL_RESPONSE_SCHEMA,
            temperature: 0,
            abortSignal: signal,
          },
        }),
      55_000,
      15_000,
    );
    text = res.text;
  } catch (e) {
    throw mapError(e);
  }
  let json: unknown;
  try {
    json = JSON.parse(text ?? "");
  } catch {
    throw new GeminiError("invalid", 502);
  }
  const v = validateLabel(json);
  if (v === "not_label") throw new GeminiError("not_label", 422);
  if (!v) throw new GeminiError("invalid", 502);
  return v;
}

/** جملة تشجيع قصيرة. يرجع null إذا ما اشتغل (ونستخدم جملة جاهزة) */
export async function encouragement(prompt: string): Promise<string | null> {
  const c = client();
  if (!c) return null;
  try {
    const res = await withModels(
      (model, signal) => c.models.generateContent({ model, contents: prompt, config: { temperature: 0.9, abortSignal: signal } }),
      25_000,
      12_000,
    );
    const line = (res.text ?? "").replace(/\s+/g, " ").replace(/^["'«]|["'»]$/g, "").trim();
    return line && line.length <= 220 ? line : null;
  } catch (e) {
    console.warn("encouragement failed", e instanceof ApiError ? e.status : e);
    return null;
  }
}

const PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    meals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          meal: { type: Type.STRING, enum: ["breakfast", "lunch", "dinner", "snack"] },
          items: {
            type: Type.ARRAY,
            items: { type: Type.OBJECT, properties: { food_id: { type: Type.STRING }, amount: { type: Type.NUMBER } }, required: ["food_id", "amount"] },
          },
        },
        required: ["meal", "items"],
      },
    },
    tip: { type: Type.STRING },
  },
  required: ["meals", "tip"],
};

/** اقتراح أكل يوم كامل من أكلات المستخدم (نرسل أسماء الأكلات وقيمها بس) */
export async function suggestPlan(req: PlanRequest): Promise<Plan> {
  const c = client();
  if (!c) throw new GeminiError("no_key", 503);
  let text: string | undefined;
  try {
    const res = await withModels(
      (model, signal) =>
        c.models.generateContent({
          model,
          contents: planPrompt(req),
          config: { responseMimeType: "application/json", responseSchema: PLAN_RESPONSE_SCHEMA, temperature: 0.7, abortSignal: signal },
        }),
      55_000,
      25_000,
    );
    text = res.text;
  } catch (e) {
    throw mapError(e);
  }
  let json: unknown;
  try {
    json = JSON.parse(text ?? "");
  } catch {
    throw new GeminiError("invalid", 502);
  }
  const plan = validatePlan(json, req.foods);
  if (!plan) throw new GeminiError("invalid", 502);
  return plan;
}
