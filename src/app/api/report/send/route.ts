// "أرسل تقرير تجريبي الحين" من الإعدادات: يرسل تقرير اليوم لنفس المستخدم فقط
import { z } from "zod";
import { adminClient, requireUser } from "@/lib/server/auth";
import { serverReportDeps } from "@/lib/server/report-deps";
import { sendReportFor } from "@/lib/report-job";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user || user === "local") return Response.json({ error: "auth" }, { status: 401 });
  const sb = adminClient();
  if (!sb) return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid" }, { status: 400 });

  const { data } = await sb.from("records").select("data").eq("user_id", user.id).eq("table_name", "settings").eq("id", "settings").maybeSingle();
  const results = await sendReportFor(serverReportDeps(sb), user.id, (data?.data ?? {}) as Partial<Settings>, body.data.date);
  return Response.json({ results });
}
