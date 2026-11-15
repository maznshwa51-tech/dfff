"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { AddFood, defaultMeal } from "@/components/AddFood";
import { Button, Card, DayNav, Empty, Field, Input, PageHeader, Sheet, fmt } from "@/components/ui";
import { addDays } from "@/lib/dates";
import { getDb, MEALS, type FoodEntry, type Meal } from "@/lib/db";
import { round1, scaleMacros } from "@/lib/food-match";
import { useToday } from "@/lib/hooks";
import { sumMacros } from "@/lib/stats";

export default function FoodPage() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [sheet, setSheet] = useState<null | "yesterday" | "favorites">(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);

  const entries = useLiveQuery(() => getDb().entries.where("date").equals(date).sortBy("createdAt"), [date]);
  const total = sumMacros(entries ?? []);

  return (
    <>
      <PageHeader title="سجل الأكل" />
      <div className="space-y-4">
        <DayNav date={date} today={today} onChange={setDate} />

        <Card>
          <AddFood date={date} meal={meal} onMealChange={setMeal} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="soft" onClick={() => setSheet("yesterday")}>
              ↺ كرر وجبة أمس
            </Button>
            <Button variant="soft" onClick={() => setSheet("favorites")}>
              ★ وجبات مفضلة
            </Button>
          </div>
        </Card>

        <div className="flex justify-between px-1 text-sm text-muted">
          <span>المجموع</span>
          <span className="tabular-nums">
            {fmt(total.kcal)} سعرة · {fmt(total.protein, 1)} غ بروتين
          </span>
        </div>

        {MEALS.map((m) => {
          const items = (entries ?? []).filter((e) => e.meal === m.id);
          const t = sumMacros(items);
          return (
            <Card key={m.id}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold">{m.label}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted tabular-nums">
                    {t.kcal} سعرة · {t.protein} غ ب
                  </span>
                  {items.length > 0 && <SaveFavorite items={items} mealLabel={m.label} />}
                </div>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted">ما فيه أكل مسجل</p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 py-2">
                      <button className="min-w-0 flex-1 text-start" onClick={() => setEditing(e)}>
                        <div className="truncate text-sm font-medium">{e.name}</div>
                        <div className="text-xs text-muted tabular-nums">
                          {round1(e.grams)} غ · {e.kcal} سعرة · ب {e.protein} · ك {e.carbs} · د {e.fat}
                        </div>
                      </button>
                      <button
                        className="grid size-9 place-items-center rounded-full text-muted active:bg-track"
                        aria-label={`حذف ${e.name}`}
                        onClick={() => getDb().entries.delete(e.id!)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <RepeatYesterday open={sheet === "yesterday"} onClose={() => setSheet(null)} date={date} />
      <Favorites open={sheet === "favorites"} onClose={() => setSheet(null)} date={date} meal={meal} />
      <EditEntry entry={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function copyEntries(items: FoodEntry[], date: string, meal?: Meal) {
  const now = Date.now();
  return getDb().entries.bulkAdd(
    items.map(({ id: _id, ...e }, i) => ({ ...e, date, meal: meal ?? e.meal, createdAt: now + i })),
  );
}

function RepeatYesterday({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const y = addDays(date, -1);
  const items = useLiveQuery(() => (open ? getDb().entries.where("date").equals(y).toArray() : []), [open, y]) ?? [];
  return (
    <Sheet open={open} onClose={onClose} title="كرر وجبة أمس">
      {items.length === 0 ? (
        <Empty>ما فيه أكل مسجل أمس</Empty>
      ) : (
        <div className="space-y-2">
          {MEALS.map((m) => {
            const mi = items.filter((e) => e.meal === m.id);
            if (!mi.length) return null;
            const t = sumMacros(mi);
            return (
              <button
                key={m.id}
                className="w-full rounded-xl bg-card p-3 text-start ring-1 ring-line active:bg-track"
                onClick={async () => {
                  await copyEntries(mi, date, m.id);
                  onClose();
                }}
              >
                <div className="flex justify-between font-semibold">
                  <span>{m.label} أمس</span>
                  <span className="text-sm text-muted tabular-nums">{t.kcal} سعرة</span>
                </div>
                <div className="truncate text-xs text-muted">{mi.map((e) => e.name).join("، ")}</div>
              </button>
            );
          })}
          <Button
            className="w-full"
            onClick={async () => {
              await copyEntries(items, date);
              onClose();
            }}
          >
            كرر كل أكل أمس
          </Button>
          <p className="text-center text-xs text-muted">الوجبة تنضاف لنفس الوجبة اليوم (فطور ← فطور…)</p>
        </div>
      )}
    </Sheet>
  );
}

function Favorites({ open, onClose, date, meal }: { open: boolean; onClose: () => void; date: string; meal: Meal }) {
  const favs = useLiveQuery(() => getDb().favorites.orderBy("name").toArray(), []) ?? [];
  const mealLabel = MEALS.find((m) => m.id === meal)?.label;
  return (
    <Sheet open={open} onClose={onClose} title="وجبات مفضلة">
      {favs.length === 0 ? (
        <Empty>ما عندك وجبات مفضلة. اضغط ☆ جنب أي وجبة عشان تحفظها.</Empty>
      ) : (
        <ul className="space-y-2">
          {favs.map((f) => {
            const t = sumMacros(f.items);
            return (
              <li key={f.id} className="flex items-center gap-2 rounded-xl bg-card p-3 ring-1 ring-line">
                <button
                  className="min-w-0 flex-1 text-start"
                  onClick={async () => {
                    const now = Date.now();
                    await getDb().entries.bulkAdd(f.items.map((it, i) => ({ ...it, date, meal, createdAt: now + i })));
                    onClose();
                  }}
                >
                  <div className="font-semibold">{f.name}</div>
                  <div className="truncate text-xs text-muted">
                    {t.kcal} سعرة · {t.protein} غ بروتين · {f.items.map((i) => i.name).join("، ")}
                  </div>
                </button>
                <button className="grid size-9 place-items-center rounded-full text-muted active:bg-track" aria-label={`حذف ${f.name}`} onClick={() => getDb().favorites.delete(f.id!)}>
                  ✕
                </button>
              </li>
            );
          })}
          <p className="text-center text-xs text-muted">تنضاف إلى: {mealLabel}</p>
        </ul>
      )}
    </Sheet>
  );
}

function SaveFavorite({ items, mealLabel }: { items: FoodEntry[]; mealLabel: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <button className="grid size-8 place-items-center rounded-full text-muted active:bg-track" aria-label={`احفظ ${mealLabel} كمفضلة`} onClick={() => { setName(mealLabel); setOpen(true); }}>
        ☆
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="احفظ كوجبة مفضلة">
        <div className="space-y-3">
          <Field label="اسم الوجبة">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <p className="text-sm text-muted">{items.map((i) => `${i.name} (${i.grams} غ)`).join("، ")}</p>
          <Button
            className="w-full"
            disabled={!name.trim()}
            onClick={async () => {
              await getDb().favorites.add({
                name: name.trim(),
                items: items.map(({ name, grams, kcal, protein, carbs, fat, foodId }) => ({ name, grams, kcal, protein, carbs, fat, foodId })),
                createdAt: Date.now(),
              });
              setOpen(false);
            }}
          >
            حفظ
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function EditEntry({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  const [grams, setGrams] = useState<string>("");
  const [meal, setMeal] = useState<Meal>("lunch");
  const [lastId, setLastId] = useState<number | undefined>();
  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setGrams(String(entry.grams));
    setMeal(entry.meal);
  }
  if (!entry) return null;
  const g = parseFloat(grams) || 0;
  const per100 = {
    kcal: (entry.kcal / entry.grams) * 100,
    protein: (entry.protein / entry.grams) * 100,
    carbs: (entry.carbs / entry.grams) * 100,
    fat: (entry.fat / entry.grams) * 100,
  };
  const t = scaleMacros(per100, g);
  return (
    <Sheet open onClose={onClose} title={entry.name}>
      <div className="space-y-3">
        <Field label="الكمية (غرام)">
          <Input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </Field>
        <Field label="الوجبة">
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} className="min-h-11 w-full rounded-xl bg-field px-3 ring-1 ring-line">
            {MEALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-sm text-muted tabular-nums">
          {t.kcal} سعرة · بروتين {t.protein} غ · كارب {t.carbs} غ · دهون {t.fat} غ
        </p>
        <Button
          className="w-full"
          disabled={g <= 0}
          onClick={async () => {
            await getDb().entries.update(entry.id!, { grams: g, meal, ...t });
            onClose();
          }}
        >
          حفظ التعديل
        </Button>
      </div>
    </Sheet>
  );
}
