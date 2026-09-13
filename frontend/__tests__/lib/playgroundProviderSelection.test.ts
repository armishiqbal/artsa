import { describe, expect, it } from "vitest";
import { selectPlaygroundProviderId } from "@/lib/playgroundProviderSelection";

const providers = [
  { id: "disabled", name: "disabled", provider_type: "groq", enabled: false },
  { id: "groq-1", name: "groq", provider_type: "groq", enabled: true },
  { id: "mistral-1", name: "mistral", provider_type: "mistral", enabled: true },
];

describe("selectPlaygroundProviderId", () => {
  it("selects the first valid enabled provider when none is selected", () => {
    expect(selectPlaygroundProviderId(providers, "")).toBe("groq-1");
  });

  it("preserves an existing valid selection", () => {
    expect(selectPlaygroundProviderId(providers, "mistral-1")).toBe("mistral-1");
  });

  it("does not preserve a disabled selection", () => {
    expect(selectPlaygroundProviderId(providers, "disabled")).toBe("groq-1");
  });

  it("clears an invalid selection when no valid providers remain", () => {
    expect(selectPlaygroundProviderId([], "mistral-1")).toBe("");
  });
});
