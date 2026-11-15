"use client";

import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { ChevronLeft, ChevronRight, Settings as SettingsIcon, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, type ReactNode } from "react";
import { addDays, weekday, fromKey } from "@/lib/dates";
import { SyncBadge } from "./SyncBadge";

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & Omit<HTMLMotionProps<"section">, "children">) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-3xl bg-card p-5 shadow-soft ring-1 ring-line ${className}`}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

export function CardTitle({ children, icon: Icon, action }: { children: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-muted">
        {Icon && <Icon className="size-[18px] text-gold" strokeWidth={2} aria-hidden />}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action, settings = true, logo }: { title: string; subtitle?: string; action?: ReactNode; settings?: boolean; logo?: ReactNode }) {
  const t = useTranslations("common");
  return (
    <header className="flex items-end justify-between gap-3 pb-5 pt-3">
      <div className="flex min-w-0 items-center gap-3">
        {logo}
        <div className="min-w-0">
        <h1 className="truncate text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <SyncBadge />
        {settings && (
          <Link href="/settings" aria-label={t("settings")} className="grid size-11 place-items-center rounded-full bg-card text-muted shadow-soft ring-1 ring-line transition active:scale-95">
            <SettingsIcon className="size-5" />
          </Link>
        )}
      </div>
    </header>
  );
}

export function Progress({ value, max, color = "var(--gold)", label, height = "h-2.5" }: { value: number; max: number; color?: string; label?: string; height?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-track`} role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

/** حلقة تقدم مثل تطبيقات Apple */
export function Ring({ value, max, size = 120, stroke = 12, color = "var(--gold)", children, label }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

type BtnProps = Omit<HTMLMotionProps<"button">, "children"> & { variant?: "primary" | "soft" | "ghost" | "danger" | "success" | "neutral"; icon?: LucideIcon; children?: ReactNode };
export function Button({ variant = "primary", className = "", icon: Icon, children, ...p }: BtnProps) {
  const v = {
    primary: "bg-gold text-gold-ink shadow-soft",
    soft: "bg-gold/12 text-gold",
    ghost: "text-muted hover:bg-track/60",
    danger: "bg-danger/12 text-danger",
    success: "bg-success text-white shadow-soft",
    neutral: "bg-card text-fg shadow-soft ring-1 ring-line",
  }[variant];
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 ${v} ${className}`}
      {...p}
    >
      {Icon && <Icon className="size-[18px]" strokeWidth={2.2} aria-hidden />}
      {children}
    </motion.button>
  );
}

export function IconButton({ icon: Icon, label, onClick, className = "" }: { icon: LucideIcon; label: string; onClick?: () => void; className?: string }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} type="button" aria-label={label} onClick={onClick} className={`grid size-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-track/60 ${className}`}>
      <Icon className="size-[18px]" />
    </motion.button>
  );
}

export function Input({ className = "", ...p }: React.ComponentProps<"input">) {
  return <input {...p} className={`min-h-12 w-full rounded-2xl bg-field px-4 text-base outline-none ring-1 ring-line transition placeholder:text-muted/70 focus:ring-2 focus:ring-gold ${className}`} />;
}

export function Select({ className = "", children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={`min-h-12 w-full appearance-none rounded-2xl bg-field px-4 text-base outline-none ring-1 ring-line focus:ring-2 focus:ring-gold ${className}`}>
      {children}
    </select>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[]; label?: string }) {
  const id = useId();
  return (
    <div className="flex rounded-2xl bg-track/70 p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`relative min-h-10 flex-1 rounded-xl px-2 text-sm font-semibold transition-colors ${value === o.id ? "text-fg" : "text-muted"}`}
        >
          {value === o.id && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-xl bg-seg shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTranslations("common");
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-bg p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-line sm:rounded-[28px]"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-track sm:hidden" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">{title}</h2>
              <IconButton icon={X} label={t("close")} onClick={onClose} className="bg-track/70" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useDayLabel() {
  const t = useTranslations();
  return (date: string, today: string) => {
    if (date === today) return t("common.today");
    if (date === addDays(today, -1)) return t("common.yesterday");
    const d = fromKey(date);
    return `${t(`weekdays.${weekday(date)}` as "weekdays.0")} ${d.getDate()}/${d.getMonth() + 1}`;
  };
}

export function DayNav({ date, today, onChange }: { date: string; today: string; onChange: (d: string) => void }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const label = useDayLabel();
  const rtl = locale === "ar";
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-1 shadow-soft ring-1 ring-line">
      <IconButton icon={Prev} label={t("prevDay")} onClick={() => onChange(addDays(date, -1))} />
      <button className="text-[15px] font-semibold" onClick={() => onChange(today)}>
        {label(date, today)}
      </button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        className="grid size-10 place-items-center rounded-full text-muted disabled:opacity-25"
        onClick={() => onChange(addDays(date, 1))}
        disabled={date >= today}
        aria-label={t("nextDay")}
      >
        <Next className="size-[18px]" />
      </motion.button>
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft ring-1 ring-line">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {Icon && <Icon className="size-3.5 text-gold" aria-hidden />}
        {label}
      </div>
      <div className="num mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

/** أرقام غربية بفواصل */
export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** رقم بإشارة (+/-) يظهر صح في الاتجاهين */
export function Signed({ n, digits = 1 }: { n: number | null; digits?: number }) {
  if (n == null) return <>—</>;
  return <span dir="ltr">{`${n > 0 ? "+" : ""}${fmt(n, digits)}`}</span>;
}
