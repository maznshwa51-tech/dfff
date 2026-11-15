// منطق التقرير اليومي (بدون اعتماد مباشر على السيرفر عشان نقدر نختبره)

import { addDays, nowInZone, parseHHMM } from "./dates";
import { computeReportData, encouragementPrompt, fallbackEncouragement, reportLines, type ReportData } from "./report";
import { reportEmail } from "./report-email";
import type { RawData } from "./stats";
import { mergeSettings } from "./targets";
import type { Settings, WorkoutType } from "./types";

export interface ReportDeps {
  listSettings(): Promise<{ userId: string; settings: Partial<Settings> }[]>;
  loadData(userId: string, from: string, to: string): Promise<{ raw: RawData; types: WorkoutType[] }>;
  userEmail(userId: string): Promise<string | null>;
  alreadySent(userId: string, date: string): Promise<boolean>;
  markSent(userId: string, date: string, channels: string[]): Promise<void>;
  sendEmail(to: string, subject: string, html: string, text: string): Promise<void>;
  sendWhatsApp(to: string, params: string[], lang: string): Promise<void>;
  encourage(prompt: string): Promise<string | null>;
  appUrl?: string;
  now: Date;
  /** كم دقيقة قبل الوقت مسموح نرسل (Vercel المجاني ممكن يشغل المهمة بأي دقيقة داخل الساعة) */
  toleranceMinutes: number;
}

export function isDue(s: Settings, now: Date, toleranceMinutes: number): { due: boolean; date: string } {
  const { date, minutes } = nowInZone(s.report.timezone, now);
  return { due: s.report.enabled && minutes >= parseHHMM(s.report.time) - toleranceMinutes, date };
}

/** متغيرات قالب واتساب بالترتيب {{1}}..{{9}} */
export function whatsappParams(r: ReportData, locale: Settings["locale"], encouragement: string): string[] {
  const { title, lines } = reportLines(r, locale);
  const v = Object.fromEntries(lines.map((l) => [l.key, l.value]));
  return [title, v.kcal, v.protein, v.carbs, v.fat, v.steps, v.weight, v.workout, encouragement];
}

export interface SendResult {
  channel: "email" | "whatsapp";
  ok: boolean;
  error?: string;
}

export async function sendReportFor(deps: ReportDeps, userId: string, settingsRaw: Partial<Settings>, date: string): Promise<SendResult[]> {
  const s = mergeSettings(settingsRaw);
  const { raw, types } = await deps.loadData(userId, addDays(date, -7), date);
  const r = computeReportData(date, raw, s, types, s.locale);
  const enc = (await deps.encourage(encouragementPrompt(r, s.locale)).catch(() => null)) ?? fallbackEncouragement(s.locale, date + userId);
  const results: SendResult[] = [];
  const ch = s.report.channel;
  if (ch === "email" || ch === "both") {
    try {
      const to = s.report.email || (await deps.userEmail(userId));
      if (!to) throw new Error("no email address");
      const m = reportEmail(r, s.locale, enc, deps.appUrl);
      await deps.sendEmail(to, m.subject, m.html, m.text);
      results.push({ channel: "email", ok: true });
    } catch (e) {
      results.push({ channel: "email", ok: false, error: (e as Error).message });
    }
  }
  if (ch === "whatsapp" || ch === "both") {
    try {
      if (!s.report.whatsapp) throw new Error("no WhatsApp number in settings");
      await deps.sendWhatsApp(s.report.whatsapp, whatsappParams(r, s.locale, enc), s.locale);
      results.push({ channel: "whatsapp", ok: true });
    } catch (e) {
      results.push({ channel: "whatsapp", ok: false, error: (e as Error).message });
    }
  }
  return results;
}

/** يشتغل من الـ Cron: يرسل لكل مستخدم حان وقت تقريره وما انرسل له اليوم */
export async function runDailyReports(deps: ReportDeps) {
  const out: { userId: string; date: string; results: SendResult[] }[] = [];
  for (const { userId, settings } of await deps.listSettings()) {
    const s = mergeSettings(settings);
    const { due, date } = isDue(s, deps.now, deps.toleranceMinutes);
    if (!due || (await deps.alreadySent(userId, date))) continue;
    const results = await sendReportFor(deps, userId, settings, date);
    const okChannels = results.filter((x) => x.ok).map((x) => x.channel);
    if (okChannels.length) await deps.markSent(userId, date, okChannels);
    out.push({ userId, date, results });
  }
  return out;
}
