"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { getDb } from "@/lib/db";
import { saveSettings } from "@/lib/hooks";
import { uid } from "@/lib/ids";
import { putRow, removeRow } from "@/lib/repo";
import type { Logo } from "@/lib/types";
import { AppLogo, prepareLogo } from "./AppLogo";
import { Button, Card, CardTitle, IconButton } from "./ui";

const MAX_LOGOS = 12;

/** شعار التطبيق: ترفع شعارات، كلها تنحفظ، وتختار واحد منها */
export function LogoPicker({ activeId }: { activeId?: string }) {
  const t = useTranslations("logo");
  const logos = useLiveQuery(() => getDb().logos.orderBy("createdAt").toArray(), []) ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = logos.find((l) => l.id === activeId)?.id ?? null;

  const upload = async (file: File) => {
    setError(null);
    if (logos.length >= MAX_LOGOS) return setError(t("limit"));
    setBusy(true);
    try {
      const logo: Logo = { id: uid(), dataUrl: await prepareLogo(file), createdAt: Date.now() };
      await putRow("logos", logo);
      await saveSettings({ logoId: logo.id });
    } catch {
      setError(t("invalid"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (l: Logo) => {
    if (!confirm(t("deleteConfirm"))) return;
    if (l.id === active) await saveSettings({ logoId: undefined });
    await removeRow("logos", l.id);
  };

  return (
    <Card>
      <CardTitle icon={ImageIcon}>{t("title")}</CardTitle>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6" role="radiogroup" aria-label={t("title")}>
        <Choice selected={!active} label={t("default")} onSelect={() => saveSettings({ logoId: undefined })}>
          <AppLogo size={56} logo={null} />
        </Choice>
        {logos.map((l, i) => (
          <div key={l.id} className="relative">
            <Choice selected={l.id === active} label={`${t("use")} ${i + 1}`} onSelect={() => saveSettings({ logoId: l.id })}>
              <AppLogo size={56} logo={l} />
            </Choice>
            <IconButton icon={Trash2} label={`${t("delete")} ${i + 1}`} onClick={() => remove(l)} className="absolute -end-1 -top-1 !size-7 bg-card shadow-soft ring-1 ring-line" />
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden aria-label={t("upload")} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <Button variant="soft" icon={Upload} className="mt-4 w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
        {t("upload")}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted">{t("hint")}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{t("homeNote")}</p>
    </Card>
  );
}

function Choice({ selected, label, onSelect, children }: { selected: boolean; label: string; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={`relative grid aspect-square w-full place-items-center rounded-2xl p-1.5 transition ${selected ? "bg-gold/15 ring-2 ring-gold" : "bg-card2 ring-1 ring-line"}`}
    >
      {children}
      {selected && (
        <span className="absolute inset-x-0 -bottom-1.5 mx-auto grid size-5 place-items-center rounded-full bg-gold text-gold-ink">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
