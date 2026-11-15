// محرك المزامنة: البيانات تنحفظ على الجهاز أولاً (تشتغل بدون إنترنت)،
// وبعدين ترتفع للحساب وتنزل التغييرات من الأجهزة الثانية.
// السيرفر فيه جدول واحد records: (user_id, table_name, id, data, deleted, updated_at)

import { getMeta, setMeta, type AppDB } from "./db";
import { SYNCED_TABLES, type SyncedTable } from "./types";

export interface RemoteRecord {
  table_name: string;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
}

export interface RemoteAdapter {
  push(rows: Omit<RemoteRecord, "updated_at">[]): Promise<void>;
  /** السجلات اللي تغيرت بعد `since` مرتبة حسب updated_at */
  pull(since: string | null, limit: number): Promise<RemoteRecord[]>;
}

const PAGE = 500;
/** نرجع دقيقتين لورا عشان ما يفوتنا سجل انحفظ في نفس اللحظة */
const OVERLAP_MS = 2 * 60 * 1000;

const isSynced = (t: string): t is SyncedTable => (SYNCED_TABLES as readonly string[]).includes(t);

export async function pushOutbox(db: AppDB, remote: RemoteAdapter): Promise<number> {
  let total = 0;
  for (;;) {
    const items = await db.outbox.orderBy("ts").limit(PAGE).toArray();
    if (!items.length) break;
    const rows = await Promise.all(
      items.map(async (it) => {
        const data = it.op === "put" ? await db.table(it.table).get(it.id) : undefined;
        return { table_name: it.table, id: it.id, data: data ?? null, deleted: !data };
      }),
    );
    await remote.push(rows);
    // نحذف من القائمة فقط اللي ما تغير أثناء الرفع
    await db.transaction("rw", db.outbox, async () => {
      for (const it of items) {
        const cur = await db.outbox.get([it.table, it.id]);
        if (cur && cur.ts === it.ts) await db.outbox.delete([it.table, it.id]);
      }
    });
    total += items.length;
    if (items.length < PAGE) break;
  }
  return total;
}

export async function pullChanges(db: AppDB, remote: RemoteAdapter): Promise<number> {
  const last = await getMeta<string>(db, "lastPulledAt");
  let since = last ? new Date(new Date(last).getTime() - OVERLAP_MS).toISOString() : null;
  let total = 0;
  for (;;) {
    const rows = await remote.pull(since, PAGE);
    if (!rows.length) break;
    const tables = [...new Set(rows.map((r) => r.table_name).filter(isSynced))];
    await db.transaction("rw", [...tables.map((t) => db.table(t)), db.outbox], async () => {
      for (const r of rows) {
        if (!isSynced(r.table_name)) continue;
        // فيه تعديل محلي ما ارتفع للحين ← التعديل المحلي يفوز
        if (await db.outbox.get([r.table_name, r.id])) continue;
        if (r.deleted || !r.data) await db.table(r.table_name).delete(r.id);
        else await db.table(r.table_name).put(r.data);
      }
    });
    total += rows.length;
    const newest = rows[rows.length - 1].updated_at;
    await setMeta(db, "lastPulledAt", newest);
    if (rows.length < PAGE || newest === since) break;
    since = newest;
  }
  return total;
}

export async function syncOnce(db: AppDB, remote: RemoteAdapter) {
  const pushed = await pushOutbox(db, remote);
  const pulled = await pullChanges(db, remote);
  return { pushed, pulled };
}

/**
 * قبل ما نبدأ المزامنة مع حساب:
 * - إذا الجهاز كان مربوط بحساب ثاني ← نمسح البيانات المحلية (ما نخلط بيانات حسابين)
 * - إذا أول مرة يسجل دخول ← البيانات المحلية الموجودة كلها في outbox وبترتفع للحساب
 */
export async function prepareForUser(db: AppDB, userId: string): Promise<"same" | "first" | "switched"> {
  const prev = await getMeta<string>(db, "userId");
  if (prev === userId) return "same";
  if (prev && prev !== userId) {
    await clearLocal(db);
    await setMeta(db, "userId", userId);
    return "switched";
  }
  // أول تسجيل دخول: نتأكد إن كل البيانات المحلية بترتفع
  const ts = Date.now();
  for (const t of SYNCED_TABLES) {
    const ids = (await db.table(t).toCollection().primaryKeys()) as string[];
    if (ids.length) await db.outbox.bulkPut(ids.map((id) => ({ table: t, id, op: "put" as const, ts })));
  }
  await setMeta(db, "userId", userId);
  return "first";
}

export async function clearLocal(db: AppDB) {
  await db.transaction("rw", [...SYNCED_TABLES.map((t) => db.table(t)), db.outbox, db.meta], async () => {
    for (const t of SYNCED_TABLES) await db.table(t).clear();
    await db.outbox.clear();
    await db.meta.where("key").anyOf(["lastPulledAt", "userId", "defaultsSeeded"]).delete();
  });
}
