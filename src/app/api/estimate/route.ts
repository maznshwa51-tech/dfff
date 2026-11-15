// يقدّر القيم الغذائية لأكلة مش موجودة في القاعدة المحلية.
// يشتغل على السيرفر فقط، والمفتاح يُقرأ من .env.local ولا يوصل للمتصفح.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Nutrition = z.object({
  name_ar: z.string().describe("اسم الأكلة بالعربي بشكل واضح ومختصر"),
  kcal_per_100g: z.number(),
  protein_per_100g: z.number(),
  carbs_per_100g: z.number(),
  fat_per_100g: z.number(),
  typical_serving_grams: z.number().describe("وزن حصة شائعة بالغرام"),
  typical_serving_label_ar: z.string().describe("وصف الحصة بالعربي، مثل: صحن، رغيف، حبة"),
  confidence: z.enum(["high", "medium", "low"]),
  is_food: z.boolean().describe("false إذا النص ما يوصف أكلة أو مشروب"),
});

const Body = z.object({ name: z.string().trim().min(1).max(120) });

const SYSTEM = `أنت خبير تغذية. المستخدم يعطيك اسم أكلة أو مشروب (غالباً بالعربي، وقد تكون أكلة خليجية أو شامية أو مصرية).
أرجع القيم الغذائية التقريبية لكل 100 غرام من الأكلة كما تؤكل عادة (مطبوخة إذا كانت تُطبخ)، بناءً على جداول تغذية معروفة مثل USDA.
تأكد أن السعرات ≈ بروتين×4 + كربوهيدرات×4 + دهون×9.
إذا الأكلة طبق مركّب (مثل كبسة أو شاورما)، قدّر حسب الوصفة الشائعة.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "مفتاح ANTHROPIC_API_KEY مش موجود في .env.local على السيرفر" },
      { status: 500 },
    );
  }
  const parsedBody = Body.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) {
    return Response.json({ error: "اكتب اسم الأكلة" }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Nutrition) },
      system: SYSTEM,
      messages: [{ role: "user", content: `الأكلة: ${parsedBody.data.name}` }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "ما قدر Claude يجاوب على هذا الطلب" }, { status: 422 });
    }
    const out = response.parsed_output;
    if (!out) {
      return Response.json({ error: "الرد ما كان بالشكل المتوقع، جرّب مرة ثانية" }, { status: 502 });
    }
    if (!out.is_food) {
      return Response.json({ error: "هذا ما يبدو اسم أكلة" }, { status: 422 });
    }
    const clamp = (n: number, max: number) => Math.min(Math.max(Math.round(n * 10) / 10, 0), max);
    return Response.json({
      name: out.name_ar,
      kcal: Math.round(clamp(out.kcal_per_100g, 900)),
      protein: clamp(out.protein_per_100g, 100),
      carbs: clamp(out.carbs_per_100g, 100),
      fat: clamp(out.fat_per_100g, 100),
      serving: { grams: Math.round(clamp(out.typical_serving_grams, 2000)) || 100, label: out.typical_serving_label_ar },
      confidence: out.confidence,
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "مفتاح API غير صحيح" }, { status: 401 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "طلبات كثيرة، استنى دقيقة وجرّب" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return Response.json({ error: "ما قدرت أتصل بـ Claude. تأكد من الإنترنت" }, { status: 503 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `خطأ من Claude (${error.status ?? "?"})` }, { status: 502 });
    }
    console.error(error);
    return Response.json({ error: "صار خطأ غير متوقع" }, { status: 500 });
  }
}
