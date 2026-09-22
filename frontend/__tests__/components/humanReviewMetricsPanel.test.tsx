import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ fetchFromBackend: vi.fn() }));

import { HumanReviewMetricsPanel } from "@/components/accuracy/HumanReviewMetricsPanel";
import { fetchFromBackend } from "@/lib/api";

const mockedFetch = vi.mocked(fetchFromBackend);

describe("HumanReviewMetricsPanel", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("keeps production rates unavailable until reviewed evidence exists", async () => {
    mockedFetch.mockResolvedValue({ basis: "human_review", reviewed_cases: 0 });
    render(<HumanReviewMetricsPanel />);

    await waitFor(() => {
      expect(screen.getByText(/No reviewed production cases yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Live source")).toBeInTheDocument();
  });

  it("labels populated metrics as human-review evidence", async () => {
    mockedFetch.mockResolvedValue({
      basis: "human_review",
      reviewed_cases: 12,
      true_positive: 8,
      false_positive: 2,
      false_negative: 1,
      true_negative: 1,
      inconclusive: 0,
      precision: 80,
      recall: 88.9,
      false_positive_rate: 66.7,
      false_negative_rate: 11.1,
    });
    render(<HumanReviewMetricsPanel />);

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument();
    });
    expect(screen.getByText("80.0%")).toBeInTheDocument();
    expect(screen.getByText("88.9%")).toBeInTheDocument();
  });
});
