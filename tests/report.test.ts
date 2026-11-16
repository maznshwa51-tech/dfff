import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import { validateLabel } from "@/lib/label";
import { computeReportData, reportText } from "@/lib/report";
import { reportEmail } from "@/lib/report-email";
import { isDue, runDailyReports, sendReportFor, whatsappParams, type ReportDeps } from "@/lib/report-job";
import { DEFAULT_SETTINGS as S } from "@/lib/targets";
import type { RawData } from "@/lib/stats";

const DATE = "2026-11-14"; // سبت = ملاكمة
const raw: RawData = {
  entries: [{ id: "1", date: DATE, meal: "lunch", name: "دجاج", amount: 200, unit: "g", kcal: 1850, protein: 112, carbs: 210, fat: 55, createdAt: 0 }],
  weights: new Map([["2026-11-13", 75], [DATE, 74.6]]),
  steps: new Map([[DATE, 9200]]),
  sessions: new Map([[DATE, { id: DATE, date: DATE, type: "boxing", done: true, updatedAt: 0 }]]),
  overrides: new Map(),
};

describe("نص التقرير", () => {
  it("فيه كل الأرقام", () => {
    const r = computeReportData(DATE, raw, S, [], "ar");
    expect(r).toMatchObject({ kcal: 1850, kcalTarget: 1900, protein: 112, proteinTarget: 110, steps: 9200, weight: 74.6, avg7: 74.8, workout: { name: "ملاكمة", done: true } });
    const text = reportText(r, "ar", "استمر يا بطل").replace(/[\u2066\u2069]/g, "");
    expect(reportText(r, "ar", "")).toContain("\u20661,850 / 1,900\u2069");
    expect(text).toContain("🔥 السعرات: 1,850 / 1,900");
    expect(text).toContain("💪 البروتين: 112 / 110 غ");
    expect(text).toContain("ملاكمة ✅");
    expect(text).toContain("74.6 كغ (متوسط 7 أيام: 74.8)");
    expect(reportText(computeReportData(DATE, raw, S, [], "en"), "en")).toContain("Boxing ✅");
  });
  it("تمرين ما خلص ← ❌، والراحة", () => {
    const r = computeReportData(DATE, { ...raw, sessions: new Map() }, S, [], "ar");
    expect(reportText(r, "ar")).toContain("ملاكمة ❌");
    const mon = computeReportData("2026-11-16", raw, S, [], "ar");
    expect(mon.workout).toBeNull();
    expect(reportText(mon, "ar")).toContain("يوم راحة");
  });
  it("قالب الإيميل ومتغيرات واتساب", () => {
    const r = computeReportData(DATE, raw, S, [], "ar");
    const m = reportEmail(r, "ar", "<b>هلا</b>", "https://x.app");
    expect(m.html).toContain('dir="rtl"');
    expect(m.html).toContain("&lt;b&gt;هلا&lt;/b&gt;"); // آمن من HTML
    expect(m.html).toContain("#d4af6a");
    const p = whatsappParams(r, "ar", "سطر\nثاني");
    expect(p).toHaveLength(9);
    expect(p[1].replace(/[\u2066\u2069]/g, "")).toBe("1,850 / 1,900");
  });
});

describe("وقت الإرسال", () => {
  const s = { ...S, report: { ...S.report, enabled: true, time: "21:30", timezone: "Asia/Dubai" } };
  it("يحسب حسب توقيت دبي مع هامش", () => {
    expect(isDue(s, new Date("2026-11-14T17:30:00Z"), 0)).toEqual({ due: true, date: DATE }); // 21:30 دبي
    expect(isDue(s, new Date("2026-11-14T17:00:00Z"), 0).due).toBe(false); // 21:00
    expect(isDue(s, new Date("2026-11-14T17:00:00Z"), 60).due).toBe(true); // Vercel المجاني
    expect(isDue({ ...s, report: { ...s.report, enabled: false } }, new Date("2026-11-14T19:00:00Z"), 0).due).toBe(false);
  });
});

function fakeDeps(over: Partial<ReportDeps> = {}) {
  const sent: string[] = [];
  const log = new Set<string>();
  const deps: ReportDeps = {
    now: new Date("2026-11-14T17:40:00Z"),
    toleranceMinutes: 0,
    listSettings: async () => [
      { userId: "u1", settings: { ...S, report: { ...S.report, enabled: true, channel: "both", whatsapp: "971500000000" } } },
      { userId: "u2", settings: { ...S, report: { ...S.report, enabled: true, time: "23:00" } } },
      { userId: "u3", settings: { ...S } }, // ما فعّل التقرير
    ],
    loadData: async () => ({ raw, types: [] }),
    userEmail: async (id) => `${id}@example.com`,
    alreadySent: async (u, d) => log.has(u + d),
    markSent: async (u, d) => void log.add(u + d),
    sendEmail: async (to, subject) => void sent.push(`email:${to}:${subject}`),
    sendWhatsApp: async (to, params) => void sent.push(`wa:${to}:${params.length}`),
    encourage: async () => null,
    ...over,
  };
  return { deps, sent };
}

describe("مهمة التقرير اليومي", () => {
  it("يرسل لمن حان وقته مرة وحدة باليوم", async () => {
    const { deps, sent } = fakeDeps();
    const r1 = await runDailyReports(deps);
    expect(r1).toHaveLength(1);
    expect(sent).toEqual(["email:u1@example.com:📊 تقرير يومك 14/11", "wa:971500000000:9"]);
    const r2 = await runDailyReports(deps);
    expect(r2).toHaveLength(0);
    expect(sent).toHaveLength(2);
  });
  it("فشل قناة ما يوقف الثانية، وGemini اختياري", async () => {
    const { deps, sent } = fakeDeps({ sendWhatsApp: async () => { throw new Error("WhatsApp 401"); }, encourage: async () => { throw new Error("429"); } });
    const res = await sendReportFor(deps, "u1", { ...S, report: { ...S.report, channel: "both", whatsapp: "9715" } }, DATE);
    expect(res).toEqual([{ channel: "email", ok: true }, { channel: "whatsapp", ok: false, error: "WhatsApp 401" }]);
    expect(sent).toHaveLength(1);
  });
});

describe("مدرسة كاملة (780 مستخدم)", () => {
  it("يرسل للكل بالتوازي، وGemini لعدد محدود، وما يتجاوز الوقت", async () => {
    let ai = 0;
    const users = Array.from({ length: 780 }, (_, i) => ({ userId: `u${i}`, settings: { ...S, report: { ...S.report, enabled: true } } }));
    const { deps, sent } = fakeDeps({ listSettings: async () => users, encourage: async () => { ai++; return "تشجيع"; }, aiLimit: 15, concurrency: 10 });
    const t0 = Date.now();
    const out = await runDailyReports(deps);
    expect(out).toHaveLength(780);
    expect(sent).toHaveLength(780);
    expect(ai).toBe(15);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
  it("الافتراضي: التقرير مطفي للمستخدمين الجدد", () => {
    expect(S.report.enabled).toBe(false);
  });
});

describe("التحقق من رد قراءة الملصق", () => {
  const ok = { is_nutrition_label: true, name: "زبادي", reference_amount: 100, unit: "g", calories: 61.4, protein: 3.46, carbs: 4.7, fat: 3.3 };
  it("يقبل ويقرّب", () => expect(validateLabel(ok)).toEqual({ name: "زبادي", reference_amount: 100, unit: "g", calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3 }));
  it("يرفض الغلط", () => {
    expect(validateLabel({ ...ok, is_nutrition_label: false })).toBe("not_label");
    expect(validateLabel({ ...ok, protein: -1 })).toBeNull();
    expect(validateLabel({ ...ok, carbs: 90, fat: 30 })).toBeNull(); // أكثر من الكمية
    expect(validateLabel({ ...ok, calories: 2000 })).toBeNull();
    expect(validateLabel({ ...ok, unit: "oz" })).toBeNull();
    expect(validateLabel("x")).toBeNull();
  });
});

describe("الترجمة", () => {
  it("نفس المفاتيح بالعربي والإنجليزي", () => {
    const keys = (o: object, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
});

import { planTotals, validatePlan } from "@/lib/plan";
describe("اقتراح يوم كامل", () => {
  const foods = [
    { id: "a", unit: "g" as const, refAmount: 100, kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
    { id: "b", unit: "g" as const, refAmount: 100, kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { id: "c", unit: "ml" as const, refAmount: 100, kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 },
  ];
  it("يقبل الأكلات اللي من القائمة بس ويقرّب الكميات", () => {
    const p = validatePlan({ meals: [{ meal: "lunch", items: [{ food_id: "a", amount: 152 }, { food_id: "ghost", amount: 100 }, { food_id: "b", amount: -5 }] }, { meal: "breakfast", items: [{ food_id: "c", amount: 5000 }] }], tip: "  يلا  " }, foods)!;
    expect(p.meals.map((m) => m.meal)).toEqual(["breakfast", "lunch"]);
    expect(p.meals[1].items).toEqual([{ foodId: "a", amount: 150 }]);
    expect(p.meals[0].items[0].amount).toBe(1000);
    expect(p.tip).toBe("يلا");
    expect(planTotals(p, new Map(foods.map((f) => [f.id, f])))).toEqual({ kcal: 858, protein: 78.5, carbs: 48, fat: 38.4 });
  });
  it("يرفض الرد الغلط أو الفاضي", () => {
    expect(validatePlan({ meals: [] }, foods)).toBeNull();
    expect(validatePlan({ meals: [{ meal: "lunch", items: [{ food_id: "x", amount: 100 }] }] }, foods)).toBeNull();
    expect(validatePlan("x", foods)).toBeNull();
  });
});

import { validateQuick } from "@/lib/quick";
describe("الإضافة السريعة", () => {
  it("سعراتك هي المرجع إذا كتبتها", () => {
    const r = validateQuick({ action: "estimate", kcal: 300, protein: 3, carbs: 27, fat: 12, note: "كيكات" }, 210, false);
    if (r?.type !== "estimate") throw new Error("expected estimate");
    expect(r.kcal).toBe(210);
    expect(Math.abs(r.protein * 4 + r.carbs * 4 + r.fat * 9 - 210)).toBeLessThan(1.5);
  });
  it("بدون سعرات: Gemini يقدّر كل شي", () => {
    const r = validateQuick({ action: "estimate", kcal: 540, protein: 7, carbs: 66, fat: 27, note: "12 لقيمة متوسطة" }, undefined, false);
    if (r?.type !== "estimate") throw new Error("expected estimate");
    expect(r.kcal).toBe(540);
    expect(r.protein * 4 + r.carbs * 4 + r.fat * 9).toBeLessThanOrEqual(540 * 1.05);
    // بدون kcal من Gemini: نحسبها من الماكروز
    const r2 = validateQuick({ action: "estimate", protein: 10, carbs: 50, fat: 10 }, undefined, false);
    expect(r2).toMatchObject({ type: "estimate", kcal: 330 });
  });
  it("المدى: السعرات الأعلى، والبروتين والكارب والدهون الأقل", () => {
    const r = validateQuick(
      { action: "estimate", kcal_min: 390, kcal_max: 600, protein_min: 5, protein_max: 9, carbs_min: 55, carbs_max: 80, fat_min: 15, fat_max: 26 },
      undefined,
      false,
    );
    expect(r).toMatchObject({ type: "estimate", kcal: 600, protein: 5, carbs: 55, fat: 15, kcalMin: 390, kcalMax: 600 });
    // حتى لو انعكس الترتيب
    expect(validateQuick({ action: "estimate", kcal_min: 600, kcal_max: 390, protein_min: 9, protein_max: 5, carbs_min: 80, carbs_max: 55, fat_min: 26, fat_max: 15 }, undefined, false)).toMatchObject({ kcal: 600, protein: 5, carbs: 55, fat: 15 });
    // سعراتك أنت: المرجع، والقيم الأقل ما تتجاوزها
    const u = validateQuick({ action: "estimate", kcal_min: 210, kcal_max: 210, protein_min: 2, protein_max: 3, carbs_min: 24, carbs_max: 28, fat_min: 10, fat_max: 12 }, 210, false);
    expect(u).toMatchObject({ kcal: 210, protein: 2, carbs: 24, fat: 10 });
    expect(u).not.toHaveProperty("kcalMin");
  });
  it("يحسب القيمة الناقصة من السعرات", () => {
    expect(validateQuick({ action: "estimate", protein: 25, carbs: 40, question: "null" }, 450, false)).toMatchObject({ type: "estimate", protein: 25, carbs: 40, fat: 21.1 });
    expect(validateQuick({ action: "estimate", protein: 25, carbs: 40 }, undefined, false)).toBeNull(); // ما نعرف السعرات
  });
  it("سؤال توضيحي، وبعد سؤالين لازم تقدير", () => {
    expect(validateQuick({ action: "ask", question: "كم حبة؟", options: ["5", "10", "", "15", "20"], kcal: 0, protein: 0, carbs: 0, fat: 0 }, undefined, false)).toEqual({ type: "question", question: "كم حبة؟", options: ["5", "10", "15", "20"] });
    expect(validateQuick({ action: "ask", question: "وش نوعه؟" }, 450, true)).toBeNull();
    expect(validateQuick({ action: "estimate", protein: 1, carbs: 1, fat: 1 }, 900, false)).toBeNull();
  });
});
