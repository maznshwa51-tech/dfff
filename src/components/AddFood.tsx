"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { getDb, MEALS, type Food, type Meal } from "@/lib/db";
import { bestMatch, parseFoodInput, round1, scaleMacros, searchFoods, type Macros } from "@/lib/food-match";
import { Button, Field, Input, Segmented, Sheet } from "./ui";

interface Draft extends Macros {
  // القيم هنا لكل 100 غ
  name: string;
  grams: number;
  foodId?: number;
  source: "db" | "ai" | "manual";
  confidence?: "high" | "medium" | "low";
  serving?: { grams: number; label: string };
  saveToDb: boolean;
}

export function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export function AddFood({ date, meal, onMealChange }: { date: string; meal: Meal; onMealChange: (m: Meal) => void }) {
  const foods = useLiveQuery(() => getDb().foods.toArray(), []) ?? [];
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiState, setAiState] = useState<{ loading: boolean; error?: string; notFound?: string }>({ loading: false });

  const parsed = useMemo(() => parseFoodInput(text), [text]);
  const suggestions = useMemo(() => (parsed.name.length >= 2 ? searchFoods(parsed.name, foods, 5) : []), [parsed.name, foods]);

  function openFromFood(f: Food, grams: number | null) {
    setDraft({
      name: f.name,
      kcal: f.kcal,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      grams: grams ?? f.serving?.grams ?? 100,
      foodId: f.id,
      source: "db",
      serving: f.serving,
      saveToDb: false,
    });
    setAiState({ loading: false });
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!parsed.name) return;
    const match = bestMatch(parsed.name, foods);
    if (match) openFromFood(match, parsed.grams);
    else setAiState({ loading: false, notFound: parsed.name });
  }

  async function askClaude() {
    const name = aiState.notFound ?? parsed.name;
    setAiState({ loading: true, notFound: name });
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "صار خطأ");
      setDraft({
        name: data.name || name,
        kcal: data.kcal,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        grams: parsed.grams ?? data.serving?.grams ?? 100,
        source: "ai",
        confidence: data.confidence,
        serving: data.serving,
        saveToDb: true,
      });
      setAiState({ loading: false });
    } catch (err) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setAiState({
        loading: false,
        notFound: name,
        error: offline ? "ما فيه إنترنت. تقدر تدخل القيم يدوياً." : (err as Error).message,
      });
    }
  }

  function manual() {
    setDraft({
      name: aiState.notFound ?? parsed.name,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      grams: parsed.grams ?? 100,
      source: "manual",
      saveToDb: true,
    });
    setAiState({ loading: false });
  }

  async function save() {
    if (!draft || draft.grams <= 0) return;
    const db = getDb();
    let foodId = draft.foodId;
    const per100 = { kcal: draft.kcal, protein: draft.protein, carbs: draft.carbs, fat: draft.fat };
    if (draft.source === "db" && foodId != null && draft.saveToDb) {
      await db.foods.update(foodId, per100); // عدّلت قيم أكلة موجودة
    }
    if (draft.source !== "db" && draft.saveToDb) {
      const alias = parsed.name && parsed.name !== draft.name ? [parsed.name] : [];
      foodId = await db.foods.add({
        name: draft.name,
        aliases: alias,
        ...per100,
        serving: draft.serving,
        source: draft.source === "ai" ? "ai" : "custom",
      });
    }
    await db.entries.add({
      date,
      meal,
      name: draft.name,
      grams: draft.grams,
      foodId,
      ...scaleMacros(per100, draft.grams),
      createdAt: Date.now(),
    });
    setDraft(null);
    setText("");
    setAiState({ loading: false });
  }

  return (
    <div className="space-y-3">
      <Segmented value={meal} onChange={onMealChange} options={MEALS} />
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAiState({ loading: false });
          }}
          placeholder="مثلاً: رز أبيض مطبوخ 150 غ"
          aria-label="الأكلة والوزن"
          enterKeyHint="done"
          autoComplete="off"
        />
        <Button type="submit" disabled={!parsed.name}>
          أضف
        </Button>
      </form>

      {suggestions.length > 0 && !aiState.notFound && (
        <ul className="flex flex-wrap gap-2" aria-label="اقتراحات">
          {suggestions.map(({ food }) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => openFromFood(food, parsed.grams)}
                className="rounded-full bg-card px-3 py-1.5 text-sm ring-1 ring-line active:bg-track"
              >
                {food.name}
                {food.source !== "seed" && <span className="ms-1 text-xs text-muted">★</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {aiState.notFound && (
        <div className="space-y-2 rounded-xl bg-card p-3 text-sm ring-1 ring-line">
          <p>
            «{aiState.notFound}» مش موجودة في القاعدة المحلية.
          </p>
          {aiState.error && <p className="text-red-600 dark:text-red-400">{aiState.error}</p>}
          <div className="flex gap-2">
            <Button onClick={askClaude} disabled={aiState.loading} className="flex-1">
              {aiState.loading ? "Claude يحسب…" : "✨ اسأل Claude"}
            </Button>
            <Button variant="soft" onClick={manual} disabled={aiState.loading}>
              إدخال يدوي
            </Button>
          </div>
        </div>
      )}

      <FoodPreview draft={draft} onChange={setDraft} onSave={save} onClose={() => setDraft(null)} />
    </div>
  );
}

function FoodPreview({
  draft,
  onChange,
  onSave,
  onClose,
}: {
  draft: Draft | null;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  if (!draft) return null;
  const total = scaleMacros(draft, draft.grams || 0);
  const num = (v: string) => {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const computedKcal = Math.round(draft.protein * 4 + draft.carbs * 4 + draft.fat * 9);

  return (
    <Sheet open onClose={onClose} title="راجع قبل الحفظ">
      <div className="space-y-4">
        {draft.source === "ai" && (
          <p className="rounded-xl bg-brand/10 p-3 text-sm">
            ✨ هذي تقديرات من Claude
            {draft.confidence === "low" ? " (ثقة منخفضة، راجعها)" : ""}. تقدر تعدّلها قبل الحفظ.
          </p>
        )}
        <Field label="اسم الأكلة">
          <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="الكمية (غرام)" hint={draft.serving ? `حصة شائعة: ${draft.serving.label} = ${draft.serving.grams} غ` : undefined}>
          <Input inputMode="decimal" type="number" value={draft.grams || ""} onChange={(e) => set({ grams: num(e.target.value) })} />
        </Field>

        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-card p-3 text-center ring-1 ring-line">
          <Total label="سعرات" value={total.kcal} color="var(--kcal)" />
          <Total label="بروتين" value={total.protein} unit="غ" color="var(--protein)" />
          <Total label="كارب" value={total.carbs} unit="غ" color="var(--carbs)" />
          <Total label="دهون" value={total.fat} unit="غ" color="var(--fat)" />
        </div>

        <details className="rounded-xl bg-card p-3 ring-1 ring-line" open={draft.source !== "db"}>
          <summary className="cursor-pointer text-sm font-semibold">القيم لكل 100 غ</summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="سعرات">
              <Input inputMode="decimal" type="number" value={draft.kcal} onChange={(e) => set({ kcal: num(e.target.value) })} />
            </Field>
            <Field label="بروتين (غ)">
              <Input inputMode="decimal" type="number" value={draft.protein} onChange={(e) => set({ protein: num(e.target.value) })} />
            </Field>
            <Field label="كربوهيدرات (غ)">
              <Input inputMode="decimal" type="number" value={draft.carbs} onChange={(e) => set({ carbs: num(e.target.value) })} />
            </Field>
            <Field label="دهون (غ)">
              <Input inputMode="decimal" type="number" value={draft.fat} onChange={(e) => set({ fat: num(e.target.value) })} />
            </Field>
          </div>
          {draft.kcal > 0 && Math.abs(computedKcal - draft.kcal) / draft.kcal > 0.25 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ملاحظة: من البروتين والكارب والدهون المفروض السعرات تقريباً {computedKcal}.
            </p>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={draft.saveToDb} onChange={(e) => set({ saveToDb: e.target.checked })} />
            {draft.source === "db" ? "احفظ التعديل على القيم في القاعدة" : "احفظها في القاعدة المحلية (ما يحتاج أسأل Claude مرة ثانية)"}
          </label>
        </details>

        <Button onClick={onSave} className="w-full" disabled={!draft.name || draft.grams <= 0}>
          حفظ ({round1(draft.grams)} غ)
        </Button>
      </div>
    </Sheet>
  );
}

function Total({ label, value, unit, color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <div>
      <div className="text-lg font-bold tabular-nums" style={{ color }}>
        {value}
        {unit && <span className="text-xs font-normal"> {unit}</span>}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
