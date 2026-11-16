import Dexie, { type EntityTable } from "dexie";
import type {
  Category,
  DayTypeOverride,
  Favorite,
  Food,
  FoodEntry,
  Logo,
  Session,
  Settings,
  StepsEntry,
  SyncedTable,
  WaistEntry,
  WeightEntry,
  WorkoutType,
} from "./types";

/** تغيير محلي ينتظر الرفع للسيرفر */
export interface OutboxItem {
  table: SyncedTable;
  id: string;
  op: "put" | "delete";
  ts: number;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  categories!: EntityTable<Category, "id">;
  foods!: EntityTable<Food, "id">;
  entries!: EntityTable<FoodEntry, "id">;
  weights!: EntityTable<WeightEntry, "id">;
  waists!: EntityTable<WaistEntry, "id">;
  steps!: EntityTable<StepsEntry, "id">;
  sessions!: EntityTable<Session, "id">;
  workoutTypes!: EntityTable<WorkoutType, "id">;
  dayTypes!: EntityTable<DayTypeOverride, "id">;
  favorites!: EntityTable<Favorite, "id">;
  settings!: EntityTable<Settings, "id">;
  logos!: EntityTable<Logo, "id">;
  outbox!: Dexie.Table<OutboxItem, [string, string]>;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name = "lyaqa-v2") {
    super(name);
    this.version(1).stores({
      categories: "id, order",
      foods: "id, categoryId, name",
      entries: "id, date, foodId",
      weights: "id, date",
      waists: "id, date",
      steps: "id, date",
      sessions: "id, date",
      workoutTypes: "id",
      dayTypes: "id, date",
      favorites: "id",
      settings: "id",
      outbox: "[table+id], ts",
      meta: "key",
    });
    // النسخة 2: الشعارات
    this.version(2).stores({ logos: "id, createdAt" });
    // لو نسخة ثانية من التطبيق (مثلاً تبويب Chrome قديم) ماسكة القاعدة، نبلغ الواجهة
    this.on("blocked", () => {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("lyaqa-db-blocked"));
    });
  }
}

let _db: AppDB | null = null;
export function getDb(): AppDB {
  if (!_db) _db = new AppDB();
  return _db;
}
/** للاختبارات */
export function setDb(db: AppDB) {
  _db = db;
}

export async function getMeta<T>(db: AppDB, key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(db: AppDB, key: string, value: unknown) {
  await db.meta.put({ key, value });
}
