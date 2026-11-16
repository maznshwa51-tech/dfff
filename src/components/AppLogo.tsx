"use client";

import { Activity } from "lucide-react";

/** شعار التطبيق (ثابت). لونه يتبع ثيم الألوان اللي تختاره من الإعدادات */
export function AppLogo({ size = 44, className = "" }: { size?: number; className?: string }) {
  const radius = Math.round(size * 0.28);
  return (
    <span className={`grid shrink-0 place-items-center bg-gold text-gold-ink shadow-soft ${className}`} style={{ width: size, height: size, borderRadius: radius }} aria-hidden>
      <Activity style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.4} />
    </span>
  );
}
