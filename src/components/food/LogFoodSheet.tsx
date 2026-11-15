"use client";

import { History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Segmented, Sheet, fmt } from "@/components/ui";
import { scaleMacros } from "@/lib/food-match";
import { foodName } from "@/lib/hooks";
import { uid } from "@/lib/ids";
import { patchRow, putRow } from "@/lib/repo";
import { MEALS, type Food, type FoodEntry, type Meal } from "@/lib/types";

export function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

/**
 * تسجيل أكلة أكلتها. الكمية إجبارية وتكتبها أنت دائماً،
 * والتطبيق يحسب القيم حسب الكمية المرجعية للأكلة.
 */
export function LogFoodSheet({
  food,
  date,
  meal: mealProp,
  initialAmount,
  onClose,
  onLogged,
}: {
  food: Food | null;
  date: string;
  meal?: Meal;
  initialAmount?: number | null;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [amount, setAmount] = useState("");
  const [meal, setMeal] = useState<Meal>(mealProp ?? defaultMeal());
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // نجهز الحقول مباشرة لما تتغير الأكلة (قبل الرسم، عشان ما تظهر كمية قديمة)
  const openKey = food ? `${food.id}|${initialAmount ?? ""}` : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (food) {
      setAmount(initialAmount ? String(initialAmount) : "");
      setMeal(mealProp ?? defaultMeal());
      setTouched(false);
    }
  }
  useEffect(() => {
    if (!openKey) return;
    const id = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(id);
  }, [openKey]);

  if (!food) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const unit = t(`common.units.${food.unit}`);
  const a = parseFloat(amount.replace(",", "."));
  const valid = Number.isFinite(a) && a > 0 && a < 10000;
  const m = scaleMacros(food, valid ? a : 0, food.refAmount);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!valid) return;
    const entry: FoodEntry = {
      id: uid(),
      date,
      meal,
      foodId: food.id,
      name: foodName(food, locale),
      brand: food.brand,
      amount: a,
      unit: food.unit,
      ...m,
      createdAt: Date.now(),
    };
    await putRow("entries", entry);
    await patchRow<Food>("foods", food.id, { lastAmount: a });
    onLogged?.();
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={t("food.logTitle", { name: foodName(food, locale) })}>
      <form onSubmit={save} className="space-y-4">
        {food.brand && <p className="-mt-2 text-sm text-muted">{food.brand}</p>}
        <p className="num rounded-2xl bg-card px-4 py-3 text-xs text-muted ring-1 ring-line">
          {t("food.per", { amount: fmt(food.refAmount), unit })}: {fmt(food.kcal)} {t("common.kcal")} · {t("common.protein")} {fmt(food.protein, 1)} · {t("common.carbs")} {fmt(food.carbs, 1)} · {t("common.fat")} {fmt(food.fat, 1)}
        </p>
        <Field label={t("food.amount", { unit: t(`common.unitNames.${food.unit}`) })}>
          <Input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="any"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={touched && !valid}
            aria-label={t("food.amount", { unit: t(`common.unitNames.${food.unit}`) })}
            className="num text-2xl font-bold"
          />
        </Field>
        {food.lastAmount != null && (
          <button type="button" onClick={() => setAmount(String(food.lastAmount))} className="flex items-center gap-1.5 rounded-full bg-gold/12 px-3.5 py-2 text-sm font-semibold text-gold">
            <History className="size-4" />
            {t("food.lastAmount", { amount: fmt(food.lastAmount, 1), unit })}
          </button>
        )}
        {touched && !valid && <p className="text-sm text-danger">{t("food.amountRequired")}</p>}
        <Segmented label={t("food.meal")} value={meal} onChange={setMeal} options={MEALS.map((id) => ({ id, label: t(`meals.${id}`) }))} />
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-card p-3 text-center ring-1 ring-line">
          <Total label={t("common.kcal")} value={m.kcal} color="var(--kcal)" />
          <Total label={t("common.protein")} value={m.protein} color="var(--protein)" />
          <Total label={t("common.carbs")} value={m.carbs} color="var(--carbs)" />
          <Total label={t("common.fat")} value={m.fat} color="var(--fat)" />
        </div>
        <Button type="submit" className="w-full" disabled={!amount}>
          {t("food.logSave")}
        </Button>
      </form>
    </Sheet>
  );
}

function Total({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="num text-lg font-bold" style={{ color }}>
        {fmt(value, 1)}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
