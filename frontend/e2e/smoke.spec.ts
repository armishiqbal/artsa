import { test, expect } from "@playwright/test";

test.describe("ARTSA frontend smoke", () => {
  test("home page loads command center", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /command center|artsa/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#main-content")).toContainText(/sign in|sso|api key/i);
  });

  test("observatory route is reachable", async ({ page }) => {
    await page.goto("/observatory");
    await expect(page.getByRole("heading", { name: /continuous observatory/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("risk framework page lists the agentic top 10", async ({ page }) => {
    await page.goto("/risks");
    await expect(page.getByRole("heading", { name: /agentic risk framework/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: /agent goal hijack/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /rogue agents/i }).first()).toBeVisible();
  });

  test("simulated demo badge appears when live pipeline is idle", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /command center|artsa/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    // Idle ingest → Simulated demo label (aria-label from SimulatedBadge)
    await expect(page.getByLabel("Simulated demo data").first()).toBeVisible({ timeout: 15_000 });
  });

  test("sidebar navigation includes wargame", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Wargame", exact: true })).toBeVisible();
  });
});
