// قراءة صورة ملصق القيم الغذائية بـ Gemini (على السيرفر فقط)
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { GeminiError, readLabel } from "@/lib/server/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  data: z.string().min(100),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
});
const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "no_key" }, { status: 503 });
  const user = await requireUser(req);
  if (!user) return Response.json({ error: "auth" }, { status: 401 });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "invalid" }, { status: 400 });
  if ((body.data.data.length * 3) / 4 > MAX_BYTES) return Response.json({ error: "too_large" }, { status: 413 });

  try {
    // نرسل الصورة فقط، بدون أي معلومات شخصية
    const result = await readLabel(body.data);
    return Response.json(result);
  } catch (e) {
    const err = e instanceof GeminiError ? e : new GeminiError("upstream", 502);
    return Response.json({ error: err.code }, { status: err.status });
  }
}
