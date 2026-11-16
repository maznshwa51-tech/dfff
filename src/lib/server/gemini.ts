import "server-only";
// كل طلبات Gemini تمر من السيرفر فقط. المفتاح GEMINI_API_KEY ما يوصل للمتصفح أبداً
import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { LABEL_PROMPT, validateLabel, type LabelErrorCode, type LabelResult } from "../label";
import { planPrompt, validatePlan, type Plan, type PlanRequest } from "../plan";
import { MAX_QUESTIONS, QUICK_KEYS, quickPrompt, validateQuick, type QuickRequest, type QuickResult } from "../quick";

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
/** للمهام النصية القصيرة (تقدير السعرات السريعة، جملة التشجيع): موديلات سريعة أولاً */
const FAST_MODELS = (process.env.GEMINI_FAST_MODELS || "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
export const FAST_CHAIN = [...new Set([...FAST_MODELS, ...MODEL_CHAIN])];

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

/** رد Gemini ناقص أو غلط: نجرب الموديل اللي بعده */
class InvalidOutput extends Error {}

/** الموديلات اللي كانت مشغولة مؤخراً: نأخرها 5 دقايق عشان ما ننتظرها كل مرة */
const BUSY_MS = 5 * 60_000;
const busyUntil = new Map<string, number>();
function orderedModels(chain: string[]): string[] {
  const now = Date.now();
  const ok = chain.filter((m) => (busyUntil.get(m) ?? 0) <= now);
  const busy = chain.filter((m) => (busyUntil.get(m) ?? 0) > now);
  return [...ok, ...busy];
}

/** أخطاء مؤقتة تستاهل نجرب موديل ثاني */
function isRetryable(e: unknown): boolean {
  if (e instanceof InvalidOutput) return true;
  if (e instanceof ApiError) return [404, 429, 500, 502, 503, 504].includes(e.status);
  const name = (e as { name?: string })?.name;
  return name === "AbortError" || name === "TimeoutError" || e instanceof TypeError; // انتهى الوقت أو مشكلة شبكة
}

/**
 * يجرب الموديلات بالترتيب، وكل محاولة لها وقت محدد، والمجموع ما يتجاوز `totalMs`.
 * يرجع أول نجاح. إذا كل الموديلات فشلت يرمي آخر خطأ.
 */
async function withModels<T>(fn: (model: string, signal: AbortSignal) => Promise<T>, totalMs: number, perTryMs: number, chain: string[] = MODEL_CHAIN): Promise<T> {
  const deadline = Date.now() + totalMs;
  let last: unknown = new GeminiError("upstream", 502);
  let allRateLimited = true;
  for (const model of orderedModels(chain)) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break;
    try {
      return await fn(model, AbortSignal.timeout(Math.min(perTryMs, remaining)));
    } catch (e) {
      last = e;
      if (!(e instanceof ApiError && e.status === 429)) allRateLimited = false;
      if (!isRetryable(e)) throw e;
      if (!(e instanceof InvalidOutput)) busyUntil.set(model, Date.now() + BUSY_MS);
      console.warn(`Gemini ${model} failed (${e instanceof ApiError ? e.status : (e as Error).name}), trying next model`);
    }
  }
  if (allRateLimited && last instanceof ApiError) throw new GeminiError("rate_limit", 429);
  if (last instanceof InvalidOutput) throw new GeminiError("invalid", 502);
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
      FAST_CHAIN,
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
  try {
    return await withModels(
      async (model, signal) => {
        const res = await c.models.generateContent({
          model,
          contents: planPrompt(req),
          config: { responseMimeType: "application/json", responseSchema: PLAN_RESPONSE_SCHEMA, temperature: 0.7, abortSignal: signal },
        });
        let json: unknown;
        try {
          json = JSON.parse(res.text ?? "");
        } catch {
          throw new InvalidOutput("json");
        }
        const plan = validatePlan(json, req.foods);
        if (!plan) throw new InvalidOutput("shape");
        return plan;
      },
      55_000,
      25_000,
    );
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    throw mapError(e);
  }
}

const NUM = { type: Type.NUMBER };
/** seed ثابت + temperature 0: نفس الموديل يعطي نفس الجواب لنفس الأكل */
const QUICK_SEED = 1234;
const QUICK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["ask", "estimate"] },
    question: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    ref: { type: Type.STRING },
    ...Object.fromEntries(QUICK_KEYS.map((k) => [k, NUM])),
    note: { type: Type.STRING },
  },
  required: ["action", ...QUICK_KEYS],
};

/**
 * للإضافة السريعة الدقة أهم من السرعة: الموديلات القوية أولاً، والخفيفة احتياط.
 * تقدر تغيّرها بـ GEMINI_QUICK_MODELS
 */
const QUICK_CHAIN = [
  ...new Set([
    ...(process.env.GEMINI_QUICK_MODELS || `${GEMINI_MODEL},gemini-3.5-flash`).split(",").map((m) => m.trim()).filter(Boolean),
    ...FAST_CHAIN,
  ]),
];

/**
 * البحث في Google (Grounding): يشتغل إذا حسابك في Gemini يسمح فيه (الخطة المجانية غالباً ما تسمح).
 * إذا رفض، نوقفه 6 ساعات ونكمّل بمعرفة Gemini بدون بحث. توقفه نهائياً بـ GEMINI_WEB_SEARCH=off
 */
const SEARCH_ON = (process.env.GEMINI_WEB_SEARCH || "on") !== "off";
let searchOffUntil = 0;

function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const a = text.indexOf("{");
    const b = text.lastIndexOf("}");
    if (a < 0 || b <= a) throw new InvalidOutput("json");
    try {
      return JSON.parse(text.slice(a, b + 1));
    } catch {
      throw new InvalidOutput("json");
    }
  }
}

async function quickWithSearch(c: GoogleGenAI, req: QuickRequest, mustEstimate: boolean): Promise<QuickResult | null> {
  if (!SEARCH_ON || Date.now() < searchOffUntil) return null;
  try {
    const res = await c.models.generateContent({
      model: GEMINI_MODEL,
      contents: quickPrompt(req, { search: true }),
      config: { tools: [{ googleSearch: {} }], temperature: 0, seed: QUICK_SEED, abortSignal: AbortSignal.timeout(20_000) },
    });
    return validateQuick(parseJsonLoose(res.text ?? ""), req.kcal, mustEstimate, req.grams);
  } catch (e) {
    // البحث مو متاح لهذا المفتاح (429/400/403): نوقفه فترة عشان ما نضيّع وقت
    if (e instanceof ApiError && [400, 403, 429].includes(e.status)) searchOffUntil = Date.now() + 6 * 3600_000;
    console.warn(`Gemini web search skipped (${e instanceof ApiError ? e.status : (e as Error).name})`);
    return null;
  }
}

/** تقدير السعرات والماكروز للإضافة السريعة (ممكن يرجع سؤال توضيحي) */
export async function estimateQuick(req: QuickRequest): Promise<QuickResult> {
  const c = client();
  if (!c) throw new GeminiError("no_key", 503);
  const mustEstimate = req.answers.length >= MAX_QUESTIONS;
  const t0 = Date.now();
  const searched = await quickWithSearch(c, req, mustEstimate);
  if (searched) return searched;
  try {
    return await withModels(
      async (model, signal) => {
        const res = await c.models.generateContent({
          model,
          contents: quickPrompt(req),
          // temperature 0: نفس الوصف يعطي نفس التقدير تقريباً كل مرة
          config: { responseMimeType: "application/json", responseSchema: QUICK_RESPONSE_SCHEMA, temperature: 0, seed: QUICK_SEED, abortSignal: signal },
        });
        const r = validateQuick(parseJsonLoose(res.text ?? ""), req.kcal, mustEstimate, req.grams);
        if (!r) throw new InvalidOutput("shape");
        return r;
      },
      Math.max(30_000, 55_000 - (Date.now() - t0)), // المجموع ما يتجاوز حد Vercel (60 ثانية)
      20_000,
      QUICK_CHAIN,
    );
  } catch (e) {
    if (e instanceof GeminiError) throw e;
    throw mapError(e);
  }
}
