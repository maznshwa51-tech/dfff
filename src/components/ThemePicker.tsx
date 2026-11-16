"use client";

import { Check, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { saveSettings } from "@/lib/hooks";
import { ACCENTS, type Accent } from "@/lib/types";
import { AppLogo } from "./AppLogo";
import { Card, CardTitle } from "./ui";

/** ثيمات الألوان: الشعار ثابت، واللون الرئيسي يتغير */
export function ThemePicker({ value }: { value: Accent }) {
  const t = useTranslations("accent");
  return (
    <Card>
      <CardTitle icon={Palette}>{t("title")}</CardTitle>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6" role="radiogroup" aria-label={t("title")}>
        {ACCENTS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={value === a}
            aria-label={t(a)}
            onClick={() => saveSettings({ accent: a })}
            data-accent={a}
            className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 transition ${value === a ? "bg-gold/12 ring-2 ring-gold" : "bg-card2 ring-1 ring-line"}`}
          >
            <AppLogo size={44} />
            <span className="text-xs font-semibold">{t(a)}</span>
            {value === a && (
              <span className="absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-gold text-gold-ink">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{t("hint")}</p>
    </Card>
  );
}
