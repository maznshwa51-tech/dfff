"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Activity } from "lucide-react";
import { useEffect } from "react";
import { getDb } from "@/lib/db";
import type { Logo } from "@/lib/types";

/** الشعار المستخدم حالياً (أو null = الافتراضي) */
export function useActiveLogo(): Logo | null | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const s = await db.settings.get("settings");
    if (!s?.logoId) return null;
    return (await db.logos.get(s.logoId)) ?? null;
  }, []);
}

export function AppLogo({ size = 44, logo, className = "" }: { size?: number; logo?: Logo | null; className?: string }) {
  const active = useActiveLogo();
  const l = logo === undefined ? active : logo;
  const radius = Math.round(size * 0.28);
  if (l) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={l.dataUrl} alt="" width={size} height={size} className={`shrink-0 object-cover shadow-soft ${className}`} style={{ width: size, height: size, borderRadius: radius }} />;
  }
  return (
    <span className={`grid shrink-0 place-items-center bg-gold text-gold-ink shadow-soft ${className}`} style={{ width: size, height: size, borderRadius: radius }} aria-hidden>
      <Activity style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.4} />
    </span>
  );
}

/** يغيّر أيقونة المتصفح وأيقونة الشاشة الرئيسية بالآيفون/الآيباد للشعار المختار */
export function LogoIcons() {
  const logo = useActiveLogo();
  useEffect(() => {
    if (logo === undefined) return;
    const links = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]');
    links.forEach((link) => {
      if (!link.dataset.defaultHref) link.dataset.defaultHref = link.href;
      link.href = logo ? logo.dataUrl : link.dataset.defaultHref;
    });
  }, [logo]);
  return null;
}

/** يقص الصورة مربع من الوسط ويصغرها (PNG، وإذا كبرت JPEG) */
export async function prepareLogo(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("empty");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    let data = canvas.toDataURL("image/png");
    if (data.length > 300_000) {
      // صورة فيها تفاصيل كثيرة: JPEG بخلفية بيضاء
      const bg = document.createElement("canvas");
      bg.width = bg.height = size;
      const b = bg.getContext("2d")!;
      b.fillStyle = "#ffffff";
      b.fillRect(0, 0, size, size);
      b.drawImage(canvas, 0, 0);
      data = bg.toDataURL("image/jpeg", 0.9);
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
