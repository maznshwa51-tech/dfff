// يشغله Vercel Cron (شوف vercel.json). يرسل التقرير اليومي لكل من حان وقته
import { adminClient } from "@/lib/server/auth";
import { serverReportDeps } from "@/lib/server/report-deps";
import { runDailyReports } from "@/lib/report-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!adminClient()) return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  const results = await runDailyReports(serverReportDeps());
  return Response.json({ sent: results.length, results: results.map((r) => ({ date: r.date, results: r.results })) });
}
