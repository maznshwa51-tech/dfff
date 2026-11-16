"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus, RotateCcw, Search, Sparkles, Star, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AddFoodSheet } from "@/components/food/AddFoodSheet";
import { defaultMeal, LogFoodSheet } from "@/components/food/LogFoodSheet";
import { Library } from "@/components/food/Library";
import { QuickKcalSheet } from "@/components/food/QuickKcalSheet";
import { Button, Card, DayNav, Empty, Field, IconButton, Input, PageHeader, Segmented, Select, Sheet, fmt, useOnce } from "@/components/ui";
import { addDays } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { parseFoodInput, scaleMacros, searchFoods } from "@/lib/food-match";
import { foodName, useFoods, useSettings, useToday } from "@/lib/hooks";
import { uid } from "@/lib/ids";
import { putRow, putRows, removeRow } from "@/lib/repo";
import { sumMacros } from "@/lib/stats";
import { MEALS, type Food, type FoodEntry, type Meal } from "@/lib/types";

export default function FoodPage() {
  const t = useTranslations();
  const [tab, setTab] = useState<"log" | "library">("log");
  return (
    <>
      <PageHeader title={t("food.title")} />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: "log", label: t("food.tabLog") },
            { id: "library", label: t("food.tabLibrary") },
          ]}
        />
      </div>
      {tab === "log" ? <FoodLog /> : <Library />}
    </>
  );
}

function FoodLog() {
  const t = useTranslations();
  const locale = useLocale();
  const today = useToday();
  const settings = useSettings();
  const foods = useFoods() ?? [];
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [text, setText] = useState("");
  const [logging, setLogging] = useState<{ food: Food; amount: number | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState<null | "yesterday" | "favorites" | "quick">(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);

  const entries = useLiveQuery(() => getDb().entries.where("date").equals(date).sortBy("createdAt"), [date]);
  const total = sumMacros(entries ?? []);
  const parsed = useMemo(() => parseFoodInput(text), [text]);
  const results = useMemo(() => (parsed.name.length >= 1 ? searchFoods(parsed.name, foods, 8) : []), [parsed.name, foods]);

  const pick = (food: Food) => setLogging({ food, amount: parsed.amount });

  return (
    <div className="space-y-4">
      <DayNav date={date} today={today} onChange={setDate} />

      <Card className="space-y-4">
        <Segmented label={t("food.meal")} value={meal} onChange={setMeal} options={MEALS.map((id) => ({ id, label: t(`meals.${id}`) }))} />
        <div className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("food.search")}
            aria-label={t("food.search")}
            className="ps-11"
            autoComplete="off"
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                pick(results[0].food);
              }
            }}
          />
        </div>

        {parsed.name && (
          <div>
            {results.length > 0 ? (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line" aria-label="results">
                {results.map(({ food }) => (
                  <li key={food.id}>
                    <button className="flex w-full items-center justify-between gap-3 bg-card2 px-4 py-3 text-start active:bg-track/60" onClick={() => pick(food)}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {foodName(food, locale)}
                          {food.brand && <span className="text-sm font-normal text-muted"> · {food.brand}</span>}
                        </span>
                        <span className="num block text-xs text-muted">
                          {fmt(food.refAmount)} {t(`common.units.${food.unit}`)} = {fmt(food.kcal)} {t("common.kcal")} · {t("common.protein")} {fmt(food.protein, 1)}
                        </span>
                      </span>
                      <Plus className="size-5 shrink-0 text-gold" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("food.notFound", { name: parsed.name })}</p>
            )}
            <button className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-gold" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> {t("food.addToLibrary")}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="soft" icon={RotateCcw} onClick={() => setSheet("yesterday")}>
            {t("food.repeatYesterday")}
          </Button>
          <Button variant="soft" icon={Star} onClick={() => setSheet("favorites")}>
            {t("food.favorites")}
          </Button>
          <Button variant="soft" icon={Zap} className="col-span-2" onClick={() => setSheet("quick")}>
            {t("quick.title")}
          </Button>
          <Link href="/plan" className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gold/12 text-[15px] font-semibold text-gold">
            <Sparkles className="size-[18px]" /> {t("plan.homeButton")}
          </Link>
        </div>
      </Card>

      <div className="flex justify-between px-1 text-sm text-muted">
        <span>{t("food.total")}</span>
        <span className="num" data-testid="food-total">
          {t("food.summary", { kcal: fmt(total.kcal), protein: fmt(total.protein, 1) })}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEALS.map((m) => {
          const items = (entries ?? []).filter((e) => e.meal === m);
          const mt = sumMacros(items);
          return (
            <Card key={m}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{t(`meals.${m}`)}</h2>
                <div className="flex items-center gap-1">
                  <span className="num text-xs text-muted">{t("food.summary", { kcal: fmt(mt.kcal), protein: fmt(mt.protein, 1) })}</span>
                  {items.length > 0 && <SaveFavorite items={items} mealLabel={t(`meals.${m}`)} />}
                </div>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted">{t("food.emptyMeal")}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 py-2.5">
                      <button className="min-w-0 flex-1 text-start" onClick={() => setEditing(e)}>
                        <div className="truncate font-medium">{e.name}</div>
                        <div className="num text-xs text-muted">
                          {e.quick ? (
                            <>
                              ⚡ {fmt(e.kcal)} {t("common.kcal")}
                              {e.protein > 0 ? ` · ${t("common.protein")} ${fmt(e.protein, 1)}` : ""} · {t("quick.label")}
                            </>
                          ) : (
                            <>
                              {fmt(e.amount, 1)} {t(`common.units.${e.unit}`)} · {fmt(e.kcal)} {t("common.kcal")} · {t("common.protein")} {fmt(e.protein, 1)}
                            </>
                          )}
                        </div>
                      </button>
                      <IconButton icon={Trash2} label={t("food.deleteEntry", { name: e.name })} onClick={() => removeRow("entries", e.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <LogFoodSheet
        food={logging?.food ?? null}
        initialAmount={logging?.amount}
        date={date}
        meal={meal}
        onClose={() => setLogging(null)}
        onLogged={() => setText("")}
      />
      {settings && (
        <AddFoodSheet
          open={adding}
          onClose={() => setAdding(false)}
          initialName={parsed.name}
          defaultUnit={parsed.unit ?? settings.defaultUnit}
          allowLog
          onSaved={(food, andLog) => {
            setAdding(false);
            if (andLog) setLogging({ food, amount: parsed.amount });
          }}
        />
      )}
      <RepeatYesterday open={sheet === "yesterday"} onClose={() => setSheet(null)} date={date} />
      <Favorites open={sheet === "favorites"} onClose={() => setSheet(null)} date={date} meal={meal} />
      <EditEntry entry={editing} onClose={() => setEditing(null)} />
      <QuickKcalSheet open={sheet === "quick"} onClose={() => setSheet(null)} date={date} />
    </div>
  );
}

function copyEntries(items: FoodEntry[], date: string, meal?: Meal) {
  const now = Date.now();
  return putRows(
    "entries",
    items.map((e, i) => ({ ...e, id: uid(), date, meal: meal ?? e.meal, createdAt: now + i })),
  );
}

function RepeatYesterday({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const t = useTranslations();
  const once = useOnce();
  const sep = useLocale() === "ar" ? "، " : ", ";
  const y = addDays(date, -1);
  const items = useLiveQuery(() => (open ? getDb().entries.where("date").equals(y).toArray() : []), [open, y]) ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={t("food.repeatYesterday")}>
      {items.length === 0 ? (
        <Empty>{t("food.yesterdayEmpty")}</Empty>
      ) : (
        <div className="space-y-3">
          {MEALS.map((m) => {
            const mi = items.filter((e) => e.meal === m);
            if (!mi.length) return null;
            const s = sumMacros(mi);
            return (
              <button
                key={m}
                className="w-full rounded-2xl bg-card p-4 text-start shadow-soft ring-1 ring-line active:scale-[0.99]"
                onClick={() =>
                  once(async () => {
                    await copyEntries(mi, date, m);
                    onClose();
                  })
                }
              >
                <div className="flex justify-between font-semibold">
                  <span>{t("food.mealYesterday", { meal: t(`meals.${m}`) })}</span>
                  <span className="num text-sm text-muted">
                    {fmt(s.kcal)} {t("common.kcal")}
                  </span>
                </div>
                <div className="truncate text-xs text-muted">{mi.map((e) => e.name).join(sep)}</div>
              </button>
            );
          })}
          <Button
            className="w-full"
            onClick={() =>
              once(async () => {
                await copyEntries(items, date);
                onClose();
              })
            }
          >
            {t("food.repeatAll")}
          </Button>
          <p className="text-center text-xs text-muted">{t("food.repeatNote")}</p>
        </div>
      )}
    </Sheet>
  );
}

function Favorites({ open, onClose, date, meal }: { open: boolean; onClose: () => void; date: string; meal: Meal }) {
  const t = useTranslations();
  const once = useOnce();
  const sep = useLocale() === "ar" ? "، " : ", ";
  const favs = useLiveQuery(() => getDb().favorites.toArray(), []) ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={t("food.favorites")}>
      {favs.length === 0 ? (
        <Empty>{t("food.noFavorites")}</Empty>
      ) : (
        <ul className="space-y-3">
          {favs.map((f) => {
            const s = sumMacros(f.items);
            return (
              <li key={f.id} className="flex items-center gap-2 rounded-2xl bg-card p-4 shadow-soft ring-1 ring-line">
                <button
                  className="min-w-0 flex-1 text-start"
                  onClick={() =>
                    once(async () => {
                      const now = Date.now();
                      await putRows(
                        "entries",
                        f.items.map((it, i) => ({ ...it, id: uid(), date, meal, createdAt: now + i })),
                      );
                      onClose();
                    })
                  }
                >
                  <div className="font-semibold">{f.name}</div>
                  <div className="truncate text-xs text-muted">
                    {t("food.summary", { kcal: fmt(s.kcal), protein: fmt(s.protein, 1) })} · {f.items.map((i) => i.name).join(sep)}
                  </div>
                </button>
                <IconButton icon={Trash2} label={`${t("common.delete")} ${f.name}`} onClick={() => removeRow("favorites", f.id)} />
              </li>
            );
          })}
          <p className="text-center text-xs text-muted">{t("food.addsTo", { meal: t(`meals.${meal}`) })}</p>
        </ul>
      )}
    </Sheet>
  );
}

function SaveFavorite({ items, mealLabel }: { items: FoodEntry[]; mealLabel: string }) {
  const t = useTranslations();
  const once = useOnce();
  const sep = useLocale() === "ar" ? "، " : ", ";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <IconButton
        icon={Star}
        label={t("food.saveFavorite", { meal: mealLabel })}
        onClick={() => {
          setName(mealLabel);
          setOpen(true);
        }}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={t("food.saveFavorite", { meal: mealLabel })}>
        <div className="space-y-4">
          <Field label={t("food.favoriteName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <p className="text-sm text-muted">{items.map((i) => `${i.name} (${i.quick ? `${fmt(i.kcal)} ${t("common.kcal")}` : `${fmt(i.amount)} ${t(`common.units.${i.unit}`)}`})`).join(sep)}</p>
          <Button
            className="w-full"
            disabled={!name.trim()}
            onClick={() => once(async () => {
              await putRow("favorites", {
                id: uid(),
                name: name.trim(),
                items: items.map(({ name, amount, unit, kcal, protein, carbs, fat, foodId, quick }) => ({ name, amount, unit, kcal, protein, carbs, fat, foodId, quick })),
                createdAt: Date.now(),
              });
              setOpen(false);
            })}
          >
            {t("common.save")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function EditEntry({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  const t = useTranslations();
  const [amount, setAmount] = useState("");
  const [meal, setMeal] = useState<Meal>("lunch");
  const [name, setName] = useState("");
  const [lastId, setLastId] = useState<string | undefined>();
  if (entry && entry.id !== lastId) {
    setLastId(entry.id);
    setAmount(String(entry.amount));
    setMeal(entry.meal);
    setName(entry.name);
  }
  if (!entry) return null;
  const a = parseFloat(amount) || 0;
  // القيم الأصلية لكل وحدة من الكمية المسجلة
  const m = scaleMacros(entry, a, entry.amount);
  return (
    <Sheet open onClose={onClose} title={entry.name}>
      <div className="space-y-4">
        {entry.quick && (
          <Field label={t("quick.reason")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
        )}
        <Field label={entry.quick ? t("quick.kcal") : t("food.amount", { unit: t(`common.unitNames.${entry.unit}`) })}>
          <Input type="number" inputMode="decimal" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="num text-xl font-bold" />
        </Field>
        <Field label={t("food.meal")}>
          <Select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((id) => (
              <option key={id} value={id}>
                {t(`meals.${id}`)}
              </option>
            ))}
          </Select>
        </Field>
        <p className="num text-sm text-muted">
          {fmt(m.kcal)} {t("common.kcal")} · {t("common.protein")} {fmt(m.protein, 1)} · {t("common.carbs")} {fmt(m.carbs, 1)} · {t("common.fat")} {fmt(m.fat, 1)}
        </p>
        <Button
          className="w-full"
          disabled={a <= 0 || (entry.quick && !name.trim())}
          onClick={async () => {
            await putRow("entries", { ...entry, amount: a, meal, ...m, ...(entry.quick ? { name: name.trim(), kcal: Math.round(a) } : {}) });
            onClose();
          }}
        >
          {t("common.save")}
        </Button>
      </div>
    </Sheet>
  );
}
