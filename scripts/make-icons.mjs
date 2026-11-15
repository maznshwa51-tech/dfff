// يولّد أيقونات التطبيق من SVG باستخدام Playwright (مرة وحدة فقط، الأيقونات محفوظة في public/icons)
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { writeFileSync } from "node:fs";

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0d9488"/>
  <g transform="translate(256 256) scale(${pad ? 0.72 : 0.9}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">
    <path d="M96 276h72l40-92 64 168 44-108h100"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const out = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true],
];
for (const [name, size, maskable] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg(maskable)}`);
  writeFileSync(`public/icons/${name}`, await page.screenshot({ omitBackground: true }));
}
await browser.close();
console.log("icons done");
