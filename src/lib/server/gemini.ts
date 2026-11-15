import "server-only";
// كل طلبات Gemini تمر من السيرفر فقط. المفتاح GEMINI_API_KEY ما يوصل للمتصفح أبداً
import { ApiError, GoogleGenAI, Type } from "@google/genai";
import { LABEL_PROMPT, validateLabel, type LabelErrorCode, type LabelResult } from "../label";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

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

function mapError(e: unknown): GeminiError {
  if (e instanceof GeminiError) return e;
  if (e instanceof ApiError) {
    if (e.status === 429) return new GeminiError("rate_limit", 429);
    if (e.status === 400 && /api key/i.test(e.message)) return new GeminiError("no_key", 503);
    console.error("Gemini API error", e.status, e.message);
    return new GeminiError("upstream", 502);
  }
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
    const res = await c.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ inlineData: { data: image.data, mimeType: image.mimeType } }, { text: LABEL_PROMPT }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: LABEL_RESPONSE_SCHEMA,
        temperature: 0,
        abortSignal: AbortSignal.timeout(30_000),
      },
    });
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
    const res = await c.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { temperature: 0.9, abortSignal: AbortSignal.timeout(10_000) },
    });
    const line = (res.text ?? "").replace(/\s+/g, " ").replace(/^["'«]|["'»]$/g, "").trim();
    return line && line.length <= 220 ? line : null;
  } catch (e) {
    console.warn("encouragement failed", e instanceof ApiError ? e.status : e);
    return null;
  }
}
