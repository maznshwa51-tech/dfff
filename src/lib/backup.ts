import { TABLES, type AppDB } from "./db";

export const BACKUP_APP = "lyaqa";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<(typeof TABLES)[number], unknown[]>;
}

export async function exportAll(db: AppDB): Promise<BackupFile> {
  const data = {} as BackupFile["data"];
  await db.transaction("r", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) data[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function validateBackup(json: unknown): BackupFile {
  if (!json || typeof json !== "object") throw new Error("الملف مش JSON صالح");
  const b = json as Partial<BackupFile>;
  if (b.app !== BACKUP_APP) throw new Error("هذا الملف مش نسخة احتياطية من التطبيق");
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION)
    throw new Error("نسخة الملف أحدث من التطبيق");
  if (!b.data || typeof b.data !== "object") throw new Error("الملف ما فيه بيانات");
  for (const t of TABLES) {
    const rows = (b.data as Record<string, unknown>)[t];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`بيانات ${t} غير صالحة`);
  }
  return b as BackupFile;
}

/** يستبدل كل البيانات الحالية بمحتوى النسخة الاحتياطية */
export async function importAll(db: AppDB, backup: BackupFile): Promise<void> {
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = backup.data[t];
      if (!rows) continue;
      await db.table(t).clear();
      await db.table(t).bulkPut(rows);
    }
  });
}
