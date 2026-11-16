// ملف تعريف التطبيق (PWA). الأيقونة حسب ثيم الألوان اللي اخترته: /manifest.webmanifest?accent=ocean
import { ACCENTS, type Accent } from "@/lib/types";

export function GET(req: Request) {
  const a = new URL(req.url).searchParams.get("accent") as Accent | null;
  const accent: Accent = a && ACCENTS.includes(a) ? a : "gold";
  const icon = (name: string) => `/icons/${accent}/${name}`;
  const manifest = {
    id: "/", // نفس التطبيق مهما تغير الثيم (يتحدث بدل ما ينثبت تطبيق جديد)
    name: "لياقتي",
    short_name: "لياقتي",
    description: "سجل الأكل والوزن والخطوات والتمارين",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // نفس لون خلفية التطبيق (عشان شريط الجوال تحت وفوق ما يطلع بلون غريب)
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: icon("icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: icon("icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: icon("icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
