"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Button, Card, CardTitle, Field, Input, PageHeader, Segmented } from "@/components/ui";
import { exportAll, importAll, validateBackup } from "@/lib/backup";
import { WEEKDAY_NAMES, todayKey } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { saveSettings, useSettings } from "@/lib/hooks";
import { computeTargets, type Settings } from "@/lib/targets";

// ترتيب الأسبوع يبدأ بالسبت
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export default function SettingsPage() {
  const s = useSettings();
  const types = useLiveQuery(() => getDb().workoutTypes.toArray(), []) ?? [];
  if (!s) return null;

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const tr = computeTargets("training", s);
  const rest = computeTargets("rest", s);

  return (
    <>
      <PageHeader title="الإعدادات" />
      <div className="space-y-4">
        <Card>
          <CardTitle>الملف الشخصي</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            <Field label="العمر">
              <NumInput value={s.profile.age} onSave={(v) => saveSettings({ profile: { ...s.profile, age: v } })} />
            </Field>
            <Field label="الطول (سم)">
              <NumInput value={s.profile.heightCm} onSave={(v) => saveSettings({ profile: { ...s.profile, heightCm: v } })} />
            </Field>
            <Field label="الوزن عند البداية (كغ)">
              <NumInput value={s.profile.startWeightKg} onSave={(v) => saveSettings({ profile: { ...s.profile, startWeightKg: v } })} />
            </Field>
            <Field label="الرياضة">
              <Input defaultValue={s.profile.sport} onBlur={(e) => saveSettings({ profile: { ...s.profile, sport: e.target.value } })} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>جدول التمرين الثابت</CardTitle>
          <p className="mb-3 text-xs text-muted">الأيام اللي فيها تمرين تنحسب &quot;يوم تمرين&quot; تلقائياً. تقدر تغيّر أي يوم يدوياً من الشاشة الرئيسية أو صفحة النشاط.</p>
          <ul className="divide-y divide-line">
            {WEEK_ORDER.map((d) => (
              <li key={d} className="flex items-center justify-between py-2">
                <span className="font-medium">{WEEKDAY_NAMES[d]}</span>
                <select
                  aria-label={`تمرين ${WEEKDAY_NAMES[d]}`}
                  value={s.schedule[d] ?? ""}
                  onChange={(e) => {
                    const schedule = { ...s.schedule };
                    if (e.target.value) schedule[d] = e.target.value;
                    else delete schedule[d];
                    saveSettings({ schedule });
                  }}
                  className="min-h-10 rounded-xl bg-field px-3 text-sm ring-1 ring-line"
                >
                  <option value="">راحة</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>الأهداف اليومية</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            <Field label="سعرات يوم التمرين">
              <NumInput value={s.kcalTraining} onSave={(v) => saveSettings({ kcalTraining: v })} />
            </Field>
            <Field label="سعرات يوم الراحة">
              <NumInput value={s.kcalRest} onSave={(v) => saveSettings({ kcalRest: v })} />
            </Field>
            <Field label="البروتين (غ) كل يوم">
              <NumInput value={s.proteinG} onSave={(v) => saveSettings({ proteinG: v })} />
            </Field>
            <Field label="الدهون (% من السعرات)">
              <NumInput value={Math.round(s.fatPct * 100)} onSave={(v) => saveSettings({ fatPct: Math.min(60, Math.max(10, v)) / 100 })} />
            </Field>
          </div>
          <table className="mt-3 w-full text-center text-sm tabular-nums">
            <thead className="text-xs text-muted">
              <tr>
                <th></th>
                <th className="font-medium">سعرات</th>
                <th className="font-medium">بروتين</th>
                <th className="font-medium">كارب</th>
                <th className="font-medium">دهون</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 text-start">تمرين</td>
                <td>{tr.kcal}</td>
                <td>{tr.protein} غ</td>
                <td>{tr.carbs} غ</td>
                <td>{tr.fat} غ</td>
              </tr>
              <tr>
                <td className="py-1 text-start">راحة</td>
                <td>{rest.kcal}</td>
                <td>{rest.protein} غ</td>
                <td>{rest.carbs} غ</td>
                <td>{rest.fat} غ</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">الكربوهيدرات = الباقي بعد البروتين (4 سعرات/غ) والدهون (9 سعرات/غ).</p>
          <div className="mt-3">
            <Field label="هدف الخطوات اليومي">
              <NumInput value={s.stepsGoal} onSave={(v) => saveSettings({ stepsGoal: v })} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>التنبيهات الصحية</CardTitle>
          <div className="grid grid-cols-3 gap-2">
            <Field label="سعرات أقل من">
              <NumInput value={s.lowKcalAlert} onSave={(v) => saveSettings({ lowKcalAlert: v })} />
            </Field>
            <Field label="بروتين أقل من (غ)">
              <NumInput value={s.lowProteinAlert} onSave={(v) => saveSettings({ lowProteinAlert: v })} />
            </Field>
            <Field label="نزول بالأسبوع (كغ)">
              <NumInput value={s.weeklyLossAlertKg} step="0.1" onSave={(v) => saveSettings({ weeklyLossAlertKg: v })} />
            </Field>
          </div>
          {Math.min(s.kcalRest, s.kcalTraining) < s.lowKcalAlert && (
            <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed ring-1 ring-amber-500/30">
              ⚠️ هدف السعرات ({Math.min(s.kcalRest, s.kcalTraining)}) أقل من حد التنبيه ({s.lowKcalAlert}). يعني لو أكلت حسب الهدف بالضبط بيطلع لك تنبيه إن أكلك قليل. لرياضي بعمرك يكبر، يُفضّل تراجع الأهداف مع طبيب أو أخصائي تغذية.
            </p>
          )}
        </Card>

        <Card>
          <CardTitle>المظهر</CardTitle>
          <Segmented<Settings["theme"]>
            value={s.theme}
            onChange={(theme) => saveSettings({ theme })}
            options={[
              { id: "system", label: "حسب الجهاز" },
              { id: "light", label: "فاتح" },
              { id: "dark", label: "داكن" },
            ]}
          />
        </Card>

        <Backup />

        <p className="pb-4 text-center text-xs text-muted">كل بياناتك محفوظة على هذا الجهاز فقط. خذ نسخة احتياطية كل فترة.</p>
      </div>
    </>
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
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && v >= 0 && v !== value) onSave(v);
      }}
    />
  );
}

function Backup() {
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
    setMsg({ ok: true, text: "تم تصدير النسخة الاحتياطية ✓" });
  };

  const doImport = async (file: File) => {
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      const n = backup.data.entries?.length ?? 0;
      if (!confirm(`الاستيراد بيستبدل كل بياناتك الحالية بمحتوى الملف (${n} أكلة مسجلة). متأكد؟`)) return;
      await importAll(getDb(), backup);
      setMsg({ ok: true, text: "تم الاستيراد ✓" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof SyntaxError ? "الملف مش JSON صالح" : (e as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardTitle>النسخ الاحتياطي</CardTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="soft" onClick={doExport}>
          ⬇ تصدير JSON
        </Button>
        <Button variant="soft" onClick={() => fileRef.current?.click()}>
          ⬆ استيراد JSON
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="ملف النسخة الاحتياطية" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-brand" : "text-red-600 dark:text-red-400"}`}>{msg.text}</p>}
    </Card>
  );
}
