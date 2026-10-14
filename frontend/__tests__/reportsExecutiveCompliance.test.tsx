import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ReportsPage from "@/app/(app)/reports/page";

vi.mock("@/lib/hooks/useCampaigns", () => ({
  useCampaigns: () => ({
    campaigns: [
      {
        id: "camp-test-1",
        name: "Autonomous Red Team Evaluation #1",
        model: "gpt-5.6-terra",
        provider: "openai",
        status: "completed",
        rounds_completed: 10,
        summary: {
          campaign_id: "camp-test-1",
          model: "gpt-5.6-terra",
          provider: "openai",
          total_rounds: 10,
          avg_attack_success: 4.0,
          avg_bypass_depth: 1.5,
          avg_defense_quality: 9.2,
          results_by_verdict: { BLOCKED: 9, BREACHED: 1 },
        },
      },
    ],
    loading: false,
  }),
}));

// Mock fetch for compliance endpoint
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/backend/api/v1/compliance/report/export?format=json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              artifact_type: "ARTSA_EXECUTIVE_COMPLIANCE_AUDIT",
              nist_ai_rmf_scorecard: {
                composite_score: null,
                functions: [],
              },
              owasp_agentic_top10: {
                compliance_score: null,
                summary: { not_assessed: 10 },
                rows: [{ id: "ASI01", name: "Agent Goal Hijack", status: "NOT_ASSESSED", control: "", finding: "" }],
              },
              hmac_cryptographic_proofs: {
                algorithm: "HMAC-SHA256",
                non_repudiation_status: "UNVERIFIED",
                total_signed_hops: 0,
                verified_hops: 0,
                merkle_root_hash: null,
              },
              adaptive_defense_lift: {
                static_baseline_detection_rate: null,
                adaptive_defense_detection_rate: null,
                adaptive_lift_percent: null,
                judged_outcomes: null,
                hot_patches_applied: null,
                tools_quarantined: null,
              },
            }),
        });
      }
      if (url.includes("/api/backend/api/v1/compliance/report/export?format=pdf")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["%PDF-1.4 mock pdf"], { type: "application/pdf" })),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    })
  );
});

describe("ReportsPage - Executive Compliance & Audit Export", () => {
  it("renders page header and selected campaign summary", async () => {
    render(<ReportsPage />);

    expect(screen.getByText(/Executive Reports & Compliance/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Autonomous Red Team Evaluation #1/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Export Executive PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Export Audit JSON/i)).toBeInTheDocument();
  });

  it("shows unavailable compliance and proof values without evidence", async () => {
    render(<ReportsPage />);

    expect(screen.getByText(/Governance & Cryptographic Proofs/i)).toBeInTheDocument();
    expect(screen.getAllByText(/NIST AI RMF/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/OWASP Agentic Top 10/i).length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText(/UNVERIFIED/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Not assessed/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Unavailable — no audit rows/i)).toBeInTheDocument();
      expect(screen.getByText(/No judged outcomes recorded/i)).toBeInTheDocument();
    });
  });

  it("handles PDF export click cleanly", async () => {
    render(<ReportsPage />);

    const exportBtn = screen.getByRole("button", { name: /Export Executive PDF/i });
    expect(exportBtn).not.toBeDisabled();

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/backend/api/v1/compliance/report/export?format=pdf"),
        expect.anything()
      );
    });
  });
});
