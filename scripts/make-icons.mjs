// يولّد أيقونات التطبيق لكل ثيم ألوان (نفس شعار التطبيق) باستخدام Playwright
// التشغيل: NODE_PATH=$(npm root -g) node scripts/make-icons.mjs
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

// لون الخلفية ولون الرسمة لكل ثيم (نفس ألوان الوضع الداكن في التطبيق)
const ACCENTS = {
  gold: ["#d4af6a", "#1a1408"],
  emerald: ["#34d399", "#04261a"],
  ocean: ["#60a5fa", "#0b1a33"],
  rose: ["#fb7185", "#3a0a12"],
  violet: ["#a78bfa", "#1e1240"],
  silver: ["#d4d4d8", "#18181b"],
};

// maskable: الأيقونة تملا المربع كامل (أندرويد يقصها بنفسه)، والرسمة أصغر عشان ما تنقص
const svg = (bg, ink, maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 116}" fill="${bg}"/>
  <g transform="translate(256 256) scale(${maskable ? 10 : 12.5}) translate(-12 -12)" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
  </g>
</svg>`;

const FILES = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [accent, [bg, ink]] of Object.entries(ACCENTS)) {
  mkdirSync(`public/icons/${accent}`, { recursive: true });
  for (const [name, size, maskable] of FILES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg(bg, ink, maskable)}`);
    const png = await page.screenshot({ omitBackground: true });
    writeFileSync(`public/icons/${accent}/${name}`, png);
    if (accent === "gold") writeFileSync(`public/icons/${name}`, png); // الافتراضي
  }
}
await browser.close();
console.log("icons done");
