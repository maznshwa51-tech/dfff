import "server-only";
import { Resend } from "resend";

/** إرسال الإيميل عن طريق Resend */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "Lyaqa <onboarding@resend.dev>",
    to,
    subject,
    html,
    text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

/** متغيرات قالب واتساب: ممنوع فيها أسطر جديدة أو أكثر من 4 مسافات متتالية */
export function waParam(s: string): string {
  return s.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 1000) || "-";
}

/** إرسال رسالة قالب (template) عن طريق WhatsApp Cloud API من Meta */
export async function sendWhatsApp(to: string, params: string[], lang: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing");
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE || "daily_report",
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || lang },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: waParam(text) })) }],
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`WhatsApp ${res.status}: ${body.slice(0, 300)}`);
  }
}
