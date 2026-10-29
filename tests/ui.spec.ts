// La app en el navegador: lo que se ve en pantalla y lo que queda guardado.
import { test, expect, type Page } from "@playwright/test";

const KEY = "calc-casa-v1";
const display = (page: Page) => page.locator("#cur");
const rows = (page: Page) => page.locator("#tape .row");
const toast = (page: Page) => page.locator(".toast");

// Toca las teclas en pantalla: * = ×, / = ÷, - = −, s = ±
async function tap(page: Page, seq: string) {
  const map: Record<string, string> = { "*": "×", "/": "÷", s: "±" };
  for (const ch of seq) await page.locator(`#keys [data-k="${map[ch] || ch}"]`).tap();
}

test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("153.63 − 108 = 45.63", async ({ page }) => {
  await tap(page, "153.63-108=");
  await expect(display(page)).toHaveText("45.63");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("153.63 − 108");
  await expect(rows(page).first()).toContainText("= 45.63");
});

test("0.1 + 0.2 = 0.3", async ({ page }) => {
  await tap(page, "0.1+0.2=");
  await expect(display(page)).toHaveText("0.3");
});

test("el resultado parcial se ve mientras se escribe", async ({ page }) => {
  await tap(page, "56+23");
  await expect(page.locator("#prev")).toHaveText("= 79");
});

test("108 − 153.63 = −45.63 y se muestra en rojo en el historial", async ({ page }) => {
  await tap(page, "108-153.63=");
  await expect(display(page)).toHaveText("−45.63");
  const res = rows(page).first().locator(".res");
  await expect(res).toHaveText("= −45.63");
  await expect(res).toHaveClass(/neg/);
  const [r, g, b] = (await res.evaluate((el) => getComputedStyle(el).color)).match(/\d+/g)!.map(Number);
  expect(r).toBeGreaterThan(150);
  expect(g).toBeLessThan(130);
  expect(b).toBeLessThan(130);
  // Un positivo no se pinta de rojo
  await tap(page, "2+2=");
  await expect(rows(page).last().locator(".res")).not.toHaveClass(/neg/);
});

test("% estilo CalcMem: 56 + 23 % → 56+23% · 56 + 12.88 = 68.88", async ({ page }) => {
  await tap(page, "56+23%");
  await expect(display(page)).toHaveText("68.88");
  const row = rows(page).first();
  await expect(row.locator(".tag")).toHaveText("56+23%");
  await expect(row.locator(".ex")).toHaveText("56 + 12.88");
  await expect(row.locator(".res")).toHaveText("= 68.88");
});

for (const [seq, res] of [["200-10%", "180"], ["50*20%", "10"], ["50/20%", "250"], ["23%", "0.23"]]) {
  test(`% ${seq} = ${res}`, async ({ page }) => {
    await tap(page, seq);
    await expect(display(page)).toHaveText(res);
    await expect(rows(page)).toHaveCount(1);
  });
}

test("paréntesis: (2+3)×4 = 20, 2(3) = 6, y se cierran solos al apretar =", async ({ page }) => {
  await tap(page, "(2+3)*4=");
  await expect(display(page)).toHaveText("20");
  await tap(page, "2(3)=");
  await expect(display(page)).toHaveText("6");
  await expect(rows(page).last().locator(".ex")).toHaveText("2 × (3)");
  await tap(page, "((1+2)*3");
  await expect(page.locator("#prev")).toHaveText("= 9");
  await tap(page, "=");
  await expect(display(page)).toHaveText("9");
  await expect(rows(page).last().locator(".ex")).toHaveText("((1 + 2) × 3)");
});

test("1 ÷ 0 muestra aviso y NO se guarda en el historial", async ({ page }) => {
  await tap(page, "1/0=");
  await expect(toast(page)).toHaveText("No se puede dividir por cero");
  await expect(toast(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(display(page)).toHaveText("1 ÷ 0");
});

test("= dos veces seguidas no duplica el renglón", async ({ page }) => {
  await tap(page, "7*6==");
  await expect(display(page)).toHaveText("42");
  await expect(rows(page)).toHaveCount(1);
});

test("goma borra solo el cálculo actual y flecha de a un carácter, sin tocar el historial", async ({ page }) => {
  await tap(page, "2+3=");
  await tap(page, "123*4");
  await page.locator("#t-back").tap();
  await expect(display(page)).toHaveText("123 ×");
  await page.locator("#t-back").tap();
  await expect(display(page)).toHaveText("123");
  await page.locator("#t-clear").tap();
  await expect(display(page)).toHaveText("0");
  await expect(rows(page)).toHaveCount(1);
  await page.reload();
  await expect(rows(page)).toHaveCount(1);
});

test("no existe un botón para borrar todo el historial", async ({ page }) => {
  await tap(page, "1+1=");
  await expect(page.getByText(/borrar todo|vaciar|limpiar historial/i)).toHaveCount(0);
  await expect(page.locator("button:visible")).toHaveCount(25); // 20 teclas + 4 herramientas + 1 renglón
});

test("± cambia el signo del último número y no hay dos puntos en un número", async ({ page }) => {
  await tap(page, "8+5s");
  await expect(display(page)).toHaveText("8 − 5");
  await tap(page, "s");
  await expect(display(page)).toHaveText("8 + 5");
  await page.locator("#t-clear").tap();
  await tap(page, "1.2.5");
  await expect(display(page)).toHaveText("1.25");
});

test.describe("historial", () => {
  test("sobrevive a recargar la página", async ({ page }) => {
    await tap(page, "153.63-108=");
    await tap(page, "108-153.63=");
    await page.reload();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).last().locator(".res")).toHaveClass(/neg/);
    await expect(display(page)).toHaveText("−45.63");
  });

  test("máximo 50 renglones", async ({ page }) => {
    const hist = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, t: Date.now(), note: "", ex: `${i} + 1`, res: String(i + 1) }));
    await page.evaluate(([k, h]) => localStorage.setItem(k as string, JSON.stringify({ hist: h, nid: 51 })), [KEY, hist]);
    await page.reload();
    await expect(rows(page)).toHaveCount(50);
    await tap(page, "99+1=");
    await expect(rows(page)).toHaveCount(50);
    await expect(rows(page).first().locator(".ex")).toHaveText("1 + 1");
    await expect(rows(page).last().locator(".ex")).toHaveText("99 + 1");
  });

  test("separado por día", async ({ page }) => {
    const day = 24 * 60 * 60 * 1000;
    const hist = [
      { id: 1, t: Date.now() - 4 * day, note: "", ex: "1 + 1", res: "2" },
      { id: 2, t: Date.now() - day, note: "", ex: "2 + 2", res: "4" },
      { id: 3, t: Date.now(), note: "", ex: "3 + 3", res: "6" },
    ];
    await page.evaluate(([k, h]) => localStorage.setItem(k as string, JSON.stringify({ hist: h, nid: 4 })), [KEY, hist]);
    await page.reload();
    const days = page.locator("#tape .day");
    await expect(days).toHaveCount(3);
    await expect(days.nth(1)).toHaveText("Ayer");
    await expect(days.nth(2)).toHaveText("Hoy");
  });

  test("nota por renglón", async ({ page }) => {
    await tap(page, "1500/8=");
    await rows(page).first().tap();
    await page.locator("#note-in").fill("sueldo por hora");
    await page.locator("#note-in").press("Enter");
    await expect(page.locator(".sheet")).toHaveCount(0);
    await expect(rows(page).first().locator(".tag b")).toHaveText("sueldo por hora");
    await page.reload();
    await expect(rows(page).first().locator(".tag b")).toHaveText("sueldo por hora");
  });

  test("borrar un renglón pide confirmación", async ({ page }) => {
    await tap(page, "1+1=2+2=");
    await rows(page).first().tap();
    const del = page.getByRole("button", { name: "Borrar renglón", exact: true });
    await del.tap();
    await expect(page.getByRole("button", { name: "Tocá de nuevo para borrar" })).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await page.getByRole("button", { name: "Tocá de nuevo para borrar" }).tap();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first().locator(".ex")).toHaveText("2 + 2");
  });

  test("tocar fuera de la hoja la cierra sin borrar", async ({ page }) => {
    await tap(page, "1+1=");
    await rows(page).first().tap();
    await page.getByRole("button", { name: "Borrar renglón", exact: true }).tap();
    await page.locator(".shade").tap({ position: { x: 10, y: 10 } });
    await expect(page.locator(".sheet")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(1);
  });

  test("usar resultado de un renglón", async ({ page }) => {
    await tap(page, "20+5=");
    await tap(page, "4*");
    await rows(page).first().tap();
    await page.getByRole("button", { name: "Usar resultado" }).tap();
    await expect(display(page)).toHaveText("4 × 25");
  });
});

test.describe("conversión US$", () => {
  test("la primera vez pide la cotización y muestra los dos resultados", async ({ page }) => {
    await tap(page, "1000");
    await page.locator("#t-usd").tap();
    await expect(page.locator("#rate-in")).toBeVisible();
    await page.locator("#rate-in").fill("40");
    await expect(page.getByRole("button", { name: /\$U 1000 son\s*US\$ 25$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /US\$ 1000 son\s*\$U 40000$/ })).toBeVisible();
    await page.getByRole("button", { name: /US\$ 25$/ }).tap();
    await expect(display(page)).toHaveText("25");
    await expect(rows(page).last().locator(".tag")).toHaveText("$U → US$");
    await expect(rows(page).last().locator(".ex")).toHaveText("1000 ÷ 40");
  });

  test("con cotización guardada muestra directo los dos resultados, también después de recargar", async ({ page }) => {
    await tap(page, "1000");
    await page.locator("#t-usd").tap();
    await page.locator("#rate-in").fill("40");
    await page.locator(".shade").tap({ position: { x: 10, y: 10 } });
    await page.reload();

    await page.locator("#t-usd").tap();
    await expect(page.locator("#rate-in")).toBeHidden();
    await expect(page.getByRole("button", { name: /^Cambiar cotización · 40/ })).toBeVisible();
    await page.getByRole("button", { name: /\$U 40000$/ }).tap();
    await expect(display(page)).toHaveText("40000");
    await expect(rows(page).last().locator(".tag")).toHaveText("US$ → $U");
    await expect(rows(page).last().locator(".ex")).toHaveText("1000 × 40");
  });

  test("cambiar la cotización recalcula los dos resultados", async ({ page }) => {
    await tap(page, "10");
    await page.locator("#t-usd").tap();
    await page.locator("#rate-in").fill("40");
    await page.locator(".shade").tap({ position: { x: 10, y: 10 } });
    await page.locator("#t-usd").tap();
    await page.getByRole("button", { name: /^Cambiar cotización/ }).tap();
    await page.locator("#rate-in").fill("40,25");
    await expect(page.getByRole("button", { name: /\$U 402\.5$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /US\$ 0\.25$/ })).toBeVisible();
  });

  test("sin monto lo dice y no guarda nada", async ({ page }) => {
    await page.locator("#t-usd").tap();
    await page.locator("#rate-in").fill("40");
    await expect(page.locator(".sheet .hint")).toHaveText("Escribí primero un monto en la calculadora.");
    await expect(page.locator(".sheet .cv")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(0);
  });

  test("sin cotización no muestra resultados", async ({ page }) => {
    await tap(page, "10");
    await page.locator("#t-usd").tap();
    await expect(page.locator(".sheet .hint")).toContainText("Poné la cotización");
    await expect(page.locator(".sheet .cv")).toHaveCount(0);
  });
});
