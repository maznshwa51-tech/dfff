// تقدير البروتين والكارب والدهون للسعرات السريعة (Gemini، على السيرفر فقط)
import { requireUser } from "@/lib/server/auth";
import { estimateQuick, GeminiError } from "@/lib/server/gemini";
import { QuickRequest } from "@/lib/quick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "no_key" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const body = QuickRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid" }, { status: 400 });
  try {
    return Response.json(await estimateQuick(body.data));
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError("upstream", 502);
    return Response.json({ error: err.code }, { status: err.status });
  }
}
