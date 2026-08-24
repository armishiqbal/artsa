import { test, expect } from "@playwright/test";
import { seedAuth } from "./seedAuth";

test.describe("ARTSA frontend smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test("home page loads enterprise landing", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /contain ai agents/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /get started/i }).first()).toBeVisible();
  });

  test("sign in panel renders on landing", async ({ page }) => {
    await page.goto("/?signin=1");
    await expect(page).toHaveURL(/\?signin=1/);
    await expect(page.getByRole("heading", { name: /sign in/i }).first()).toBeVisible();
  });

  test("command center includes the merged observatory section", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /command center|artsa/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Continuous Observatory/i).first()).toBeVisible();
  });

  test("risk framework page lists the agentic top 10", async ({ page }) => {
    await page.goto("/risks");
    await expect(page.getByRole("heading", { name: /agentic risk framework/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: /agent goal hijack/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /rogue agents/i }).first()).toBeVisible();
  });

  test("command center shows an honest empty state when the pipeline is idle", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /command center|artsa/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    // No simulated telemetry is ever shown — the feed must be an empty state.
    await expect(page.getByLabel("Simulated demo data")).toHaveCount(0);
    await expect(page.getByText(/No live telemetry yet/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("sidebar navigation includes red team console", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /red team console/i })).toBeVisible();
  });
});
