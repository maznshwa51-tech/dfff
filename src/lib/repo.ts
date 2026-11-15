// كل الكتابة على البيانات تمر من هنا: تنحفظ محلياً + تنضاف لقائمة الرفع (outbox)
// عشان تتزامن مع الحساب لما يكون فيه إنترنت

import { getDb, type AppDB } from "./db";
import type { SyncedTable } from "./types";

type Row = { id: string };
const listeners = new Set<() => void>();

/** يُستدعى بعد أي تغيير محلي (المزامنة تسمع له) */
export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) fn();
}

export async function putRows<T extends Row>(table: SyncedTable, rows: T[], db: AppDB = getDb()) {
  if (!rows.length) return;
  const ts = Date.now();
  await db.transaction("rw", [db.table(table), db.outbox], async () => {
    await db.table(table).bulkPut(rows);
    await db.outbox.bulkPut(rows.map((r) => ({ table, id: r.id, op: "put" as const, ts })));
  });
  notify();
}

export function putRow<T extends Row>(table: SyncedTable, row: T, db?: AppDB) {
  return putRows(table, [row], db);
}

export async function patchRow<T extends Row>(table: SyncedTable, id: string, changes: Partial<T>, db: AppDB = getDb()) {
  await db.transaction("rw", [db.table(table), db.outbox], async () => {
    const n = await db.table(table).update(id, changes);
    if (n) await db.outbox.put({ table, id, op: "put", ts: Date.now() });
  });
  notify();
}

export async function removeRows(table: SyncedTable, ids: string[], db: AppDB = getDb()) {
  if (!ids.length) return;
  const ts = Date.now();
  await db.transaction("rw", [db.table(table), db.outbox], async () => {
    await db.table(table).bulkDelete(ids);
    await db.outbox.bulkPut(ids.map((id) => ({ table, id, op: "delete" as const, ts })));
  });
  notify();
}

export function removeRow(table: SyncedTable, id: string, db?: AppDB) {
  return removeRows(table, [id], db);
}
