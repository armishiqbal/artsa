import { test, expect } from "@playwright/test";
import { seedAuth } from "./seedAuth";

test.describe("ARTSA frontend pages", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test("campaigns page renders current red team controls", async ({ page }) => {
    await page.goto("/red-team/campaigns");
    await expect(page.getByRole("button", { name: /^quick scan$/i }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /^attack lab$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^builder$/i }).first()).toBeVisible();
  });

  test("quick scan opens as modal from campaigns", async ({ page }) => {
    await page.goto("/red-team/campaigns");
    await page.getByRole("button", { name: /^quick scan$/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /start red team/i })).toBeVisible();
  });

  test("replay page renders session replay UI", async ({ page }) => {
    await page.goto("/replay");
    await expect(page.getByText(/^sessions$/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /deep analysis/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /play/i })).toBeVisible();
  });

  test("reports page renders report generation UI", async ({ page }) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { name: /^reports$/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Attack tests", exact: true })
    ).toBeVisible();
  });

  test("library page renders template management", async ({ page }) => {
    await page.goto("/red-team/library");
    await expect(page.getByText(/templates from artsa/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /open attack lab/i })).toBeVisible();
  });

  test("AI Security Playground runs Guard Tester and Chat Simulator", async ({ page }) => {
    await page.goto("/playground");
    await expect(page.getByRole("heading", { name: /ai security playground/i })).toBeVisible();
    const playgroundSelect = page.getByRole("button", { name: /select playground/i });
    await expect(playgroundSelect).toBeVisible();

    await playgroundSelect.click();
    await page.getByRole("menuitem", { name: /guard tester/i }).click();
    await page.getByRole("button", { name: /use this example/i }).first().click();
    await page.getByRole("button", { name: /screen content/i }).click();
    await expect(page.getByText("BLOCK", { exact: true }).first()).toBeVisible();
    await page.getByText(/technical evidence/i).click();
    await expect(page.getByText(/PromptInjectionDetector/).first()).toBeVisible();
    await page.getByRole("button", { name: /custom prompt/i }).click();
    await page.getByRole("textbox", { name: /content to screen/i }).fill("custom fixture prompt");
    await page.getByRole("button", { name: /screen content/i }).click();
    await expect(page.getByText(/guard decision ready/i)).toBeVisible();

    await playgroundSelect.click();
    await page.getByRole("menuitem", { name: /chat simulator/i }).click();
    await expect(page.getByRole("textbox", { name: /user message/i })).toBeVisible();
    await page.getByRole("button", { name: /use prompt/i }).first().click();
    await page.getByRole("button", { name: /run simulation/i }).click();
    await expect(page.getByText("Fixture response")).toBeVisible();
    await expect(page.getByText(/output screened/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /new conversation/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /run again/i })).toBeVisible();
    await page.getByRole("button", { name: /new conversation/i }).click();
    await expect(page.getByText(/choose an example prompt/i)).toBeVisible();

    const chatInput = page.getByRole("textbox", { name: /user message/i });
    await chatInput.fill("line one");
    await chatInput.press("Shift+Enter");
    await chatInput.type("line two");
    await expect(chatInput).toHaveValue("line one\nline two");
    await chatInput.fill("blocked fixture");
    await chatInput.press("Enter");
    await expect(page.getByText(/blocked before it reached the provider/i)).toBeVisible();
    await page.getByRole("button", { name: /view guard decision/i }).click();
    await expect(page.getByText(/technical evidence/i)).toBeVisible();
  });

  test("playground stacks cleanly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/playground");
    await expect(page.getByRole("heading", { name: /ai security playground/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /user message/i })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });

  test("landing page renders at root", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: /see what ai agents actually do/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /contain your ai agents/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /try live demo/i }).first()).toBeVisible();
    await expect(page.getByText(/get started/i).first()).toBeVisible();
  });

  test("legacy routes redirect correctly", async ({ page }) => {
    // /wargame → /campaigns
    await page.goto("/wargame");
    await expect(page).toHaveURL(/\/campaigns/);

    // /playground is the primary AI Security Playground; /sandbox is legacy.
    await page.goto("/playground");
    await expect(page).toHaveURL(/\/playground/);
    await expect(page.getByRole("heading", { name: /ai security playground/i })).toBeVisible();
    await page.goto("/sandbox");
    await expect(page).toHaveURL(/\/playground/);

    // /attack-library → /library → /red-team/library
    await page.goto("/attack-library");
    await expect(page).toHaveURL(/\/red-team\/library/);

    // /policies → /admin/policies
    await page.goto("/policies");
    await expect(page).toHaveURL(/\/admin\/policies/);

    // /providers → /admin/providers
    await page.goto("/providers");
    await expect(page).toHaveURL(/\/admin\/providers/);

    // /get-started/client → /get-started
    await page.goto("/get-started/client");
    await expect(page).toHaveURL(/\/get-started$/);
  });

  test("get started page is keys setup", async ({ page }) => {
    await page.goto("/get-started");
    await expect(page.getByRole("heading", { name: /^api keys$/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /create new secret key/i }).first()).toBeVisible();
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
      page.getByRole("heading", { name: /security event log|^activity$/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("command center page loads", async ({ page }) => {
    await page.goto("/command-center");
    await expect(page).toHaveURL(/\/command-center/);
  });

  test("guard capabilities reference page renders", async ({ page }) => {
    await page.goto("/guides/guard-capabilities");
    await expect(
      page.getByRole("heading", { name: /what we stop/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("reports page shows readiness snapshot", async ({ page }) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { name: "Reports", exact: true }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Attack tests", exact: true })).toBeVisible();
  });
});
