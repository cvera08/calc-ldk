// Dibuja los íconos de la app a partir de un solo SVG y los pasa a PNG con
// el Chromium de Playwright. Se corre a mano cuando cambia el diseño:
//   node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

// maskable: Android recorta el ícono en círculo o "squircle"; el dibujo tiene
// que entrar en el 80 % central y el fondo cubrir todo el cuadrado.
function svg({ maskable = false } = {}) {
  const r = maskable ? 0 : 96;
  const s = maskable ? 0.72 : 1; // escala del signo
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${r}" fill="#4a555b"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)" fill="#ffffff">
    <rect x="104" y="232" width="304" height="48" rx="24"/>
    <circle cx="256" cy="148" r="40"/>
    <circle cx="256" cy="364" r="40"/>
  </g>
</svg>`;
}

const out = [
  ["icons/icon-192.png", 192, svg()],
  ["icons/icon-512.png", 512, svg()],
  ["icons/maskable-512.png", 512, svg({ maskable: true })],
  // iOS pone fondo negro donde hay transparencia y redondea solo: va sin esquinas.
  ["icons/apple-touch-icon.png", 180, svg({ maskable: true })],
];

writeFileSync("icons/icon.svg", svg() + "\n");
const browser = await chromium.launch();
for (const [file, size, art] of out) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block}</style><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(art).toString("base64")}">`);
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log(file, size);
}
await browser.close();
