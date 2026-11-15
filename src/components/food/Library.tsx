"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, Empty, Field, IconButton, Input, Sheet, fmt } from "@/components/ui";
import { getDb } from "@/lib/db";
import { foodName, useCategories, useCategoryName, useSettings } from "@/lib/hooks";
import { uid } from "@/lib/ids";
import { putRow, putRows, removeRow } from "@/lib/repo";
import type { Category, Food } from "@/lib/types";
import { AddFoodSheet } from "./AddFoodSheet";
import { draftFrom, FoodForm } from "./FoodForm";

/** مكتبتي: الأصناف وتحت كل صنف الأكلات بقيمي أنا */
export function Library() {
  const t = useTranslations();
  const locale = useLocale();
  const settings = useSettings();
  const cats = useCategories();
  const catName = useCategoryName();
  const foods = useLiveQuery(() => getDb().foods.orderBy("name").toArray(), []);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<Food | null>(null);
  const [catSheet, setCatSheet] = useState<Category | "new" | null>(null);

  if (!cats || !foods || !settings) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Button icon={Plus} onClick={() => setAddTo(openCat ?? "cat-snacks")}>
          {t("library.addFood")}
        </Button>
        <Button variant="soft" icon={FolderPlus} onClick={() => setCatSheet("new")}>
          {t("library.addCategory")}
        </Button>
      </div>

      {cats.map((c) => {
        const list = foods.filter((f) => f.categoryId === c.id);
        const isOpen = openCat === c.id;
        return (
          <section key={c.id} className="overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-line">
            <div className="flex items-center gap-2 p-2 ps-4">
              <button className="flex min-h-12 flex-1 items-center gap-3 text-start" onClick={() => setOpenCat(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <span className="flex-1 font-semibold">{catName(c)}</span>
                <span className="num text-xs text-muted">{t("library.count", { n: list.length })}</span>
                <ChevronDown className={`size-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <IconButton icon={Pencil} label={t("library.renameCategory")} onClick={() => setCatSheet(c)} />
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="border-t border-line px-4 pb-3">
                    {list.length === 0 ? (
                      <Empty>{t("library.empty")}</Empty>
                    ) : (
                      <ul className="divide-y divide-line">
                        {list.map((f) => (
                          <li key={f.id} className="flex items-center gap-2 py-3">
                            <button className="min-w-0 flex-1 text-start" onClick={() => setEditing(f)}>
                              <div className="truncate font-medium">
                                {foodName(f, locale)}
                                {f.brand && <span className="text-sm font-normal text-muted"> · {f.brand}</span>}
                              </div>
                              <div className="num text-xs text-muted">
                                {fmt(f.refAmount)} {t(`common.units.${f.unit}`)}: {fmt(f.kcal)} {t("common.kcal")} · {t("common.protein")} {fmt(f.protein, 1)} · {t("common.carbs")} {fmt(f.carbs, 1)} · {t("common.fat")} {fmt(f.fat, 1)}
                              </div>
                            </button>
                            <IconButton
                              icon={Trash2}
                              label={`${t("common.delete")} ${foodName(f, locale)}`}
                              onClick={() => confirm(t("library.deleteFoodConfirm", { name: foodName(f, locale) })) && removeRow("foods", f.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    <button className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-gold" onClick={() => setAddTo(c.id)}>
                      <Plus className="size-4" /> {t("library.addFood")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}

      <AddFoodSheet
        open={addTo != null}
        onClose={() => setAddTo(null)}
        categoryId={addTo ?? undefined}
        defaultUnit={settings.defaultUnit}
        onSaved={(f) => {
          setAddTo(null);
          setOpenCat(f.categoryId);
        }}
      />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={t("library.editFood")}>
        {editing && <FoodForm key={editing.id} existing={editing} initial={draftFrom(editing, { categoryId: editing.categoryId, unit: editing.unit })} onSaved={() => setEditing(null)} />}
      </Sheet>

      <CategorySheet value={catSheet} onClose={() => setCatSheet(null)} count={cats.length} foods={foods} />
    </div>
  );
}

function CategorySheet({ value, onClose, count, foods }: { value: Category | "new" | null; onClose: () => void; count: number; foods: Food[] }) {
  const t = useTranslations();
  const catName = useCategoryName();
  const [name, setName] = useState("");
  const [last, setLast] = useState<Category | "new" | null>(null);
  if (value !== last) {
    setLast(value);
    setName(value && value !== "new" ? catName(value) : "");
  }
  const save = async () => {
    const n = name.trim();
    if (!n) return;
    if (value === "new") await putRow<Category>("categories", { id: uid(), name: n, order: count + 1 });
    else if (value && n !== catName(value)) await putRow<Category>("categories", { ...value, name: n, key: undefined });
    onClose();
  };
  const del = async () => {
    if (!value || value === "new") return;
    if (!confirm(t("library.deleteCategoryConfirm", { name: catName(value) }))) return;
    const moved = foods.filter((f) => f.categoryId === value.id).map((f) => ({ ...f, categoryId: "cat-snacks" }));
    await putRows("foods", moved);
    await removeRow("categories", value.id);
    onClose();
  };
  return (
    <Sheet open={value != null} onClose={onClose} title={value === "new" ? t("library.addCategory") : t("library.renameCategory")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label={t("library.categoryName")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>
        <Button type="submit" className="w-full" disabled={!name.trim()}>
          {t("common.save")}
        </Button>
        {value && value !== "new" && value.id !== "cat-snacks" && (
          <Button type="button" variant="danger" icon={Trash2} className="w-full" onClick={del}>
            {t("library.deleteCategory")}
          </Button>
        )}
      </form>
    </Sheet>
  );
}
