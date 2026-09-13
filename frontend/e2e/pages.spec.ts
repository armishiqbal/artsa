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
    const chatRequests: Record<string, unknown>[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/playground/chat")) {
        try {
          chatRequests.push(JSON.parse(request.postData() || "{}"));
        } catch {
          // The request assertion below only concerns valid JSON payloads.
        }
      }
    });
    await page.goto("/playground");
    await expect(page.getByRole("heading", { name: /ai security playground/i })).toBeVisible();
    const playgroundSelect = page.getByRole("button", { name: /select playground/i });
    await expect(playgroundSelect).toBeVisible();

    await playgroundSelect.click();
    await page.getByRole("menuitem", { name: /guard tester/i }).click();
    await page.getByRole("button", { name: /^examples$/i }).click();
    await expect(page.getByRole("button", { name: /use this example/i })).toHaveCount(3);
    await page.getByRole("button", { name: /use this example/i }).first().click();
    await expect(page.getByRole("textbox", { name: /content to screen/i })).not.toBeEmpty();
    await page.getByRole("button", { name: /screen content/i }).click();
    await expect(page.getByText(/threats detected/i).first()).toBeVisible();
    await page.getByRole("button", { name: /custom prompt/i }).click();
    await page.getByRole("textbox", { name: /content to screen/i }).fill("custom fixture prompt");
    await page.getByRole("button", { name: /screen content/i }).click();
    await expect(page.getByText(/prompt attack/i).first()).toBeVisible();
    await page.getByRole("textbox", { name: /content to screen/i }).fill("scan unavailable fixture");
    await page.getByRole("button", { name: /screen content/i }).click();
    await expect(page.getByText(/guard is unavailable/i)).toBeVisible();

    await playgroundSelect.click();
    await page.getByRole("menuitem", { name: /chat simulator/i }).click();
    await expect(page.getByRole("textbox", { name: /user message/i })).toBeVisible();
    await page.getByRole("button", { name: /use prompt/i }).first().click();
    await page.getByRole("button", { name: /run simulation/i }).click();
    await expect(page.getByText("Fixture response")).toBeVisible();
    expect(chatRequests[0]?.provider_ref).toBe("e2e-provider-001");
    await expect(page.getByText(/^passed$/i).first()).toBeVisible();
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
    await expect(page.getByText("This message has been blocked due to security policies.")).toBeVisible();
    await page.getByRole("button", { name: /view guard decision/i }).click();
    await expect(page.getByText(/technical details/i)).toBeVisible();
  });

  test("AI Security Playground auto-selects a provider for chat", async ({ page }) => {
    await page.goto("/playground");
    await expect(page.getByText(/Using Fixture provider · openai/i)).toBeVisible();
    const input = page.getByRole("textbox", { name: /user message/i });
    await input.fill("safe provider selection fixture");
    const requestPromise = page.waitForRequest(
      (request) => request.url().includes("/api/v1/playground/chat") && request.method() === "POST"
    );
    await page.getByRole("button", { name: /run simulation/i }).click();
    const request = await requestPromise;
    expect(JSON.parse(request.postData() || "{}").provider_ref).toBe("e2e-provider-001");
  });

  test("playground has no horizontal overflow at supported breakpoints", async ({ page }) => {
    for (const width of [390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/playground");
      await expect(page.getByRole("heading", { name: /ai security playground/i })).toBeVisible();
      await expect(page.getByRole("textbox", { name: /user message/i })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow at ${width}px`).toBeTruthy();
    }
  });

  test("playground keeps viewport scrolling inside its panes", async ({ page }) => {
    for (const width of [390, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/playground");
      await expect(page.getByRole("heading", { name: /ai security playground/i })).toBeVisible();

      const viewport = await page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        shellHeight: document.querySelector(".playground-shell")?.clientHeight ?? 0,
        gridColumns: getComputedStyle(document.querySelector(".playground-shell > div.grid") as Element).gridTemplateColumns,
        chatOverflow: getComputedStyle(document.querySelector('section[aria-label="Chatbot Simulator"]') as Element).overflowY,
        detailsOverflow: getComputedStyle(document.querySelector('aside[aria-label="Playground details"]') as Element).overflowY,
      }));

      expect(viewport.documentHeight, `document scroll at ${width}px`).toBeLessThanOrEqual(viewport.viewportHeight);
      expect(viewport.shellHeight).toBeGreaterThan(0);
      if (width >= 1280) {
        const firstColumnWidth = Number.parseFloat(viewport.gridColumns.split(" ")[0] || "0");
        expect(firstColumnWidth).toBeGreaterThanOrEqual(440);
        if (width >= 1536) expect(firstColumnWidth).toBeGreaterThan(440);
        expect(viewport.chatOverflow).toBe("auto");
        expect(viewport.detailsOverflow).toBe("auto");
      }
    }
  });

  test("playground keeps approval, malformed SSE, and provider failures safe", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("button", { name: /select playground/i }).click();
    await page.getByRole("menuitem", { name: /chat simulator/i }).click();
    const input = page.getByRole("textbox", { name: /user message/i });
    await input.fill("approval fixture");
    await page.getByRole("button", { name: /run simulation/i }).click();
    await expect(page.getByText(/waiting for an approval review/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /review approval request/i })).toBeVisible();

    await page.getByRole("button", { name: /new conversation/i }).click();
    await input.fill("malformed SSE fixture");
    await page.getByRole("button", { name: /run simulation/i }).click();
    await expect(page.getByText(/simulation is unavailable right now/i)).toBeVisible();
    await expect(page.getByText("e2e-malformed-digest")).toBeHidden();

    await page.getByRole("button", { name: /new conversation/i }).click();
    await input.fill("provider unavailable fixture");
    await page.getByRole("button", { name: /run simulation/i }).click();
    await expect(page.getByText(/simulation is unavailable right now/i)).toBeVisible();
    await expect(page.getByText(/no response was shown/i).first()).toBeVisible();
  });

  test("playground correlates multiple runs in reverse chronological order", async ({ page }) => {
    await page.goto("/playground");
    const input = page.getByRole("textbox", { name: /user message/i });
    await input.fill("first safe fixture");
    await page.getByRole("button", { name: /run simulation/i }).click();
    await expect(page.getByText("Fixture response")).toBeVisible();
    await input.fill("blocked fixture");
    await page.getByRole("button", { name: /run simulation/i }).click();
    await expect(page.getByText("This message has been blocked due to security policies.")).toBeVisible();
    const cards = page.locator('article[data-run-id]');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("blocked fixture");
    await expect(cards.nth(0)).toContainText("Flagged");
    await expect(cards.nth(1)).toContainText("first safe fixture");
    await expect(cards.nth(1)).toContainText("Passed");
  });

  test("playground detail tabs implement keyboard selection", async ({ page }) => {
    await page.goto("/playground");
    const logs = page.getByRole("tab", { name: "Guard Logs" });
    const policy = page.getByRole("tab", { name: "Policy Configuration" });
    const chatbot = page.getByRole("tab", { name: "Chatbot Configuration" });
    await expect(logs).toHaveAttribute("aria-selected", "true");
    await logs.focus();
    await logs.press("ArrowRight");
    await expect(policy).toHaveAttribute("aria-selected", "true");
    await policy.press("End");
    await expect(chatbot).toHaveAttribute("aria-selected", "true");
  });

  test("playground cancellation produces a cancelled terminal run", async ({ page }) => {
    await page.goto("/playground");
    await page.getByRole("textbox", { name: /user message/i }).fill("cancel fixture");
    await page.getByRole("button", { name: /run simulation/i }).click();
    await page.getByRole("button", { name: /cancel simulation/i }).click();
    await expect(page.getByText(/cancelled before a response/i)).toBeVisible();
    await expect(page.locator('article[data-run-id]').first()).toContainText("Cancelled");
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
