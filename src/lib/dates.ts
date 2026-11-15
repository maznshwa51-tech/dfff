// كل التواريخ تُخزَّن كنص "YYYY-MM-DD" بالتوقيت المحلي للجهاز

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12); // الظهر لتجنب مشاكل التوقيت الصيفي
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** قائمة مفاتيح الأيام من (end - count + 1) إلى end */
export function lastNDays(end: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/** 0 = الأحد ... 6 = السبت */
export function weekday(key: string): number {
  return fromKey(key).getDay();
}

export const WEEKDAY_NAMES = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export function formatDay(key: string): string {
  const d = fromKey(key);
  return `${WEEKDAY_NAMES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function shortDay(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
