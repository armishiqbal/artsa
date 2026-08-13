import type { Page } from "@playwright/test";

// With ARTSA_REQUIRE_AUTH=true the UI requires a role API key. Seed the
// frontend auth store (sessionStorage "artsa-auth") with the admin key so
// e2e runs as an authenticated admin. Provide it via ARTSA_API_KEY.
export function seedAuthScript(): string {
  const key = process.env.ARTSA_API_KEY || "";
  if (!key) {
    // No key supplied: do not seed — pages will show the login redirect.
    return "";
  }
  return `sessionStorage.setItem("artsa-auth", JSON.stringify({ state: { bearerToken: null, refreshToken: null, expiresAt: null, apiKey: "${key}" }, version: 0 }));`;
}

export async function seedAuth(page: Page): Promise<void> {
  const script = seedAuthScript();
  if (script) {
    await page.addInitScript(script);
  }
}
