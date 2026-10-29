// Dibuja los íconos de la app a partir de un solo SVG y los pasa a PNG con
// el Chromium de Playwright. Se corre a mano cuando cambia el diseño:
//   node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

// Parecido al ícono de la original: signo ÷ verde sobre un cuadrado blanco y
// gris con bordes redondeados. La variante propia es la franja oscura de abajo,
// que recuerda la cinta de la calculadora.
// maskable: Android recorta el ícono en círculo o "squircle"; el dibujo tiene
// que entrar en el 80 % central y el fondo cubrir todo el cuadrado.
function svg({ maskable = false } = {}) {
  const r = maskable ? 0 : 104;
  const s = maskable ? 0.74 : 1; // escala del dibujo
  const band = maskable ? 396 : 404; // dónde empieza la franja
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e9edef"/><stop offset="1" stop-color="#c4cbcf"/>
    </linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5fd06b"/><stop offset="1" stop-color="#1f8a2c"/>
    </linearGradient>
    <clipPath id="sq"><rect width="512" height="512" rx="${r}"/></clipPath>
  </defs>
  <g clip-path="url(#sq)">
    <rect width="512" height="512" fill="url(#bg)"/>
    <rect y="${band}" width="512" height="${512 - band}" fill="#2b3134"/>
    <rect y="${band}" width="512" height="6" fill="#000" opacity=".35"/>
  </g>
  ${maskable ? "" : `<rect x="6" y="6" width="500" height="500" rx="${r - 6}" fill="none" stroke="#9aa3a8" stroke-width="12"/>`}
  <g transform="translate(256 ${maskable ? 222 : 214}) scale(${s}) translate(-256 -214)">
    <g fill="#000" opacity=".18" transform="translate(0 8)">
      <rect x="96" y="190" width="320" height="52" rx="26"/><circle cx="256" cy="102" r="44"/><circle cx="256" cy="330" r="44"/>
    </g>
    <g fill="url(#g)" stroke="#16701f" stroke-width="4">
      <rect x="96" y="190" width="320" height="52" rx="26"/><circle cx="256" cy="102" r="44"/><circle cx="256" cy="330" r="44"/>
    </g>
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
