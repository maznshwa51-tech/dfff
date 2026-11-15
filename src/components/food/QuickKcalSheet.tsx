"use client";

import { Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button, Field, Input, Segmented, Sheet } from "@/components/ui";
import { uid } from "@/lib/ids";
import { putRow } from "@/lib/repo";
import { MEALS, type FoodEntry, type Meal } from "@/lib/types";
import { defaultMeal } from "./LogFoodSheet";

const PRESETS = [50, 100, 150, 200, 300];

/**
 * إضافة سعرات سريعة للأشياء البسيطة (مثلاً حبة كيكات) بدون ما تضيفها للمكتبة.
 * لازم تكتب وش أكلت.
 */
export function QuickKcalSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const t = useTranslations();
  const [kcal, setKcal] = useState("");
  const [reason, setReason] = useState("");
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [touched, setTouched] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const saving = useRef(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKcal("");
      setReason("");
      setMeal(defaultMeal());
      setTouched(false);
    }
  }
  const n = Math.round(parseFloat(kcal));
  const validKcal = Number.isFinite(n) && n > 0 && n <= 5000;
  const validReason = reason.trim().length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validKcal || !validReason || saving.current) return;
    saving.current = true;
    const entry: FoodEntry = {
      id: uid(),
      quick: true,
      date,
      meal,
      name: reason.trim().slice(0, 80),
      amount: n,
      unit: "g",
      kcal: n,
      protein: 0,
      carbs: 0,
      fat: 0,
      createdAt: Date.now(),
    };
    try {
      await putRow("entries", entry);
      onClose();
    } finally {
      saving.current = false;
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("quick.title")}>
      <form onSubmit={save} className="space-y-4">
        <Field label={t("quick.kcal")}>
          <Input
            type="number"
            inputMode="numeric"
            min="1"
            max="5000"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            aria-invalid={touched && !validKcal}
            className="num text-2xl font-bold"
            autoFocus
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setKcal(String((validKcal ? n : 0) + p))}
              className="num rounded-full bg-gold/12 px-4 py-2 text-sm font-semibold text-gold active:scale-95"
            >
              +{p}
            </button>
          ))}
        </div>
        {touched && !validKcal && <p className="text-sm text-danger">{t("quick.kcalRequired")}</p>}
        <Field label={t("quick.reason")}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("quick.reasonPlaceholder")} maxLength={80} aria-invalid={touched && !validReason} required />
        </Field>
        {touched && !validReason && <p className="text-sm text-danger">{t("quick.reasonRequired")}</p>}
        <Segmented label={t("food.meal")} value={meal} onChange={setMeal} options={MEALS.map((id) => ({ id, label: t(`meals.${id}`) }))} />
        <p className="text-xs leading-relaxed text-muted">{t("quick.note")}</p>
        <Button type="submit" icon={Zap} className="w-full" disabled={!kcal || !reason.trim()}>
          {t("quick.save", { n: validKcal ? n : 0 })}
        </Button>
      </form>
    </Sheet>
  );
}
