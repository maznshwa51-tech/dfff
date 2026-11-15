"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button, Field, Input, Segmented, Select } from "@/components/ui";
import { useCategories, useCategoryName } from "@/lib/hooks";
import { uid } from "@/lib/ids";
import { putRow } from "@/lib/repo";
import type { Food, Unit } from "@/lib/types";

export interface FoodDraft {
  name: string;
  brand: string;
  categoryId: string;
  refAmount: string;
  unit: Unit;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

export function draftFrom(f: Partial<Food> & { unit?: Unit }, defaults: { categoryId: string; unit: Unit }): FoodDraft {
  const s = (n: number | undefined) => (n == null ? "" : String(n));
  return {
    name: f.name ?? "",
    brand: f.brand ?? "",
    categoryId: f.categoryId ?? defaults.categoryId,
    refAmount: f.refAmount != null ? String(f.refAmount) : "100",
    unit: f.unit ?? defaults.unit,
    kcal: s(f.kcal),
    protein: s(f.protein),
    carbs: s(f.carbs),
    fat: s(f.fat),
  };
}

const num = (v: string) => {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export function parseDraft(d: FoodDraft): Omit<Food, "id" | "createdAt"> | null {
  const refAmount = num(d.refAmount);
  const vals = { kcal: num(d.kcal), protein: num(d.protein), carbs: num(d.carbs), fat: num(d.fat) };
  if (!d.name.trim() || !d.categoryId) return null;
  if (!(refAmount > 0) || Object.values(vals).some((v) => !(v >= 0))) return null;
  return {
    name: d.name.trim(),
    brand: d.brand.trim() || undefined,
    categoryId: d.categoryId,
    refAmount,
    unit: d.unit,
    kcal: Math.round(vals.kcal),
    protein: vals.protein,
    carbs: vals.carbs,
    fat: vals.fat,
  };
}

/** نموذج الأكلة (إضافة يدوية، أو مراجعة قراءة الملصق، أو تعديل) */
export function FoodForm({
  initial,
  existing,
  onSaved,
  submitLabels,
}: {
  initial: FoodDraft;
  existing?: Food;
  onSaved: (food: Food, andLog: boolean) => void;
  /** إذا فيه زرين: احفظ وسجّل / احفظ فقط */
  submitLabels?: { log?: string; save: string };
}) {
  const t = useTranslations();
  const cats = useCategories() ?? [];
  const catName = useCategoryName();
  const [d, setD] = useState<FoodDraft>(initial);
  const [touched, setTouched] = useState(false);
  const saving = useRef(false);
  const set = (p: Partial<FoodDraft>) => setD((x) => ({ ...x, ...p }));
  const parsed = parseDraft(d);
  const unit = t(`common.units.${d.unit}`);
  const computed = parsed ? Math.round(parsed.protein * 4 + parsed.carbs * 4 + parsed.fat * 9) : 0;
  const mismatch = parsed && parsed.kcal > 20 && Math.abs(computed - parsed.kcal) / parsed.kcal > 0.25;

  const save = async (andLog: boolean) => {
    setTouched(true);
    if (!parsed || saving.current) return;
    saving.current = true;
    const food: Food = existing
      ? { ...existing, ...parsed, nameEn: parsed.name === existing.name ? existing.nameEn : undefined }
      : { ...parsed, id: uid(), createdAt: Date.now() };
    try {
      await putRow("foods", food);
      onSaved(food, andLog);
    } finally {
      saving.current = false;
    }
  };

  const numField = (key: "kcal" | "protein" | "carbs" | "fat", label: string) => (
    <Field label={label}>
      <Input type="number" inputMode="decimal" step="any" min="0" value={d[key]} onChange={(e) => set({ [key]: e.target.value })} aria-invalid={touched && !(num(d[key]) >= 0)} className="num" />
    </Field>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save(!!submitLabels?.log);
      }}
    >
      <Field label={t("library.name")}>
        <Input value={d.name} onChange={(e) => set({ name: e.target.value })} required aria-invalid={touched && !d.name.trim()} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t("library.brand")} (${t("common.optional")})`}>
          <Input value={d.brand} onChange={(e) => set({ brand: e.target.value })} />
        </Field>
        <Field label={t("library.category")}>
          <Select value={d.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {catName(c)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("library.refAmount")}>
          <Input type="number" inputMode="decimal" step="any" min="0" value={d.refAmount} onChange={(e) => set({ refAmount: e.target.value })} className="num" aria-invalid={touched && !(num(d.refAmount) > 0)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("library.unit")}</span>
          <Segmented
            label={t("library.unit")}
            value={d.unit}
            onChange={(unit) => set({ unit })}
            options={[
              { id: "g", label: t("common.unitNames.g") },
              { id: "ml", label: t("common.unitNames.ml") },
            ]}
          />
        </div>
      </div>
      <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
        <p className="mb-3 text-[13px] font-semibold text-gold">{t("library.valuesFor", { amount: d.refAmount || "?", unit })}</p>
        <div className="grid grid-cols-2 gap-3">
          {numField("kcal", t("library.kcal"))}
          {numField("protein", `${t("common.protein")} (${t("common.units.g")})`)}
          {numField("carbs", `${t("common.carbs")} (${t("common.units.g")})`)}
          {numField("fat", `${t("common.fat")} (${t("common.units.g")})`)}
        </div>
        {mismatch && <p className="mt-3 text-xs text-gold">{t("library.kcalMismatch", { n: computed })}</p>}
      </div>
      {touched && !parsed && <p className="text-sm text-danger">{t("library.errors.invalidValues")}</p>}
      <div className="grid gap-2">
        {submitLabels?.log && (
          <Button type="submit" className="w-full">
            {submitLabels.log}
          </Button>
        )}
        <Button type={submitLabels?.log ? "button" : "submit"} variant={submitLabels?.log ? "soft" : "primary"} className="w-full" onClick={submitLabels?.log ? () => void save(false) : undefined}>
          {submitLabels?.save ?? t("common.save")}
        </Button>
      </div>
    </form>
  );
}
