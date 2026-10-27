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
  await page.evaluate(() => navigator.serviceWorker.ready);
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
  await page.evaluate(() => caches.open("otra-app-v1"));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => caches.keys())).toContainEqual(expect.stringMatching(/^calc-ldk-/));
  expect(await page.evaluate(() => caches.keys())).toContain("otra-app-v1");
});
