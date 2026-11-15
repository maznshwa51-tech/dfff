"use client";

import { motion } from "framer-motion";
import { ChartColumnBig, Dumbbell, House, Scale, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const ITEMS = [
  { href: "/", key: "today", Icon: House },
  { href: "/food", key: "food", Icon: UtensilsCrossed },
  { href: "/training", key: "training", Icon: Dumbbell },
  { href: "/weight", key: "weight", Icon: Scale },
  { href: "/stats", key: "stats", Icon: ChartColumnBig },
] as const;

export function BottomNav() {
  const path = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:bottom-4 md:px-0">
      <ul className="mx-auto flex max-w-xl rounded-[26px] bg-card/85 p-1.5 shadow-soft ring-1 ring-line backdrop-blur-xl md:max-w-md">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] font-semibold transition-colors ${active ? "text-gold" : "text-muted"}`}
              >
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-[20px] bg-gold/12" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <Icon className="relative size-[22px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                <span className="relative">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
