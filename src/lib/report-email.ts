// قالب HTML أنيق للتقرير اليومي (بنفس ألوان التطبيق). جداول وألوان inline عشان يطلع صح في كل برامج الإيميل
import { reportLines, type ReportData } from "./report";
import type { Locale } from "./types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function reportEmail(r: ReportData, locale: Locale, encouragement: string, appUrl?: string): { subject: string; html: string; text: string } {
  const { title, lines } = reportLines(r, locale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const align = locale === "ar" ? "right" : "left";
  const opp = locale === "ar" ? "left" : "right";
  const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const bar = (p: number, color: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px"><tr><td style="background:#26262b;border-radius:6px;height:6px;line-height:6px;font-size:0"><div style="width:${p}%;background:${color};height:6px;border-radius:6px"></div></td></tr></table>`;
  const bars: Record<string, string> = {
    kcal: bar(pct(r.kcal, r.kcalTarget), "#e6e3dc"),
    protein: bar(pct(r.protein, r.proteinTarget), "#d4af6a"),
    carbs: bar(pct(r.carbs, r.carbsTarget), "#3f8fd6"),
    fat: bar(pct(r.fat, r.fatTarget), "#d9667c"),
    steps: r.steps == null ? "" : bar(pct(r.steps, r.stepsGoal), "#34c77b"),
  };
  const rows = lines
    .map(
      (l) => `<tr><td style="padding:14px 18px;border-top:1px solid #222226">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:15px;color:#8d8c93;text-align:${align}">${l.icon}&nbsp; ${esc(l.label)}</td>
    <td style="font-size:16px;font-weight:700;color:${l.ok === true ? "#34c77b" : "#f4f2ee"};text-align:${opp};white-space:nowrap" dir="${dir}">${esc(l.value)}</td>
  </tr></table>${bars[l.key] ?? ""}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:'IBM Plex Sans Arabic',Inter,-apple-system,'Segoe UI',Tahoma,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px" dir="${dir}">
  <tr><td style="padding:0 6px 18px;text-align:${align}">
    <div style="font-size:13px;letter-spacing:.08em;color:#d4af6a;font-weight:700">LYAQA · لياقتي</div>
    <div style="font-size:26px;font-weight:800;color:#f4f2ee;margin-top:6px">📊 ${esc(title)}</div>
  </td></tr>
  <tr><td style="background:#151517;border-radius:24px;border:1px solid #222226;overflow:hidden">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>
  <tr><td style="padding:18px 6px 0">
    <div style="background:rgba(212,175,106,.12);border:1px solid rgba(212,175,106,.3);border-radius:20px;padding:16px 18px;color:#f4f2ee;font-size:16px;line-height:1.6;text-align:${align}">${esc(encouragement)}</div>
  </td></tr>
  ${appUrl ? `<tr><td align="center" style="padding:22px 6px 0"><a href="${esc(appUrl)}" style="display:inline-block;background:#d4af6a;color:#1a1408;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:14px">${locale === "ar" ? "افتح التطبيق" : "Open the app"}</a></td></tr>` : ""}
</table></td></tr></table></body></html>`;
  const text = [`📊 ${title}`, "", ...lines.map((l) => `${l.icon} ${l.label}: ${l.value}`), "", encouragement].join("\n");
  return { subject: `📊 ${title}`, html, text };
}
