// نحفظ تقديرات Gemini للإضافة السريعة على الجهاز: نفس الأكل = نفس الأرقام بالضبط كل مرة
import type { QuickRequest, QuickResult } from "./quick";

const KEY = "quick-cache-v1";
const MAX = 200;
type Est = Extract<QuickResult, { type: "estimate" }>;
type Store = Record<string, { r: Est; at: number }>;

/** نفس الوصف بعد تنظيف المسافات والحروف المتشابهة (أ/إ/آ ← ا، ة ← ه، ى ← ي، الأرقام العربية ← إنجليزية) */
export function normalizeFood(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ");
}

export function quickCacheKey(r: QuickRequest): string {
  const ans = r.answers.map((a) => normalizeFood(a.a)).join("|");
  return [normalizeFood(r.description), r.grams ?? "", r.kcal ?? "", ans].join("#");
}

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

export function getCachedQuick(r: QuickRequest): Est | null {
  return read()[quickCacheKey(r)]?.r ?? null;
}

export function setCachedQuick(r: QuickRequest, res: Est): void {
  try {
    const s = read();
    s[quickCacheKey(r)] = { r: res, at: Date.now() };
    const keys = Object.keys(s);
    if (keys.length > MAX) keys.sort((a, b) => s[a].at - s[b].at).slice(0, keys.length - MAX).forEach((k) => delete s[k]);
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function dropCachedQuick(r: QuickRequest): void {
  try {
    const s = read();
    delete s[quickCacheKey(r)];
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
