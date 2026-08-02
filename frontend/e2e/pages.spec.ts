import { test, expect } from "@playwright/test";

test.describe("ARTSA frontend pages", () => {
  test("wargame page renders campaign wizard", async ({ page }) => {
    await page.goto("/wargame");
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

  test("attack-library page renders template management", async ({ page }) => {
    await page.goto("/attack-library");
    await expect(
      page.getByRole("heading", { name: /attack library/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /new template/i })).toBeVisible();
  });
});
