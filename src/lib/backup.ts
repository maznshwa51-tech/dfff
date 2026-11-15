import type { AppDB } from "./db";
import { putRows, removeRows } from "./repo";
import { SYNCED_TABLES, type SyncedTable } from "./types";

export const BACKUP_APP = "lyaqa";
export const BACKUP_VERSION = 2;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Partial<Record<SyncedTable, { id: string }[]>>;
}

export async function exportAll(db: AppDB): Promise<BackupFile> {
  const data: BackupFile["data"] = {};
  for (const t of SYNCED_TABLES) data[t] = await db.table(t).toArray();
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function validateBackup(json: unknown): BackupFile {
  if (!json || typeof json !== "object") throw new Error("invalid");
  const b = json as Partial<BackupFile>;
  if (b.app !== BACKUP_APP) throw new Error("notBackup");
  if (b.version !== BACKUP_VERSION) throw new Error("version");
  if (!b.data || typeof b.data !== "object") throw new Error("invalid");
  for (const t of SYNCED_TABLES) {
    const rows = b.data[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || typeof r.id !== "string")) throw new Error("invalid");
  }
  return b as BackupFile;
}

/** يستبدل كل البيانات الحالية بمحتوى النسخة (والتغيير يتزامن مع الحساب) */
export async function importAll(db: AppDB, backup: BackupFile): Promise<void> {
  for (const t of SYNCED_TABLES) {
    const rows = backup.data[t];
    if (!rows) continue;
    const keep = new Set(rows.map((r) => r.id));
    const existing = (await db.table(t).toCollection().primaryKeys()) as string[];
    await removeRows(t, existing.filter((id) => !keep.has(id)), db);
    await putRows(t, rows, db);
  }
}
