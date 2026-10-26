import { defineConfig, devices } from "@playwright/test";

// Dos teléfonos: el iPhone (Safari = WebKit) y el Samsung (Chrome = Chromium).
// La lógica pura corre una sola vez, sin navegador.
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:4173/", trace: "retain-on-failure" },
  webServer: {
    command: `python3 -m http.server 4173 --bind 127.0.0.1 --directory ${process.env.SITE_ROOT || "."}`,
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore",
  },
  projects: [
    { name: "logic", testMatch: /calc\.spec\.ts/ },
    { name: "iphone", testIgnore: /calc\.spec\.ts/, use: { ...devices["iPhone SE"] } },
    { name: "samsung", testIgnore: /calc\.spec\.ts/, use: { ...devices["Galaxy S9+"] } },
  ],
});
