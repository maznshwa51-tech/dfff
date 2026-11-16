"use client";

import { RotateCw } from "lucide-react";
import { useEffect } from "react";
import { hardReload } from "@/lib/recover";

// لو صار خطأ في أي صفحة: بدل صفحة بيضاء، رسالة وزر إعادة تحميل (بياناتك محفوظة)
export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    // ملفات نسخة قديمة بعد تحديث ← نعيد التحميل تلقائياً مرة وحدة
    if (/Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message)) {
      try {
        if (!sessionStorage.getItem("lyaqa-chunk-reload")) {
          sessionStorage.setItem("lyaqa-chunk-reload", "1");
          void hardReload();
        }
      } catch {}
    }
  }, [error]);
  const ar = typeof document === "undefined" || document.documentElement.lang !== "en";
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-xl font-bold">{ar ? "صار خطأ بسيط" : "Something went wrong"}</p>
      <p className="max-w-xs text-sm text-muted">{ar ? "بياناتك محفوظة. اضغط إعادة التحميل." : "Your data is safe. Tap reload."}</p>
      <button onClick={hardReload} className="flex items-center gap-2 rounded-2xl bg-gold px-6 py-3 font-semibold text-gold-ink">
        <RotateCw className="size-4" /> {ar ? "إعادة التحميل" : "Reload"}
      </button>
    </div>
  );
}
