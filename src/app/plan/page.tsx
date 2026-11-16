"use client";

import { PageLoading } from "@/components/PageLoading";
import { useLiveQuery } from "dexie-react-hooks";
import { LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { LogFoodSheet } from "@/components/food/LogFoodSheet";
import { Button, Card, CardTitle, Input, PageHeader, Progress, Segmented, fmt, useOnce } from "@/components/ui";
import { addDays, shortDay } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { foodName, useCategories, useCategoryName, useFoods, useSettings, useToday } from "@/lib/hooks";
import { planTotals, type Plan, type PlanFood, type PlanRequest } from "@/lib/plan";
import { authHeader } from "@/lib/supabase";
import { computeTargets, resolveDayType } from "@/lib/targets";
import type { Food, Locale } from "@/lib/types";

type ErrCode = "no_key" | "rate_limit" | "busy" | "offline" | "auth" | "generic";
const STORE = "lyaqa-plan";

interface Saved {
  date: string;
  plan: Plan;
}

function loadSaved(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "null");
  } catch {
    return null;
  }
}

export default function PlanPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const today = useToday();
  const settings = useSettings();
  const foods = useFoods();
  const cats = useCategories();
  const catName = useCategoryName();
  const once = useOnce();
  const [which, setWhich] = useState<"today" | "tomorrow">("tomorrow");
  const date = which === "today" ? today : addDays(today, 1);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrCode | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [logging, setLogging] = useState<{ food: Food; amount: number; meal: Plan["meals"][number]["meal"] } | null>(null);

  useEffect(() => setSaved(loadSaved()), []);

  const day = useLiveQuery(async () => {
    const db = getDb();
    const [o, session] = await Promise.all([db.dayTypes.get(date), db.sessions.get(date)]);
    return { override: o?.type, session };
  }, [date]);
  const recent = useLiveQuery(async () => {
    const es = await getDb().entries.where("date").between(addDays(today, -7), today, true, true).toArray();
    const m = new Map<string, number>();
    for (const e of es) if (e.foodId) m.set(e.foodId, (m.get(e.foodId) ?? 0) + 1);
    return m;
  }, [today]);

  const catIds = useMemo(() => selected ?? new Set((cats ?? []).map((c) => c.id)), [selected, cats]);
  const pool = useMemo(() => (foods ?? []).filter((f) => catIds.has(f.categoryId)), [foods, catIds]);
  const byId = useMemo(() => new Map((foods ?? []).map((f) => [f.id, f])), [foods]);

  if (!settings || !foods || !cats || !day || !recent) return <PageLoading />;
  const info = resolveDayType(date, settings, day);
  const targets = computeTargets(info.type, settings);
  const plan = saved?.plan;
  const totals = plan ? planTotals(plan, byId) : null;

  const toggleCat = (id: string) => {
    const next = new Set(catIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const generate = () =>
    once(async () => {
      setError(null);
      if (!navigator.onLine) return setError("offline");
      setBusy(true);
      try {
        const catLabel = new Map(cats.map((c) => [c.id, catName(c)]));
        const list: PlanFood[] = pool.slice(0, 150).map((f) => ({
          id: f.id,
          name: foodName(f, locale),
          category: catLabel.get(f.categoryId) ?? "",
          refAmount: f.refAmount,
          unit: f.unit,
          kcal: f.kcal,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          recent: recent.get(f.id) ?? 0,
        }));
        const body: PlanRequest = { locale, dayType: info.type, targets, note: note.trim() || undefined, foods: list };
        const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const code = data.error as string;
          return setError((["no_key", "rate_limit", "busy", "auth"].includes(code) ? code : "generic") as ErrCode);
        }
        const s: Saved = { date, plan: data as Plan };
        setSaved(s);
        try {
          localStorage.setItem(STORE, JSON.stringify(s));
        } catch {}
      } catch {
        setError(navigator.onLine ? "generic" : "offline");
      } finally {
        setBusy(false);
      }
    });

  return (
    <>
      <PageHeader title={t("plan.title")} subtitle={t("plan.subtitle")} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-5">
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("plan.day")}</span>
            <Segmented
              value={which}
              onChange={setWhich}
              options={[
                { id: "today", label: t("plan.today") },
                { id: "tomorrow", label: t("plan.tomorrow") },
              ]}
            />
            <p className="num mt-2 text-xs text-muted">{t("plan.dayInfo", { type: t(`dayType.${info.type}`), kcal: fmt(targets.kcal), protein: targets.protein })}</p>
          </div>
          <div>
            <span className="mb-2 block text-[13px] font-medium text-muted">{t("plan.categories")}</span>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => {
                const on = catIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCat(c.id)}
                    className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition ${on ? "bg-gold text-gold-ink ring-gold" : "bg-card2 text-muted ring-line"}`}
                  >
                    {catName(c)}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("plan.note")}</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t("plan.notePlaceholder")} />
          </label>
          {pool.length < 3 && <p className="text-sm text-danger">{t("plan.tooFew")}</p>}
          <Button className="w-full" icon={busy ? LoaderCircle : Sparkles} disabled={busy || pool.length < 3} onClick={generate}>
            {busy ? t("plan.generating") : plan ? t("plan.regenerate") : t("plan.generate")}
          </Button>
          {busy && <p className="text-center text-xs text-muted">{t("plan.generating")}</p>}
          {error && (
            <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {t(`plan.errors.${error}`)}
            </p>
          )}
        </Card>

        {plan && totals && (
          <div className="space-y-4">
            <Card>
              <CardTitle
                icon={Sparkles}
                action={
                  <button onClick={generate} disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-gold disabled:opacity-40">
                    <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> {t("plan.regenerate")}
                  </button>
                }
              >
                {t("plan.totals")} · {saved.date === today ? t("plan.today") : saved.date === addDays(today, 1) ? t("plan.tomorrow") : shortDay(saved.date)}
              </CardTitle>
              <div className="space-y-3">
                <Row label={t("common.calories")} value={totals.kcal} target={targets.kcal} color="var(--kcal)" />
                <Row label={t("common.protein")} value={totals.protein} target={targets.protein} color="var(--protein)" />
                <Row label={t("common.carbs")} value={totals.carbs} target={targets.carbs} color="var(--carbs)" />
                <Row label={t("common.fat")} value={totals.fat} target={targets.fat} color="var(--fat)" />
              </div>
              {plan.tip && <p className="mt-4 rounded-2xl bg-gold/10 px-4 py-3 text-sm leading-relaxed">{plan.tip}</p>}
              <p className="mt-3 text-xs text-muted">{t("plan.aiNote")}</p>
            </Card>

            {plan.meals.map((m) => (
              <Card key={m.meal}>
                <h2 className="mb-2 text-lg font-bold">{t(`meals.${m.meal}`)}</h2>
                <ul className="divide-y divide-line">
                  {m.items.map((it) => {
                    const f = byId.get(it.foodId);
                    if (!f) return null;
                    const kcal = Math.round((f.kcal * it.amount) / f.refAmount);
                    const protein = Math.round((f.protein * it.amount) / f.refAmount * 10) / 10;
                    return (
                      <li key={it.foodId}>
                        <button className="flex w-full items-center justify-between gap-3 py-2.5 text-start" onClick={() => setLogging({ food: f, amount: it.amount, meal: m.meal })}>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{foodName(f, locale)}</span>
                            <span className="num block text-xs text-muted">
                              {fmt(it.amount)} {t(`common.units.${f.unit}`)} · {fmt(kcal)} {t("common.kcal")} · {t("common.protein")} {fmt(protein, 1)}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-card2 px-3 py-1.5 text-xs font-semibold text-gold ring-1 ring-line">{t("home.logIt")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
            <p className="px-1 text-xs text-muted">{t("plan.tapToLog")}</p>
          </div>
        )}
      </div>

      <LogFoodSheet
        food={logging?.food ?? null}
        suggestedAmount={logging?.amount}
        meal={logging?.meal}
        date={saved?.date && saved.date <= today ? saved.date : today}
        onClose={() => setLogging(null)}
      />
    </>
  );
}

function Row({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="num text-muted">
          <b className="text-fg">{fmt(value)}</b> / {fmt(target)}
        </span>
      </div>
      <Progress value={value} max={target} color={color} height="h-2" label={label} />
    </div>
  );
}
