import { test, expect } from "@playwright/test";
import { seedAuth } from "./seedAuth";

test.describe("ARTSA frontend pages", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test("campaigns page renders campaign wizard", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(
      page.getByRole("heading", { name: /wargame simulation/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("navigation", { name: "Wargame wizard steps" })
    ).toBeVisible();
  });

  test("replay page renders session replay UI", async ({ page }) => {
    await page.goto("/replay");
    await expect(
      page.getByRole("heading", { name: /session replay/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /autopsy mode/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /deep forensics/i })).toBeVisible();
  });

  test("reports page renders report generation UI", async ({ page }) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { name: /assessment reports/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /campaign archive/i })
    ).toBeVisible();
  });

  test("library page renders template management", async ({ page }) => {
    await page.goto("/library");
    await expect(
      page.getByRole("heading", { name: /attack library/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /new template/i })).toBeVisible();
  });

  test("dashboard page redirects from root", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /command center/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("legacy routes redirect correctly", async ({ page }) => {
    // /wargame → /campaigns
    await page.goto("/wargame");
    await expect(page).toHaveURL(/\/campaigns/);

    // /playground → /sandbox
    await page.goto("/playground");
    await expect(page).toHaveURL(/\/sandbox/);

    // /attack-library → /library
    await page.goto("/attack-library");
    await expect(page).toHaveURL(/\/library/);

    // /policies → /admin/policies
    await page.goto("/policies");
    await expect(page).toHaveURL(/\/admin\/policies/);

    // /providers → /admin/providers
    await page.goto("/providers");
    await expect(page).toHaveURL(/\/admin\/providers/);

    // /topology → /dashboard/topology
    await page.goto("/topology");
    await expect(page).toHaveURL(/\/dashboard\/topology/);
  });
});
