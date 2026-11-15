"use client";

import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncStatus } from "@/lib/hooks";
import { syncManager } from "@/lib/sync-client";

/** أيقونة صغيرة توضح حالة المزامنة */
export function SyncBadge() {
  const t = useTranslations("sync");
  const s = useSyncStatus();
  if (s.state === "local") return null;
  const map = {
    idle: { Icon: Cloud, cls: "text-success", label: t("synced") },
    syncing: { Icon: RefreshCw, cls: "text-gold animate-spin", label: t("syncing") },
    offline: { Icon: CloudOff, cls: "text-muted", label: t("offline") },
    error: { Icon: TriangleAlert, cls: "text-danger", label: t("error") },
  }[s.state];
  return (
    <button
      type="button"
      onClick={() => syncManager.request(0)}
      title={map.label}
      aria-label={map.label}
      className="grid size-11 place-items-center rounded-full bg-card shadow-soft ring-1 ring-line"
    >
      <map.Icon className={`size-[18px] ${map.cls}`} />
    </button>
  );
}
