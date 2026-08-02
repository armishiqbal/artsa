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

  test("sidebar navigation includes wargame", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Wargame" })).toBeVisible();
  });
});
