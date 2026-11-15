// تحليل النص المكتوب ("رز أبيض مطبوخ 150 غ") والبحث في مكتبتي، وحساب القيم حسب الكمية

import type { Macros, Unit } from "./types";
export type { Macros };

export interface MatchableFood {
  name: string;
  nameEn?: string;
  brand?: string;
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(AR_DIGITS.indexOf(c)))
    .replace(/[۰-۹]/g, (c) => String(FA_DIGITS.indexOf(c)))
    .replace(/٫/g, ".");
}

/** توحيد الكتابة العربية للمقارنة: بدون تشكيل، والألفات والتاء المربوطة والياء موحدة */
export function normalizeAr(s: string): string {
  return normalizeDigits(s)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ML_RE = "(?:مل|ملل|مللي|ml)";
const G_RE = "(?:غرام|غرامات|غم|غ|جرام|جم|grams?|gr|gm|g)";

/** يفصل اسم الأكلة عن الكمية المكتوبة. يقبل الأرقام العربية والإنجليزية */
export function parseFoodInput(raw: string): { name: string; amount: number | null; unit: Unit | null } {
  const s = normalizeDigits(raw).trim();
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${ML_RE}|${G_RE})?(?=\\s|$)`, "i");
  const m = s.match(re);
  if (!m) return { name: s.replace(/\s+/g, " ").trim(), amount: null, unit: null };
  const amount = parseFloat(m[1]);
  const unit: Unit | null = m[2] ? (new RegExp(`^${ML_RE}$`, "i").test(m[2]) ? "ml" : "g") : null;
  const name = (s.slice(0, m.index) + " " + s.slice((m.index ?? 0) + m[0].length)).replace(/\s+/g, " ").trim();
  return { name, amount: amount > 0 ? amount : null, unit };
}

function stripAl(token: string): string {
  return token.length > 3 && token.startsWith("ال") ? token.slice(2) : token;
}

function tokens(s: string): string[] {
  return normalizeAr(s).split(" ").filter(Boolean).map(stripAl);
}

/** درجة التطابق بين النص وأكلة (0 = لا يوجد، 100 = تطابق تام) */
export function scoreMatch(query: string, food: MatchableFood): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  const qJoined = q.join(" ");
  const labels = [food.name];
  if (food.nameEn) labels.push(food.nameEn);
  if (food.brand) labels.push(`${food.name} ${food.brand}`, food.brand);
  let best = 0;
  for (const label of labels) {
    const l = tokens(label);
    if (l.length === 0) continue;
    const lJoined = l.join(" ");
    if (lJoined === qJoined) return 100;
    const covered = l.filter((t) => q.includes(t)).length;
    const qCovered = q.filter((t) => l.includes(t)).length;
    if (covered === l.length) {
      best = Math.max(best, Math.min(50 + 40 * (l.length / q.length), 95));
    } else if (qCovered === q.length) {
      // كل اللي كتبته موجود في الاسم (مثلاً "دجاج" ← "صدر دجاج مطبوخ")
      best = Math.max(best, 40 + 30 * (q.length / l.length));
    } else if (covered > 0) {
      best = Math.max(best, 20 * (covered / l.length));
    } else if (q.length === 1 && q[0].length >= 2 && l.some((t) => t.startsWith(q[0]))) {
      best = Math.max(best, 30); // بداية كلمة (أثناء الكتابة)
    }
  }
  return best;
}

export function searchFoods<T extends MatchableFood>(query: string, foods: T[], limit = 8): { food: T; score: number }[] {
  return foods
    .map((food) => ({ food, score: scoreMatch(query, food) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** القيم محفوظة حسب الكمية المرجعية (مثلاً 100 غ). نحسبها حسب الكمية اللي أكلتها */
export function scaleMacros(per: Macros, amount: number, refAmount = 100): Macros {
  const f = refAmount > 0 && amount > 0 ? amount / refAmount : 0;
  return {
    kcal: Math.round(per.kcal * f),
    protein: round1(per.protein * f),
    carbs: round1(per.carbs * f),
    fat: round1(per.fat * f),
  };
}
