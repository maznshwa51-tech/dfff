"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { DayTypeControl } from "@/components/DayTypeControl";
import { Button, Card, CardTitle, DayNav, Empty, Field, Input, PageHeader, Progress, Segmented, Sheet, fmt } from "@/components/ui";
import { weekday } from "@/lib/dates";
import { getDb, INTENSITIES, type Intensity } from "@/lib/db";
import { saveSettings, useSettings, useToday } from "@/lib/hooks";

export default function ActivityPage() {
  const today = useToday();
  const settings = useSettings();
  const [date, setDate] = useState(today);
  const steps = useLiveQuery(() => getDb().steps.get(date), [date]);
  const workouts = useLiveQuery(() => getDb().workouts.where("date").equals(date).sortBy("createdAt"), [date]);
  const [stepsInput, setStepsInput] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  if (!settings) return null;

  const count = steps?.count ?? 0;

  return (
    <>
      <PageHeader title="النشاط" />
      <div className="space-y-4">
        <DayNav date={date} today={today} onChange={setDate} />

        <Card>
          <CardTitle>نوع اليوم</CardTitle>
          <DayTypeControl date={date} settings={settings} />
        </Card>

        <Card>
          <CardTitle
            action={
              <button className="text-xs text-brand" onClick={() => setGoalOpen(true)}>
                الهدف: {fmt(settings.stepsGoal)} ✎
              </button>
            }
          >
            الخطوات 👟
          </CardTitle>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold tabular-nums">{fmt(count)}</span>
            <span className="text-sm text-muted">{count >= settings.stepsGoal ? "وصلت الهدف 🎉" : `باقي ${fmt(settings.stepsGoal - count)}`}</span>
          </div>
          <Progress value={count} max={settings.stepsGoal} label="الخطوات" />
          <form
            className="mt-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const n = parseInt(stepsInput.replace(/[^\d]/g, ""), 10);
              if (!(n >= 0 && n < 200000)) return;
              await getDb().steps.put({ date, count: n });
              setStepsInput("");
            }}
          >
            <Input type="number" inputMode="numeric" placeholder="عدد الخطوات من الساعة" value={stepsInput} onChange={(e) => setStepsInput(e.target.value)} aria-label="عدد الخطوات" />
            <Button type="submit" disabled={!stepsInput}>
              {steps ? "حدّث" : "سجّل"}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle
            action={
              <Button variant="soft" className="min-h-9 px-3" onClick={() => setAddOpen(true)}>
                + تمرين
              </Button>
            }
          >
            التمارين 🥊
          </CardTitle>
          {!workouts?.length ? (
            <Empty>ما فيه تمرين مسجل لهذا اليوم</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {workouts.map((w) => (
                <li key={w.id} className="flex items-start gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {w.type}
                      <span className="ms-2 rounded-full bg-track px-2 py-0.5 text-xs font-medium text-muted">
                        {INTENSITIES.find((i) => i.id === w.intensity)?.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted tabular-nums">
                      {w.durationMin} دقيقة{w.distanceKm ? ` · ${w.distanceKm} كم` : ""}
                    </div>
                    {w.notes && <p className="mt-1 text-sm">{w.notes}</p>}
                  </div>
                  <button className="grid size-9 place-items-center rounded-full text-muted active:bg-track" aria-label={`حذف ${w.type}`} onClick={() => getDb().workouts.delete(w.id!)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AddWorkout open={addOpen} onClose={() => setAddOpen(false)} date={date} suggested={settings.schedule[weekday(date)]} />

      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="هدف الخطوات اليومي">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = parseInt(new FormData(e.currentTarget).get("goal") as string, 10);
            if (v > 0) await saveSettings({ stepsGoal: v });
            setGoalOpen(false);
          }}
        >
          <Input name="goal" type="number" inputMode="numeric" defaultValue={settings.stepsGoal} aria-label="هدف الخطوات" />
          <Button type="submit" className="w-full">
            حفظ
          </Button>
        </form>
      </Sheet>
    </>
  );
}

function AddWorkout({ open, onClose, date, suggested }: { open: boolean; onClose: () => void; date: string; suggested?: string }) {
  const types = useLiveQuery(() => getDb().workoutTypes.toArray(), []) ?? [];
  const [type, setType] = useState<string>("");
  const [duration, setDuration] = useState("60");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [km, setKm] = useState("");
  const [notes, setNotes] = useState("");
  const [newType, setNewType] = useState("");
  const [newHasKm, setNewHasKm] = useState(false);
  const [adding, setAdding] = useState(false);

  const selected = type || suggested || types[0]?.name || "";
  const selType = types.find((t) => t.name === selected);

  const reset = () => {
    setType("");
    setDuration("60");
    setIntensity("medium");
    setKm("");
    setNotes("");
  };

  return (
    <Sheet open={open} onClose={onClose} title="سجّل تمرين">
      <div className="space-y-4">
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">النوع</span>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.name)}
                aria-pressed={selected === t.name}
                className={`rounded-full px-3 py-1.5 text-sm ring-1 ${selected === t.name ? "bg-brand text-white dark:text-slate-950 ring-brand" : "bg-card ring-line"}`}
              >
                {t.name}
              </button>
            ))}
            <button type="button" onClick={() => setAdding((a) => !a)} className="rounded-full px-3 py-1.5 text-sm text-brand ring-1 ring-dashed ring-brand/50">
              + نوع جديد
            </button>
          </div>
          {adding && (
            <div className="mt-2 space-y-2 rounded-xl bg-card p-3 ring-1 ring-line">
              <Input placeholder="مثلاً: جري" value={newType} onChange={(e) => setNewType(e.target.value)} aria-label="اسم النوع الجديد" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={newHasKm} onChange={(e) => setNewHasKm(e.target.checked)} />
                يُقاس بالكيلومترات
              </label>
              <Button
                variant="soft"
                className="w-full"
                disabled={!newType.trim() || types.some((t) => t.name === newType.trim())}
                onClick={async () => {
                  await getDb().workoutTypes.add({ name: newType.trim(), hasDistance: newHasKm });
                  setType(newType.trim());
                  setNewType("");
                  setNewHasKm(false);
                  setAdding(false);
                }}
              >
                أضف النوع
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="المدة (دقيقة)">
            <Input type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Field>
          {selType?.hasDistance && (
            <Field label="المسافة (كم)">
              <Input type="number" inputMode="decimal" step="0.1" value={km} onChange={(e) => setKm(e.target.value)} aria-label="المسافة بالكيلومتر" />
            </Field>
          )}
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">الشدة</span>
          <Segmented value={intensity} onChange={setIntensity} options={INTENSITIES} />
        </div>
        <Field label="ملاحظات">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-xl bg-field p-3 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
        </Field>
        <Button
          className="w-full"
          disabled={!selected || !(parseInt(duration) > 0)}
          onClick={async () => {
            const distance = parseFloat(km);
            await getDb().workouts.add({
              date,
              type: selected,
              durationMin: parseInt(duration),
              intensity,
              distanceKm: selType?.hasDistance && distance > 0 ? distance : undefined,
              notes: notes.trim() || undefined,
              createdAt: Date.now(),
            });
            reset();
            onClose();
          }}
        >
          حفظ التمرين
        </Button>
      </div>
    </Sheet>
  );
}
