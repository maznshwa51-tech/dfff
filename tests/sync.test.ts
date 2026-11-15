import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { AppDB, getMeta } from "@/lib/db";
import { ensureDefaults, migrateLegacy } from "@/lib/bootstrap";
import { putRow, removeRow, patchRow } from "@/lib/repo";
import { prepareForUser, syncOnce, type RemoteAdapter, type RemoteRecord } from "@/lib/sync";
import { exportAll, importAll, validateBackup } from "@/lib/backup";
import { DEFAULT_CATEGORIES, DEFAULT_FOODS } from "@/lib/defaults";

/** سيرفر وهمي بنفس سلوك جدول records */
class FakeServer {
  rows = new Map<string, RemoteRecord & { user_id: string }>();
  clock = 1_700_000_000_000;
  adapter(userId: string): RemoteAdapter {
    return {
      push: async (rows) => {
        for (const r of rows) this.rows.set(`${userId}|${r.table_name}|${r.id}`, { ...r, user_id: userId, updated_at: new Date(++this.clock).toISOString() });
      },
      pull: async (since, limit) =>
        [...this.rows.values()]
          .filter((r) => r.user_id === userId && (!since || r.updated_at > since))
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
          .slice(0, limit),
    };
  }
}

let n = 0;
const fresh = () => new AppDB(`t-${++n}`);

describe("المزامنة بين جهازين", () => {
  it("التعديلات والحذف تنتقل بين الجوال والآيباد", async () => {
    const server = new FakeServer();
    const phone = fresh(), ipad = fresh();
    const r = server.adapter("u1");
    await prepareForUser(phone, "u1");
    await prepareForUser(ipad, "u1");

    await putRow("weights", { id: "2026-11-15", date: "2026-11-15", kg: 75 }, phone);
    await putRow("steps", { id: "2026-11-15", date: "2026-11-15", count: 9000 }, phone);
    expect(await phone.outbox.count()).toBe(2);
    await syncOnce(phone, r);
    expect(await phone.outbox.count()).toBe(0);
    await syncOnce(ipad, r);
    expect(await ipad.weights.get("2026-11-15")).toMatchObject({ kg: 75 });

    // تعديل من الآيباد وحذف
    await patchRow<{ id: string; kg: number }>("weights", "2026-11-15", { kg: 74.6 }, ipad);
    await removeRow("steps", "2026-11-15", ipad);
    await syncOnce(ipad, r);
    await syncOnce(phone, r);
    expect(await phone.weights.get("2026-11-15")).toMatchObject({ kg: 74.6 });
    expect(await phone.steps.get("2026-11-15")).toBeUndefined();
  });

  it("التعديل المحلي اللي ما ارتفع ما ينكتب فوقه", async () => {
    const server = new FakeServer();
    const a = fresh(), b = fresh();
    await prepareForUser(a, "u"); await prepareForUser(b, "u");
    await putRow("weights", { id: "d", date: "d", kg: 70 }, a);
    await syncOnce(a, server.adapter("u"));
    await putRow("weights", { id: "d", date: "d", kg: 71 }, b); // b ما سحب للحين
    await b.transaction("rw", b.outbox, () => {}); // لا شيء
    const { pullChanges } = await import("@/lib/sync");
    await pullChanges(b, server.adapter("u"));
    expect((await b.weights.get("d"))!.kg).toBe(71);
    await syncOnce(b, server.adapter("u"));
    await syncOnce(a, server.adapter("u"));
    expect((await a.weights.get("d"))!.kg).toBe(71);
  });

  it("أول تسجيل دخول يرفع البيانات المحلية، وتبديل الحساب يمسحها", async () => {
    const server = new FakeServer();
    const db = fresh();
    // بيانات قبل تسجيل الدخول (بدون outbox، مثلاً من النقل)
    await db.weights.put({ id: "x", date: "x", kg: 80 });
    expect(await prepareForUser(db, "u1")).toBe("first");
    await syncOnce(db, server.adapter("u1"));
    expect([...server.rows.keys()]).toContain("u1|weights|x");
    expect(await prepareForUser(db, "u1")).toBe("same");
    expect(await prepareForUser(db, "u2")).toBe("switched");
    expect(await db.weights.count()).toBe(0);
    await syncOnce(db, server.adapter("u2"));
    expect(await db.weights.count()).toBe(0); // ما يشوف بيانات u1
  });

  it("الافتراضيات ما تتكرر ولا ترجع بعد الحذف", async () => {
    const server = new FakeServer();
    const a = fresh();
    await prepareForUser(a, "u");
    await ensureDefaults(a);
    expect(await a.categories.count()).toBe(DEFAULT_CATEGORIES.length);
    expect(await a.foods.count()).toBe(DEFAULT_FOODS.length);
    await removeRow("foods", "seed-001", a);
    await syncOnce(a, server.adapter("u"));
    // جهاز جديد: يسحب أولاً ثم ensureDefaults
    const b = fresh();
    await prepareForUser(b, "u");
    await syncOnce(b, server.adapter("u"));
    await ensureDefaults(b);
    expect(await b.foods.get("seed-001")).toBeUndefined();
    expect(await b.categories.count()).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe("نقل بيانات النسخة الأولى", () => {
  it("ينقل الأكل والوزن والتمارين والمفضلة", async () => {
    const old = new Dexie("legacy-test");
    old.version(1).stores({ foods: "++id, name, source", entries: "++id, date", weights: "&date", waists: "&date", steps: "&date", workouts: "++id, date", workoutTypes: "++id, &name", favorites: "++id", dayTypes: "&date", settings: "&key" });
    await old.open();
    const tunaId = await old.table("foods").add({ name: "تونة معلبة بالماء", kcal: 116, protein: 25.5, carbs: 0, fat: 0.8, source: "seed" });
    const kabsaId = await old.table("foods").add({ name: "كبسة دجاج", kcal: 180, protein: 10, carbs: 22, fat: 6, source: "ai" });
    await old.table("entries").bulkAdd([
      { date: "2026-11-10", meal: "lunch", name: "كبسة دجاج", grams: 300, foodId: kabsaId, kcal: 540, protein: 30, carbs: 66, fat: 18, createdAt: 1 },
      { date: "2026-11-10", meal: "dinner", name: "تونة معلبة بالماء", grams: 100, foodId: tunaId, kcal: 116, protein: 25.5, carbs: 0, fat: 0.8, createdAt: 2 },
    ]);
    await old.table("weights").put({ date: "2026-11-10", kg: 75.2 });
    await old.table("workouts").add({ date: "2026-11-14", type: "سيكل", durationMin: 60, intensity: "high", distanceKm: 18.5, createdAt: 3 });
    await old.table("favorites").add({ name: "غدائي", items: [{ name: "رز", grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.5 }], createdAt: 4 });
    await old.table("settings").put({ key: "settings", value: { stepsGoal: 8000, kcalTraining: 1900 } });
    old.close();

    const db = fresh();
    expect(await migrateLegacy(db, "legacy-test")).toBeGreaterThan(0);
    const entries = await db.entries.toArray();
    expect(entries).toHaveLength(2);
    const kabsa = entries.find((e) => e.name === "كبسة دجاج")!;
    expect(kabsa).toMatchObject({ amount: 300, unit: "g", kcal: 540 });
    expect((await db.foods.get(kabsa.foodId!))!).toMatchObject({ name: "كبسة دجاج", categoryId: "cat-snacks", refAmount: 100 });
    expect(entries.find((e) => e.name.startsWith("تونة"))!.foodId).toBe("seed-009");
    expect(await db.sessions.get("2026-11-14")).toMatchObject({ type: "cycling", done: true, km: 18.5 });
    expect(await db.weights.get("2026-11-10")).toMatchObject({ kg: 75.2 });
    const s = await db.settings.get("settings");
    expect(s).toMatchObject({ stepsGoal: 8000, kcalTraining: 2150, kcalRest: 1900 });
    expect((await db.favorites.toArray())[0].items[0]).toMatchObject({ amount: 150, unit: "g" });
    // كل شي في قائمة الرفع
    expect(await db.outbox.count()).toBeGreaterThan(5);
    expect(await getMeta(db, "legacyMigrated")).toBe(true);
    expect(await migrateLegacy(db, "legacy-test")).toBe(0); // مرة وحدة بس
  });
});

describe("النسخ الاحتياطي", () => {
  it("تصدير ثم استيراد يستبدل البيانات", async () => {
    const a = fresh();
    await ensureDefaults(a);
    await putRow("weights", { id: "d1", date: "d1", kg: 75 }, a);
    const json = JSON.parse(JSON.stringify(await exportAll(a)));
    const b = fresh();
    await putRow("weights", { id: "old", date: "old", kg: 60 }, b);
    await importAll(b, validateBackup(json));
    expect(await b.weights.toArray()).toEqual([{ id: "d1", date: "d1", kg: 75 }]);
    expect(await b.foods.count()).toBe(DEFAULT_FOODS.length);
    expect(await b.outbox.get(["weights", "old"])).toMatchObject({ op: "delete" });
  });
  it("يرفض ملف غلط", () => {
    expect(() => validateBackup({ foo: 1 })).toThrow("notBackup");
    expect(() => validateBackup({ app: "lyaqa", version: 2, data: { foods: "x" } })).toThrow("invalid");
    expect(() => validateBackup({ app: "lyaqa", version: 1, data: {} })).toThrow("version");
  });
});
