"use client";

import { Camera, LoaderCircle, PencilLine, ScanLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button, Sheet } from "@/components/ui";
import type { LabelErrorCode, LabelResult } from "@/lib/label";
import { authHeader } from "@/lib/supabase";
import type { Food, Unit } from "@/lib/types";
import { draftFrom, FoodForm, type FoodDraft } from "./FoodForm";

type Step = { kind: "choose" } | { kind: "scan"; busy: boolean; error?: string } | { kind: "form"; draft: FoodDraft; fromScan: boolean };

/** يصغّر الصورة ويحولها JPEG (يشيل بيانات الموقع EXIF، ويقلل الحجم) */
async function prepareImage(file: File): Promise<{ data: string; mimeType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { data: dataUrl.split(",")[1], mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const ERR_KEY: Record<LabelErrorCode | "offline", string> = {
  no_key: "noKey",
  rate_limit: "rateLimit",
  busy: "busy",
  not_label: "notLabel",
  too_large: "tooLarge",
  auth: "auth",
  invalid: "generic",
  upstream: "generic",
  offline: "offline",
};

/**
 * إضافة أكلة جديدة لمكتبتي: خيارين بس
 * أ) إدخال يدوي (بدون إنترنت)  ب) تصوير الملصق (Gemini يعبّي الحقول وأنت تراجع)
 */
export function AddFoodSheet({
  open,
  onClose,
  initialName,
  categoryId,
  defaultUnit,
  onSaved,
  allowLog,
}: {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  categoryId?: string;
  defaultUnit: Unit;
  onSaved: (food: Food, andLog: boolean) => void;
  allowLog?: boolean;
}) {
  const t = useTranslations();
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const fileRef = useRef<HTMLInputElement>(null);
  const defaults = { categoryId: categoryId ?? "cat-snacks", unit: defaultUnit };

  useEffect(() => {
    if (open) setStep({ kind: "choose" });
  }, [open]);

  const manual = (prefill?: Partial<Food>) => setStep({ kind: "form", draft: draftFrom({ name: initialName, ...prefill }, defaults), fromScan: !!prefill });

  const onFile = async (file: File) => {
    setStep({ kind: "scan", busy: true });
    try {
      if (!navigator.onLine) throw Object.assign(new Error(), { code: "offline" });
      const img = await prepareImage(file);
      const res = await fetch("/api/label", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(img),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(), { code: (body.error as LabelErrorCode) ?? "upstream" });
      const r = body as LabelResult;
      setStep({
        kind: "form",
        fromScan: true,
        draft: draftFrom(
          { name: r.name || initialName, refAmount: r.reference_amount, unit: r.unit, kcal: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat },
          defaults,
        ),
      });
    } catch (e) {
      const code = (e as { code?: string }).code ?? (navigator.onLine ? "upstream" : "offline");
      setStep({ kind: "scan", busy: false, error: t(`library.errors.${ERR_KEY[code as LabelErrorCode] ?? "generic"}` as "library.errors.generic") });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const title = step.kind === "scan" ? t("library.scanTitle") : t("library.newFood");

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {step.kind === "choose" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t("library.chooseMethod")}</p>
          <MethodButton icon={PencilLine} title={t("library.manual")} desc={t("library.manualDesc")} onClick={() => manual()} />
          <MethodButton icon={ScanLine} title={t("library.scan")} desc={t("library.scanDesc")} onClick={() => setStep({ kind: "scan", busy: false })} />
        </div>
      )}

      {step.kind === "scan" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">{t("library.scanHint")}</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden aria-label={t("library.takePhoto")} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {step.busy ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted">
              <LoaderCircle className="size-8 animate-spin text-gold" />
              {t("library.analyzing")}
            </div>
          ) : (
            <Button className="w-full" icon={Camera} onClick={() => fileRef.current?.click()}>
              {t("library.takePhoto")}
            </Button>
          )}
          {step.error && (
            <div role="alert" className="space-y-3 rounded-2xl bg-danger/10 p-4">
              <p className="text-sm text-danger">{step.error}</p>
              <Button variant="soft" className="w-full" icon={PencilLine} onClick={() => manual()}>
                {t("library.manual")}
              </Button>
            </div>
          )}
        </div>
      )}

      {step.kind === "form" && (
        <div className="space-y-4">
          {step.fromScan && <p className="rounded-2xl bg-gold/10 px-4 py-3 text-sm font-medium text-gold">{t("library.review")}</p>}
          <FoodForm
            initial={step.draft}
            onSaved={onSaved}
            submitLabels={allowLog ? { log: t("library.saveAndLog"), save: t("library.saveOnly") } : { save: t("library.saveOnly") }}
          />
        </div>
      )}
    </Sheet>
  );
}

function MethodButton({ icon: Icon, title, desc, onClick }: { icon: typeof Camera; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-3xl bg-card p-4 text-start shadow-soft ring-1 ring-line transition active:scale-[0.98]">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold">
        <Icon className="size-6" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{desc}</span>
      </span>
    </button>
  );
}
