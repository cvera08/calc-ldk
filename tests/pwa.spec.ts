// Instalable y offline: manifest, íconos y service worker.
import { test, expect } from "@playwright/test";

test("el manifest tiene lo que piden Chrome y Safari para instalar", async ({ page, request }) => {
  await page.goto("./");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "Calc LDK", short_name: "Calc LDK", start_url: "./", scope: "./", display: "standalone" });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const res = await request.get(icon.src);
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()["content-type"]).toBe("image/png");
  }
});

test("Safari: ícono de inicio, nombre y pantalla completa", async ({ page, request }) => {
  await page.goto("./");
  const icon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect((await request.get(icon!)).ok()).toBe(true);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Calc LDK");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
});

test("abre y calcula sin internet", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright solo maneja service workers en Chromium");
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // ya controlada por el service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#keys")).toBeVisible();
  for (const k of ["1", "5", "3", ".", "6", "3", "-", "1", "0", "8", "="]) await page.locator(`#keys [data-k="${k}"]`).tap();
  await expect(page.locator("#cur")).toHaveText("45.63");
  await context.setOffline(false);
});

test("el service worker solo borra cachés propias", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright solo maneja service workers en Chromium");
  await page.goto("./");
  await page.evaluate(() => caches.open("otra-app-v1").then(() => true));
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => caches.keys())).toContainEqual(expect.stringMatching(/^calc-ldk-/));
  expect(await page.evaluate(() => caches.keys())).toContain("otra-app-v1");
});

// Cabecera PNG: ancho, alto y si tiene canal alfa (tipo de color 4 o 6).
function png(buf: Buffer) {
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alpha: buf[25] === 4 || buf[25] === 6 };
}

test("los íconos miden lo que dicen y los de inicio no tienen transparencias", async ({ page, request }) => {
  await page.goto("./");
  const manifest = await (await request.get("manifest.webmanifest")).json();
  for (const icon of manifest.icons) {
    const { w, h, alpha } = png(await (await request.get(icon.src)).body());
    expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    // Android recorta el maskable: si tuviera transparencias quedarían huecos
    if (icon.purpose === "maskable") expect(alpha, icon.src).toBe(false);
  }
  // iPhone pinta de negro lo transparente: el ícono de inicio tiene que ser opaco
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  const a = png(await (await request.get(apple!)).body());
  expect(a).toEqual({ w: 180, h: 180, alpha: false });
});

test("Chrome la acepta como app instalable (no solo acceso directo)", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "La revisión de instalabilidad es de Chromium");
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const cdp = await context.newCDPSession(page);
  // Chrome headless no reporta "falta el manifest" como error de instalación,
  // así que además se exige que Chrome haya encontrado y leído el manifest.
  const { url, errors, data } = await cdp.send("Page.getAppManifest");
  expect(url).toMatch(/manifest\.webmanifest$/);
  expect(errors).toEqual([]);
  const m = JSON.parse(data!);
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "192x192")).toBe(true);
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
});
