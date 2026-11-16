"use client";

import { CalendarDays, Download, Languages, LogOut, Mail, MessageCircle, Palette, Send, ShieldCheck, Target, TriangleAlert, Upload, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useAuth } from "@/components/Providers";
import { ThemePicker } from "@/components/ThemePicker";
import { Button, Card, CardTitle, Field, Input, PageHeader, Segmented, Select } from "@/components/ui";
import { exportAll, importAll, validateBackup } from "@/lib/backup";
import { todayKey } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { saveSettings, useSettings, useWorkoutName, useWorkoutTypes } from "@/lib/hooks";
import { authHeader } from "@/lib/supabase";
import { computeTargets } from "@/lib/targets";
import type { Settings } from "@/lib/types";

const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // يبدأ بالسبت
const TIMEZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat", "Africa/Cairo", "Asia/Amman", "Europe/London", "America/New_York"];

export default function SettingsPage() {
  const t = useTranslations();
  const s = useSettings();
  const types = useWorkoutTypes();
  const wname = useWorkoutName();
  const auth = useAuth();
  if (!s) return null;

  const tr = computeTargets("training", s);
  const rest = computeTargets("rest", s);
  const report = (p: Partial<Settings["report"]>) => saveSettings((cur) => ({ report: { ...cur.report, ...p } }));

  return (
    <>
      <PageHeader title={t("settings.title")} settings={false} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle icon={ShieldCheck}>{t("auth.account")}</CardTitle>
          {auth.enabled && auth.user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted" dir="auto">
                {t("auth.signedInAs", { email: auth.user.email ?? "" })}
              </p>
              <Button
                variant="danger"
                icon={LogOut}
                className="w-full"
                onClick={async () => {
                  if (confirm(t("auth.signOutConfirm"))) await auth.signOut();
                }}
              >
                {t("auth.signOut")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("sync.local")}</p>
          )}
        </Card>

        <Card>
          <CardTitle icon={Palette}>{t("settings.appearance")}</CardTitle>
          <Segmented value={s.theme} onChange={(theme) => saveSettings({ theme })} options={(["dark", "light", "system"] as const).map((id) => ({ id, label: t(`settings.theme.${id}`) }))} />
          <div className="mt-5">
            <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-muted">
              <Languages className="size-4" /> {t("settings.language")}
            </span>
            <Segmented
              value={s.locale}
              onChange={(locale) => saveSettings({ locale })}
              options={[
                { id: "ar", label: "العربية" },
                { id: "en", label: "English" },
              ]}
            />
          </div>
        </Card>

        <ThemePicker value={s.accent ?? "gold"} />

        <Card>
          <CardTitle icon={Target}>{t("settings.targets")}</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settings.kcalTraining")}>
              <NumInput value={s.kcalTraining} onSave={(v) => saveSettings({ kcalTraining: v })} />
            </Field>
            <Field label={t("settings.kcalRest")}>
              <NumInput value={s.kcalRest} onSave={(v) => saveSettings({ kcalRest: v })} />
            </Field>
            <Field label={t("settings.protein")}>
              <NumInput value={s.proteinG} onSave={(v) => saveSettings({ proteinG: v })} />
            </Field>
            <Field label={t("settings.fatPct")}>
              <NumInput value={Math.round(s.fatPct * 100)} onSave={(v) => saveSettings({ fatPct: Math.min(60, Math.max(10, v)) / 100 })} />
            </Field>
          </div>
          <table className="num mt-4 w-full text-center text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th />
                <th className="font-medium">{t("common.kcal")}</th>
                <th className="font-medium">{t("common.protein")}</th>
                <th className="font-medium">{t("common.carbs")}</th>
                <th className="font-medium">{t("common.fat")}</th>
              </tr>
            </thead>
            <tbody>
              {[
                [t("settings.training"), tr],
                [t("settings.rest"), rest],
              ].map(([label, x]) => {
                const v = x as typeof tr;
                return (
                  <tr key={label as string}>
                    <td className="py-1.5 text-start font-sans">{label as string}</td>
                    <td>{v.kcal}</td>
                    <td>{v.protein}</td>
                    <td>{v.carbs}</td>
                    <td>{v.fat}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">{t("settings.carbsNote")}</p>
          <div className="mt-4">
            <Field label={t("settings.units")}>
              <Segmented
                value={s.defaultUnit}
                onChange={(defaultUnit) => saveSettings({ defaultUnit })}
                options={[
                  { id: "g", label: t("common.unitNames.g") },
                  { id: "ml", label: t("common.unitNames.ml") },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle icon={CalendarDays}>{t("settings.schedule")}</CardTitle>
          <p className="mb-3 text-xs text-muted">{t("settings.scheduleNote")}</p>
          <ul className="divide-y divide-line">
            {WEEK_ORDER.map((d) => (
              <li key={d} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium">{t(`weekdays.${d}` as "weekdays.0")}</span>
                <Select
                  aria-label={t(`weekdays.${d}` as "weekdays.0")}
                  value={s.schedule[d] ?? "rest"}
                  onChange={(e) => {
                    const v = e.target.value;
                    void saveSettings((cur) => ({ schedule: { ...cur.schedule, [d]: v } }));
                  }}
                  className="!min-h-10 !w-44 text-sm"
                >
                  {[...types.map((x) => x.id), "rest"].map((id) => (
                    <option key={id} value={id}>
                      {wname(id)}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Field label={t("settings.homeRounds")}>
              <NumInput value={s.homeRounds} onSave={(v) => saveSettings({ homeRounds: Math.min(10, Math.max(1, Math.round(v))) })} />
            </Field>
          </div>
        </Card>

        <ReportSettings s={s} report={report} accountEnabled={auth.enabled} />

        <Card>
          <CardTitle icon={TriangleAlert}>{t("settings.alerts")}</CardTitle>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("settings.lowKcal")}>
              <NumInput value={s.lowKcalAlert} onSave={(v) => saveSettings({ lowKcalAlert: v })} />
            </Field>
            <Field label={t("settings.lowProtein")}>
              <NumInput value={s.lowProteinAlert} onSave={(v) => saveSettings({ lowProteinAlert: v })} />
            </Field>
            <Field label={t("settings.weeklyLoss")}>
              <NumInput value={s.weeklyLossAlertKg} step="0.1" onSave={(v) => saveSettings({ weeklyLossAlertKg: v })} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle icon={User}>{t("settings.profile")}</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settings.age")}>
              <NumInput value={s.profile.age} onSave={(v) => saveSettings((cur) => ({ profile: { ...cur.profile, age: v } }))} />
            </Field>
            <Field label={t("settings.height")}>
              <NumInput value={s.profile.heightCm} onSave={(v) => saveSettings((cur) => ({ profile: { ...cur.profile, heightCm: v } }))} />
            </Field>
            <Field label={t("settings.startWeight")}>
              <NumInput value={s.profile.startWeightKg} step="0.1" onSave={(v) => saveSettings((cur) => ({ profile: { ...cur.profile, startWeightKg: v } }))} />
            </Field>
            <Field label={t("settings.sport")}>
              <Input key={s.profile.sport} defaultValue={s.profile.sport} onBlur={(e) => e.target.value !== s.profile.sport && saveSettings((cur) => ({ profile: { ...cur.profile, sport: e.target.value } }))} />
            </Field>
          </div>
        </Card>

        <Backup />
      </div>
      <p className="py-6 text-center text-xs text-muted">{auth.enabled ? t("settings.footer") : t("settings.footerLocal")}</p>
    </>
  );
}

function ReportSettings({ s, report, accountEnabled }: { s: Settings; report: (p: Partial<Settings["report"]>) => Promise<void>; accountEnabled: boolean }) {
  const t = useTranslations();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const r = s.report;
  const tzs = TIMEZONES.includes(r.timezone) ? TIMEZONES : [r.timezone, ...TIMEZONES];

  const test = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { syncManager } = await import("@/lib/sync-client");
      await syncManager.runNow(); // نتأكد إن آخر البيانات وصلت للسيرفر
      const res = await fetch("/api/report/send", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ date: todayKey() }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      const failed = (body.results as { channel: string; ok: boolean; error?: string }[]).filter((x) => !x.ok);
      setStatus(failed.length ? { ok: false, text: failed.map((f) => `${f.channel}: ${f.error}`).join(" · ") } : { ok: true, text: t("settings.reportSent") });
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle icon={Send}>{t("settings.report")}</CardTitle>
      {!accountEnabled && <p className="mb-3 rounded-2xl bg-gold/10 p-3 text-xs text-gold">{t("settings.reportNeedsAccount")}</p>}
      <label className="mb-4 flex items-center justify-between gap-3">
        <span className="font-medium">{t("settings.reportEnabled")}</span>
        <input type="checkbox" className="size-6 accent-[var(--gold)]" checked={r.enabled} onChange={(e) => report({ enabled: e.target.checked })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("settings.reportTime")}>
          <Input type="time" value={r.time} onChange={(e) => e.target.value && report({ time: e.target.value })} />
        </Field>
        <Field label={t("settings.timezone")}>
          <Select value={r.timezone} onChange={(e) => report({ timezone: e.target.value })}>
            {tzs.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <span className="mb-1.5 block text-[13px] font-medium text-muted">{t("settings.channel")}</span>
        <Segmented value={r.channel} onChange={(channel) => report({ channel })} options={(["whatsapp", "email", "both"] as const).map((id) => ({ id, label: t(`settings.channels.${id}`) }))} />
      </div>
      <div className="mt-4 space-y-3">
        {r.channel !== "whatsapp" && (
          <Field label={t("settings.reportEmail")}>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input key={`e-${r.email}`} type="email" dir="ltr" className="ps-10" defaultValue={r.email ?? ""} onBlur={(e) => report({ email: e.target.value.trim() || undefined })} />
            </div>
          </Field>
        )}
        {r.channel !== "email" && (
          <Field label={t("settings.reportWhatsapp")}>
            <div className="relative">
              <MessageCircle className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                key={`w-${r.whatsapp}`}
                type="tel"
                dir="ltr"
                inputMode="tel"
                className="ps-10"
                defaultValue={r.whatsapp ?? ""}
                onBlur={(e) => report({ whatsapp: e.target.value.replace(/[^\d]/g, "") || undefined })}
              />
            </div>
          </Field>
        )}
      </div>
      {accountEnabled && (
        <Button variant="soft" className="mt-4 w-full" icon={Send} disabled={busy} onClick={test}>
          {t("settings.reportTest")}
        </Button>
      )}
      {status && <p className={`mt-2 text-sm ${status.ok ? "text-success" : "text-danger"}`}>{status.text}</p>}
    </Card>
  );
}

function NumInput({ value, onSave, step }: { value: number; onSave: (v: number) => void; step?: string }) {
  return (
    <Input
      key={value}
      type="number"
      inputMode="decimal"
      step={step}
      defaultValue={value}
      className="num"
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && v >= 0 && v !== value) onSave(v);
      }}
    />
  );
}

function Backup() {
  const t = useTranslations("settings");
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doExport = async () => {
    const data = await exportAll(getDb());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lyaqa-backup-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMsg({ ok: true, text: t("exported") });
  };

  const doImport = async (file: File) => {
    try {
      let json: unknown;
      try {
        json = JSON.parse(await file.text());
      } catch {
        throw new Error("invalid");
      }
      const backup = validateBackup(json);
      if (!confirm(t("importConfirm", { n: backup.data.entries?.length ?? 0 }))) return;
      await importAll(getDb(), backup);
      setMsg({ ok: true, text: t("imported") });
    } catch (e) {
      const key = (e as Error).message as "invalid" | "notBackup" | "version";
      setMsg({ ok: false, text: t(`importErrors.${["invalid", "notBackup", "version"].includes(key) ? key : "invalid"}`) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardTitle icon={Download}>{t("backup")}</CardTitle>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="soft" icon={Download} onClick={doExport}>
          {t("export")}
        </Button>
        <Button variant="soft" icon={Upload} onClick={() => fileRef.current?.click()}>
          {t("import")}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label={t("import")} onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </Card>
  );
}
