// تحليل النص المكتوب ("رز أبيض مطبوخ 150 غ") والبحث في قاعدة الأكلات

export interface MatchableFood {
  name: string;
  aliases?: string[];
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
    .replace(/[ً-ٰٟـ]/g, "") // تشكيل وتطويل
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const UNIT_RE =
  "(?:غرام|غرامات|غم|غ|جرام|جم|ج|grams?|gr|gm|g)";

/** يفصل اسم الأكلة عن الوزن بالغرام. يقبل الأرقام العربية والإنجليزية */
export function parseFoodInput(raw: string): { name: string; grams: number | null } {
  const s = normalizeDigits(raw).trim();
  // رقم + وحدة اختيارية، في أي مكان (غالباً في الآخر)
  const re = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${UNIT_RE}?(?=\\s|$)`, "i");
  const m = s.match(re);
  if (!m) return { name: s.replace(/\s+/g, " ").trim(), grams: null };
  const grams = parseFloat(m[1]);
  const name = (s.slice(0, m.index) + " " + s.slice((m.index ?? 0) + m[0].length))
    .replace(/\s+/g, " ")
    .trim();
  return { name, grams: grams > 0 ? grams : null };
}

function stripAl(token: string): string {
  return token.length > 3 && token.startsWith("ال") ? token.slice(2) : token;
}

function tokens(s: string): string[] {
  return normalizeAr(s).split(" ").filter(Boolean).map(stripAl);
}

/**
 * درجة التطابق بين النص وأكلة. 0 = لا يوجد تطابق.
 * 100 = تطابق تام مع الاسم أو أحد الأسماء البديلة.
 */
export function scoreMatch(query: string, food: MatchableFood): number {
  const q = tokens(query);
  if (q.length === 0) return 0;
  const qJoined = q.join(" ");
  let best = 0;
  for (const label of [food.name, ...(food.aliases ?? [])]) {
    const l = tokens(label);
    if (l.length === 0) continue;
    const lJoined = l.join(" ");
    if (lJoined === qJoined) return 100;
    // كل كلمات الاسم موجودة في النص المكتوب
    const covered = l.filter((t) => q.includes(t)).length;
    if (covered === l.length) {
      // كلما غطّى الاسم نسبة أكبر من النص كان أفضل
      const s = 50 + 40 * (l.length / q.length);
      best = Math.max(best, Math.min(s, 95));
    } else if (covered > 0) {
      best = Math.max(best, 20 * (covered / l.length));
    } else if (lJoined.startsWith(qJoined) && qJoined.length >= 2) {
      // بداية كلمة (للبحث أثناء الكتابة)
      best = Math.max(best, 30);
    }
  }
  return best;
}

export function searchFoods<T extends MatchableFood>(query: string, foods: T[], limit = 6): { food: T; score: number }[] {
  return foods
    .map((food) => ({ food, score: scoreMatch(query, food) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
    .slice(0, limit);
}

/** أفضل أكلة مطابقة بثقة كافية، أو null (عندها نسأل Claude) */
export function bestMatch<T extends MatchableFood>(query: string, foods: T[]): T | null {
  const [top] = searchFoods(query, foods, 1);
  return top && top.score >= 75 ? top.food : null;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function scaleMacros(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: Math.round(per100.kcal * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
  };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
