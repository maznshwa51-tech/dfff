"use client";

import { useEffect, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line ${className}`}>{children}</section>;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between pb-3 pt-2">
      <h1 className="text-2xl font-bold">{title}</h1>
      {action}
    </header>
  );
}

export function Progress({ value, max, color = "var(--color-brand)", label }: { value: number; max: number; color?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemax={max}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "soft" | "danger" };
export function Button({ variant = "primary", className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-brand text-white dark:text-slate-950 active:opacity-80 disabled:opacity-50",
    soft: "bg-brand/12 text-brand active:bg-brand/20 disabled:opacity-50",
    ghost: "text-muted active:bg-track",
    danger: "bg-red-500/12 text-red-600 dark:text-red-400 active:bg-red-500/20",
  }[variant];
  return <button className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition ${v} ${className}`} {...p} />;
}

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      className={`min-h-11 w-full rounded-xl bg-field px-3 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-brand ${p.className ?? ""}`}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <div className="flex rounded-xl bg-track p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-9 flex-1 rounded-lg px-2 text-sm font-medium transition ${value === o.id ? "bg-card text-fg shadow-sm" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-bg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-track text-muted" aria-label="إغلاق">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DayNav({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-card px-1 py-1 ring-1 ring-line">
      <button className="grid size-10 place-items-center rounded-lg text-lg text-muted active:bg-track" onClick={() => onChange(shift(date, -1))} aria-label="اليوم السابق">
        ›
      </button>
      <button className="text-sm font-semibold" onClick={() => onChange(today)}>
        {date === today ? "اليوم" : date === shift(today, -1) ? "أمس" : formatDayLocal(date)}
      </button>
      <button
        className="grid size-10 place-items-center rounded-lg text-lg text-muted active:bg-track disabled:opacity-30"
        onClick={() => onChange(shift(date, 1))}
        disabled={date >= today}
        aria-label="اليوم التالي"
      >
        ‹
      </button>
    </div>
  );
}

import { addDays as shift, formatDay as formatDayLocal } from "@/lib/dates";

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-track/60 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
