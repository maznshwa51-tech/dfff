import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportDeps } from "../report-job";
import type { DayTypeOverride, FoodEntry, Session, Settings, StepsEntry, WeightEntry, WorkoutType } from "../types";
import { adminClient } from "./auth";
import { encouragement } from "./gemini";
import { sendEmail, sendWhatsApp } from "./senders";

/** يجهز اعتمادات التقرير من Supabase (بصلاحية السيرفر) + Resend + واتساب + Gemini */
export function serverReportDeps(sb: SupabaseClient = adminClient()!): ReportDeps {
  return {
    now: new Date(),
    toleranceMinutes: Number(process.env.REPORT_TOLERANCE_MINUTES ?? 60),
    aiLimit: Number(process.env.REPORT_AI_LIMIT ?? 15),
    appUrl: process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
    async listSettings() {
      // المستخدمين اللي مفعّلين التقرير بس
      const { data, error } = await sb.from("records").select("user_id,data").eq("table_name", "settings").eq("deleted", false).eq("data->report->>enabled", "true").limit(5000);
      if (error) throw error;
      return (data ?? []).map((r) => ({ userId: r.user_id as string, settings: r.data as Partial<Settings> }));
    },
    async loadData(userId, from, to) {
      const [dated, typesRes] = await Promise.all([
        sb
          .from("records")
          .select("table_name,data")
          .eq("user_id", userId)
          .eq("deleted", false)
          .in("table_name", ["entries", "weights", "steps", "sessions", "dayTypes"])
          .gte("data->>date", from)
          .lte("data->>date", to)
          .limit(5000),
        sb.from("records").select("data").eq("user_id", userId).eq("deleted", false).eq("table_name", "workoutTypes"),
      ]);
      if (dated.error) throw dated.error;
      if (typesRes.error) throw typesRes.error;
      const rows = dated.data ?? [];
      const of = <T,>(t: string) => rows.filter((r) => r.table_name === t).map((r) => r.data as T);
      return {
        raw: {
          entries: of<FoodEntry>("entries"),
          weights: new Map(of<WeightEntry>("weights").map((w) => [w.date, w.kg])),
          steps: new Map(of<StepsEntry>("steps").map((s) => [s.date, s.count])),
          sessions: new Map(of<Session>("sessions").map((s) => [s.date, s])),
          overrides: new Map(of<DayTypeOverride>("dayTypes").map((o) => [o.date, o.type])),
        },
        types: (typesRes.data ?? []).map((r) => r.data as WorkoutType),
      };
    },
    async userEmail(userId) {
      const { data } = await sb.auth.admin.getUserById(userId);
      return data.user?.email ?? null;
    },
    async alreadySent(userId, date) {
      const { data } = await sb.from("report_log").select("date").eq("user_id", userId).eq("date", date).maybeSingle();
      return !!data;
    },
    async markSent(userId, date, channels) {
      await sb.from("report_log").upsert({ user_id: userId, date, channels: channels.join(","), sent_at: new Date().toISOString() });
    },
    sendEmail,
    sendWhatsApp,
    encourage: encouragement,
  };
}
