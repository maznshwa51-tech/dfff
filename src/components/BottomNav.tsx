"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "اليوم", icon: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/food", label: "الأكل", icon: "M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10m10-18c-2 0-3 3-3 6s1 4 3 4v8" },
  { href: "/activity", label: "النشاط", icon: "M13 4a2 2 0 1 0 0 .01M8 21l3-6 3 3v3m-6-9 3-3 3 2 3 1M6 12l2-4h4" },
  { href: "/weight", label: "الوزن", icon: "M5 7h14l-1.5 12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2zM9 7a3 3 0 0 1 6 0m-3 4v3" },
  { href: "/stats", label: "الإحصائيات", icon: "M4 20V10m6 10V4m6 16v-7m4 7H2" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand" : "text-muted"}`}
                aria-current={active ? "page" : undefined}
              >
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
