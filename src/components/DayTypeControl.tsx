"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useTranslations } from "next-intl";
import { getDb } from "@/lib/db";
import { useWorkoutName } from "@/lib/hooks";
import { putRow, removeRow } from "@/lib/repo";
import { resolveDayType } from "@/lib/targets";
import type { DayType, Settings } from "@/lib/types";
import { Segmented } from "./ui";

/** نوع اليوم (تمرين/راحة) مع إمكانية تغييره يدوياً */
export function DayTypeControl({ date, settings }: { date: string; settings: Settings }) {
  const t = useTranslations("dayType");
  const wname = useWorkoutName();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [o, session] = await Promise.all([db.dayTypes.get(date), db.sessions.get(date)]);
    return { override: o?.type, session };
  }, [date]);
  if (!data) return null;
  const info = resolveDayType(date, settings, data);

  const set = async (type: DayType) => {
    const auto = resolveDayType(date, settings, { session: data.session });
    if (type === auto.type) await removeRow("dayTypes", date);
    else await putRow("dayTypes", { id: date, date, type });
  };

  return (
    <div className="space-y-2">
      <Segmented
        label={t("title")}
        value={info.type}
        onChange={set}
        options={[
          { id: "training", label: t("training") },
          { id: "rest", label: t("rest") },
        ]}
      />
      <p className="text-xs text-muted">
        {t(info.source)}
        {info.scheduled !== "rest" ? ` · ${t("scheduled", { name: wname(info.scheduled) })}` : ""}
        {info.source === "manual" && (
          <button className="ms-2 font-semibold text-gold" onClick={() => removeRow("dayTypes", date)}>
            {t("backToAuto")}
          </button>
        )}
      </p>
    </div>
  );
}
