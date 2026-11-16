"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { hardReload } from "@/lib/recover";

/** بدل صفحة فاضية: شكل تحميل، وإذا طوّل أكثر من 8 ثواني نعرض زر إعادة تحميل */
export function PageLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="space-y-4 pt-3" aria-busy="true">
      <div className="h-10 w-40 animate-pulse rounded-2xl bg-card" />
      <div className="h-44 animate-pulse rounded-3xl bg-card" />
      <div className="h-56 animate-pulse rounded-3xl bg-card" />
      {slow && <SlowNotice />}
    </div>
  );
}

export function SlowNotice() {
  const t = useTranslations("recover");
  return (
    <div role="alert" className="space-y-3 rounded-3xl bg-gold/10 p-4 text-sm ring-1 ring-gold/25">
      <p className="font-semibold">{t("slowTitle")}</p>
      <p className="leading-relaxed text-muted">{t("slowBody")}</p>
      <button onClick={hardReload} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 font-semibold text-gold-ink">
        <RotateCw className="size-4" /> {t("reload")}
      </button>
    </div>
  );
}
