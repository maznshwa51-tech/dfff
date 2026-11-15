"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { resolveDayType, type DayType, type Settings } from "@/lib/targets";
import { Segmented } from "./ui";

const SOURCE_LABEL = {
  manual: "غيّرته يدوياً",
  workout: "فيه تمرين مسجل",
  schedule: "حسب جدولك",
  default: "ما فيه تمرين بالجدول",
};

/** يعرض نوع اليوم (تمرين/راحة) ويسمح بتغييره يدوياً */
export function DayTypeControl({ date, settings }: { date: string; settings: Settings }) {
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [override, workouts] = await Promise.all([db.dayTypes.get(date), db.workouts.where("date").equals(date).count()]);
    return { override: override?.type, hasWorkout: workouts > 0 };
  }, [date]);
  if (!data) return null;
  const info = resolveDayType(date, settings, data);

  const set = async (t: DayType) => {
    const auto = resolveDayType(date, settings, { hasWorkout: data.hasWorkout });
    if (t === auto.type) await getDb().dayTypes.delete(date); // رجع للتلقائي
    else await getDb().dayTypes.put({ date, type: t });
  };

  return (
    <div className="space-y-1.5">
      <Segmented
        value={info.type}
        onChange={set}
        options={[
          { id: "training", label: "🥊 يوم تمرين" },
          { id: "rest", label: "😌 يوم راحة" },
        ]}
      />
      <p className="text-xs text-muted">
        {SOURCE_LABEL[info.source]}
        {info.scheduled ? ` · بالجدول: ${info.scheduled}` : ""}
        {info.source === "manual" && (
          <button className="ms-2 text-brand underline" onClick={() => getDb().dayTypes.delete(date)}>
            رجّعه تلقائي
          </button>
        )}
      </p>
    </div>
  );
}
