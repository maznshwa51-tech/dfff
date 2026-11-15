// كل التواريخ تُخزَّن كنص "YYYY-MM-DD" بالتوقيت المحلي

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

/** مفاتيح الأيام من (end - count + 1) إلى end */
export function lastNDays(end: string, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/** 0 = الأحد ... 6 = السبت */
export function weekday(key: string): number {
  return fromKey(key).getDay();
}

export function shortDay(key: string): string {
  const d = fromKey(key);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** التاريخ والوقت الحالي في منطقة زمنية معينة (للتقرير على السيرفر) */
export function nowInZone(timeZone: string, now = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return 21 * 60 + 30;
  return Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]));
}
