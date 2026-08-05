import { describe, it, expect } from "vitest";
import { ArtsaClient, ArtsaBlockedError } from "../src/index.ts";

describe("ArtsaClient", () => {
  it("defaults to fail-closed", () => {
    const client = new ArtsaClient({ apiUrl: "http://127.0.0.1:1", timeoutMs: 20, maxRetries: 0 });
    expect(client.failClosed).toBe(true);
  });

  it("treats KILL as blocked", () => {
    const client = new ArtsaClient();
    expect(
      client.isBlocked({
        verdict: { verdict: "BREACHED", recommended_action: "KILL" },
      })
    ).toBe(true);
  });

  it("guardToolCall raises on block", async () => {
    const client = new ArtsaClient();
    client.monitorToolCall = async () => ({
      verdict: { verdict: "SUSPICIOUS", recommended_action: "QUARANTINE", reasoning: "test" },
    });
    await expect(
      client.guardToolCall({
        sessionId: "s",
        agentId: "a",
        toolName: "shell",
        arguments: {},
      })
    ).rejects.toBeInstanceOf(ArtsaBlockedError);
  });
});
