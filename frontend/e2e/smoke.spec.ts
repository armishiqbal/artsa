import { test, expect } from "@playwright/test";
import { seedAuth } from "./seedAuth";

test.describe("ARTSA frontend smoke", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test("home page loads enterprise landing", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /see what ai agents actually do/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /contain your ai agents/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /try live demo/i }).first()).toBeVisible();
    await expect(page.getByText(/get started/i).first()).toBeVisible();
  });

  test("sign in panel renders on landing", async ({ page }) => {
    await page.goto("/?signin=1");
    await expect(page).toHaveURL(/\?signin=1/);
    await expect(page.getByRole("heading", { name: /sign in/i }).first()).toBeVisible();
  });

  test("command center page loads", async ({ page }) => {
    await page.goto("/command-center");
    await expect(page).toHaveURL(/\/command-center/);
    await expect(page.getByRole("heading", { name: /command center/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("risk framework page lists the agentic top 10", async ({ page }) => {
    await page.goto("/risks");
    await expect(page.getByRole("heading", { name: /^risk$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: /agent goal hijack/i }).first()).toBeVisible();
    await expect(page.getByText("Rogue Agents", { exact: true })).toBeVisible();
  });

  test("sidebar has eight admin rows and expands Red Team", async ({ page }) => {
    await page.goto("/command-center");
    await expect(page.locator('aside nav[aria-label="Main navigation"] ul').first().locator(":scope > li")).toHaveCount(8);
    await page.getByRole("button", { name: /^red team$/i }).click();
    await expect(page.getByRole("link", { name: /^attack lab$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^campaigns$/i })).toBeVisible();
  });

  test("active groups auto-expand and support arrow keys", async ({ page }) => {
    await page.goto("/red-team/campaigns");
    const redTeam = page.getByRole("button", { name: /^red team$/i });
    const discover = page.getByRole("button", { name: /^discover$/i });
    await expect(redTeam).toHaveAttribute("aria-expanded", "true");
    await expect(discover).toHaveAttribute("aria-expanded", "false");
    await discover.focus();
    await discover.press("ArrowRight");
    await expect(discover).toHaveAttribute("aria-expanded", "true");
    await discover.press("ArrowLeft");
    await expect(discover).toHaveAttribute("aria-expanded", "false");
  });

  test("demoted routes remain available in command search", async ({ page }) => {
    await page.goto("/command-center");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/jump to a page/i).fill("Reports");
    await expect(page.getByRole("button", { name: /reports/i })).toBeVisible();
  });

  test("mobile navigation uses the same eight-row hierarchy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/command-center");
    await page.getByRole("button", { name: /open navigation menu/i }).click();
    const navigation = page.getByRole("dialog", { name: /navigation menu/i });
    await expect(navigation.locator('nav ul').first().locator(":scope > li")).toHaveCount(8);
  });
});
