"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { Bike, Check, Dumbbell, Flame, Footprints, Pencil, Plus, Sofa, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button, Card, CardTitle, DayNav, Field, Input, PageHeader, Progress, Segmented, Sheet, fmt } from "@/components/ui";
import { DayTypeControl } from "@/components/DayTypeControl";
import { addDays } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { HOME_EXERCISES } from "@/lib/defaults";
import { saveSettings, useSettings, useToday, useWorkoutName, useWorkoutTypes } from "@/lib/hooks";
import { uid } from "@/lib/ids";
import { putRow } from "@/lib/repo";
import { INTENSITIES, type Session, type Settings, type WorkoutType } from "@/lib/types";
import { newSession, plannedFor, toggleRound, weekAndMonth } from "@/lib/workouts";

export default function TrainingPage() {
  const t = useTranslations();
  const today = useToday();
  const settings = useSettings();
  const [date, setDate] = useState(today);
  if (!settings) return null;
  return (
    <>
      <PageHeader title={t("training.title")} />
      <div className="space-y-4">
        <DayNav date={date} today={today} onChange={setDate} />
        <div className="grid gap-4 md:grid-cols-2">
          <TodayWorkout date={date} settings={settings} />
          <div className="space-y-4">
            <Steps date={date} settings={settings} />
            <Card>
              <CardTitle>{t("dayType.title")}</CardTitle>
              <DayTypeControl date={date} settings={settings} />
            </Card>
          </div>
        </div>
        <Commitment today={today} settings={settings} />
      </div>
    </>
  );
}

function TodayWorkout({ date, settings }: { date: string; settings: Settings }) {
  const t = useTranslations();
  const types = useWorkoutTypes();
  const wname = useWorkoutName();
  const stored = useLiveQuery(() => getDb().sessions.get(date), [date]);
  const [changing, setChanging] = useState(false);
  const typeId = plannedFor(date, settings, stored ?? undefined);
  const wtype = types.find((x) => x.id === typeId);
  const session: Session = stored ?? newSession(date, typeId, settings, wtype?.kind);
  const save = (s: Session) => putRow("sessions", { ...s, updatedAt: Date.now() });

  const Icon = typeId === "rest" ? Sofa : wtype?.kind === "distance" ? Bike : Dumbbell;

  return (
    <Card>
      <CardTitle
        icon={Icon}
        action={
          <button className="flex items-center gap-1 text-xs font-semibold text-gold" onClick={() => setChanging(true)}>
            <Pencil className="size-3.5" /> {t("training.changeType")}
          </button>
        }
      >
        {t("training.todayWorkout")}
      </CardTitle>

      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-2xl font-bold">{wname(typeId)}</h3>
        {session.done && typeId !== "rest" && (
          <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success">
            {t("training.completed")}
          </motion.span>
        )}
      </div>

      {typeId === "rest" ? (
        <p className="rounded-2xl bg-track/50 p-4 text-[15px] leading-relaxed">{t("training.restDay")}</p>
      ) : wtype?.kind === "rounds" ? (
        <HomeRounds session={session} onChange={save} />
      ) : (
        <SimpleWorkout session={session} kind={wtype?.kind ?? "simple"} onChange={save} />
      )}

      <ChangeType open={changing} onClose={() => setChanging(false)} current={typeId} types={types} onPick={(id) => {
        const kind = types.find((x) => x.id === id)?.kind;
        const fresh = newSession(date, id, settings, kind);
        void save({ ...fresh, notes: session.notes, durationMin: session.durationMin, intensity: session.intensity });
        setChanging(false);
      }} />
    </Card>
  );
}

function HomeRounds({ session, onChange }: { session: Session; onChange: (s: Session) => void }) {
  const t = useTranslations();
  const rounds = session.rounds ?? [];
  const doneCount = rounds.filter(Boolean).length;
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 rounded-2xl bg-track/40 p-3 text-sm">
        {HOME_EXERCISES.map((e) => (
          <li key={e} className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-gold" /> {t(`exercises.${e}`)}
          </li>
        ))}
      </ul>
      <Progress value={doneCount} max={rounds.length} color="var(--success)" label={t("training.title")} />
      {rounds.map((done, i) => (
        <div key={i} className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition-colors ${done ? "bg-success/10 ring-success/30" : "bg-card2 ring-line"}`}>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => onChange(toggleRound(session, i))}
            aria-pressed={done}
            aria-label={t("training.round", { n: i + 1 })}
            className={`grid size-11 shrink-0 place-items-center rounded-full ring-2 transition-colors ${done ? "bg-success text-white ring-success" : "text-transparent ring-line"}`}
          >
            <Check className="size-6" strokeWidth={3} />
          </motion.button>
          <span className="flex-1 font-semibold">{t("training.round", { n: i + 1 })}</span>
          <label className="flex items-center gap-2 text-xs text-muted">
            {t("training.pushups")}
            <input
              type="number"
              inputMode="numeric"
              min="0"
              aria-label={`${t("training.pushups")} ${i + 1}`}
              value={session.pushups?.[i] ?? ""}
              onChange={(e) => {
                const pushups = [...(session.pushups ?? rounds.map(() => null))];
                pushups[i] = e.target.value === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0);
                onChange({ ...session, pushups });
              }}
              className="num h-10 w-16 rounded-xl bg-field text-center text-base font-semibold text-fg outline-none ring-1 ring-line focus:ring-2 focus:ring-gold"
            />
          </label>
        </div>
      ))}
    </div>
  );
}

function SimpleWorkout({ session, kind, onChange }: { session: Session; kind: WorkoutType["kind"]; onChange: (s: Session) => void }) {
  const t = useTranslations();
  const [km, setKm] = useState(session.km != null ? String(session.km) : "");
  const [lastId, setLastId] = useState(session.id + session.type);
  if (lastId !== session.id + session.type) {
    setLastId(session.id + session.type);
    setKm(session.km != null ? String(session.km) : "");
  }
  return (
    <div className="space-y-4">
      {kind === "distance" && (
        <Field label={t("training.km")}>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={km}
            aria-label={t("training.km")}
            onChange={(e) => setKm(e.target.value)}
            onBlur={() => {
              const v = parseFloat(km);
              onChange({ ...session, km: v > 0 ? v : undefined });
            }}
            className="num text-xl font-bold"
          />
        </Field>
      )}
      <Details session={session} onChange={onChange} />
      {session.done ? (
        <Button variant="ghost" className="w-full" onClick={() => onChange({ ...session, done: false })}>
          {t("training.undo")}
        </Button>
      ) : (
        <Button
          variant="success"
          className="w-full text-base"
          onClick={() => {
            const v = parseFloat(km);
            onChange({ ...session, done: true, km: kind === "distance" && v > 0 ? v : session.km });
          }}
        >
          {t("training.markDone")}
        </Button>
      )}
    </div>
  );
}

function Details({ session, onChange }: { session: Session; onChange: (s: Session) => void }) {
  const t = useTranslations();
  return (
    <details className="group rounded-2xl bg-card2 p-4 ring-1 ring-line">
      <summary className="cursor-pointer text-sm font-semibold text-muted">{t("training.details")}</summary>
      <div className="mt-3 space-y-3">
        <Field label={t("training.duration")}>
          <Input
            type="number"
            inputMode="numeric"
            defaultValue={session.durationMin ?? ""}
            key={`${session.id}-d`}
            onBlur={(e) => onChange({ ...session, durationMin: parseInt(e.target.value, 10) || undefined })}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("training.intensity")}</span>
          <Segmented value={session.intensity ?? "medium"} onChange={(intensity) => onChange({ ...session, intensity })} options={INTENSITIES.map((id) => ({ id, label: t(`intensity.${id}`) }))} />
        </div>
        <Field label={t("training.notes")}>
          <textarea
            key={`${session.id}-n`}
            defaultValue={session.notes ?? ""}
            rows={2}
            onBlur={(e) => onChange({ ...session, notes: e.target.value.trim() || undefined })}
            className="w-full rounded-2xl bg-field p-3 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-gold"
          />
        </Field>
      </div>
    </details>
  );
}

function ChangeType({ open, onClose, current, types, onPick }: { open: boolean; onClose: () => void; current: string; types: WorkoutType[]; onPick: (id: string) => void }) {
  const t = useTranslations();
  const wname = useWorkoutName();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"simple" | "distance">("simple");
  return (
    <Sheet open={open} onClose={onClose} title={t("training.changeType")}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[...types.map((x) => x.id), "rest"].map((id) => (
            <button
              key={id}
              onClick={() => onPick(id)}
              aria-pressed={current === id}
              className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${current === id ? "bg-gold text-gold-ink ring-gold" : "bg-card ring-line"}`}
            >
              {wname(id)}
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-line">
          <p className="text-sm font-semibold">{t("training.addType")}</p>
          <Input placeholder={t("training.typeName")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("training.typeName")} />
          <Segmented value={kind} onChange={setKind} options={[{ id: "simple", label: t("training.kindSimple") }, { id: "distance", label: t("training.kindDistance") }]} />
          <Button
            variant="soft"
            icon={Plus}
            className="w-full"
            disabled={!name.trim()}
            onClick={async () => {
              const id = uid();
              await putRow<WorkoutType>("workoutTypes", { id, name: name.trim(), kind });
              setName("");
              onPick(id);
            }}
          >
            {t("common.add")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Steps({ date, settings }: { date: string; settings: Settings }) {
  const t = useTranslations();
  const steps = useLiveQuery(() => getDb().steps.get(date), [date]);
  const [v, setV] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const count = steps?.count ?? 0;
  return (
    <Card>
      <CardTitle
        icon={Footprints}
        action={
          <button className="num text-xs font-semibold text-gold" onClick={() => setGoalOpen(true)}>
            {t("common.goal")}: {fmt(settings.stepsGoal)} ✎
          </button>
        }
      >
        {t("training.steps")}
      </CardTitle>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="num text-4xl font-extrabold">{fmt(count)}</span>
        <span className="text-sm font-medium text-muted">{count >= settings.stepsGoal ? t("training.stepsDone") : t("training.stepsLeft", { n: fmt(settings.stepsGoal - count) })}</span>
      </div>
      <Progress value={count} max={settings.stepsGoal} color="var(--success)" label={t("training.steps")} />
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = parseInt(v.replace(/[^\d]/g, ""), 10);
          if (!(n >= 0 && n < 200000)) return;
          await putRow("steps", { id: date, date, count: n });
          setV("");
        }}
      >
        <Input type="number" inputMode="numeric" placeholder={t("training.stepsPlaceholder")} value={v} onChange={(e) => setV(e.target.value)} aria-label={t("training.stepsPlaceholder")} />
        <Button type="submit" disabled={!v}>
          {steps ? t("training.update") : t("training.log")}
        </Button>
      </form>
      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title={t("training.stepsGoal")}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const g = parseInt(new FormData(e.currentTarget).get("goal") as string, 10);
            if (g > 0) await saveSettings({ stepsGoal: g });
            setGoalOpen(false);
          }}
        >
          <Input name="goal" type="number" inputMode="numeric" defaultValue={settings.stepsGoal} aria-label={t("training.stepsGoal")} />
          <Button type="submit" className="w-full">
            {t("common.save")}
          </Button>
        </form>
      </Sheet>
    </Card>
  );
}

function Commitment({ today, settings }: { today: string; settings: Settings }) {
  const t = useTranslations();
  const sessions = useLiveQuery(() => getDb().sessions.where("date").aboveOrEqual(addDays(today, -400)).toArray(), [today]);
  const c = useMemo(() => (sessions ? weekAndMonth(today, settings, new Map(sessions.map((s) => [s.date, s]))) : null), [sessions, today, settings]);
  if (!c) return null;
  return (
    <Card>
      <CardTitle icon={Target}>{t("training.commitment")}</CardTitle>
      <div className="grid grid-cols-3 gap-3">
        <Pct label={t("training.week")} c={c.week} />
        <Pct label={t("training.month")} c={c.month} />
        <div className="rounded-2xl bg-gold/10 p-4 text-center">
          <Flame className="mx-auto size-6 text-gold" />
          <div className="num mt-1 text-3xl font-extrabold text-gold" data-testid="workout-streak">
            {c.streak}
          </div>
          <div className="text-xs text-muted">{t("training.streak")}</div>
        </div>
      </div>
    </Card>
  );
}

function Pct({ label, c }: { label: string; c: { planned: number; done: number; pct: number | null } }) {
  const t = useTranslations();
  return (
    <div className="rounded-2xl bg-card2 p-4 text-center ring-1 ring-line">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 text-3xl font-extrabold">{c.pct == null ? "—" : `${c.pct}%`}</div>
      <div className="num text-xs text-muted">{t("training.ofPlanned", { done: c.done, planned: c.planned })}</div>
    </div>
  );
}

