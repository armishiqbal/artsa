import { test, expect } from "@playwright/test";
import { seedAuth } from "./seedAuth";

test.describe("ARTSA frontend pages", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test("campaigns page renders scans list", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(page.getByRole("heading", { name: /^scans$/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /new scan/i }).first()).toBeVisible();
  });

  test("new scan opens as modal from scans", async ({ page }) => {
    await page.goto("/campaigns");
    await page.getByRole("button", { name: /new scan/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /start red team/i })).toBeVisible();
  });

  test("replay page renders session replay UI", async ({ page }) => {
    await page.goto("/replay");
    await expect(
      page.getByRole("heading", { name: /session autopsy/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /deep analysis/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /play/i })).toBeVisible();
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

  test("landing page renders at root", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: /contain ai agents/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /get started/i }).first()).toBeVisible();
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

  test("get started page renders readiness checklist", async ({ page }) => {
    await page.goto("/get-started");
    await expect(
      page.getByRole("heading", { name: /ready for production/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /send test event/i }).first()).toBeVisible();
  });

  test("rag integration guide page renders", async ({ page }) => {
    await page.goto("/guides/rag-astra");
    await expect(
      page.getByRole("heading", { name: /rag \+ astra integration/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("logs page renders security event log", async ({ page }) => {
    await page.goto("/logs");
    await expect(
      page.getByRole("heading", { name: /security event log|activity log/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("command center shows integration activity", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /command center/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/integration activity/i).first()).toBeVisible();
  });

  test("guard capabilities reference page renders", async ({ page }) => {
    await page.goto("/guides/guard-capabilities");
    await expect(
      page.getByRole("heading", { name: /guard capabilities/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("reports page shows readiness snapshot", async ({ page }) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { name: /assessment reports/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/go-live readiness/i).first()).toBeVisible();
  });
});
