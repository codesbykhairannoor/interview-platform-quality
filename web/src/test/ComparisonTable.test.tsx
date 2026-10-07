import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComparisonTable from "@/components/fitgap/ComparisonTable";
import type { SkillComparison } from "@/types";

describe("ComparisonTable Component", () => {
  it("renders the required level for each skill based on backend comparison data", () => {
    // Simulating backend comparison item
    const comparisons: (SkillComparison & { expected_level?: number })[] = [
      {
        skill_label: "React / Frontend Development",
        required_level: 3,
        candidate_level: 3,
        result: "match",
        delta: 0,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    // Table should display skill name
    expect(screen.getByText("React / Frontend Development")).toBeInTheDocument();

    // Required column should show L3
    const cells = screen.getAllByRole("cell");
    const requiredCell = cells.find((cell) => cell.textContent?.trim() === "L3");
    expect(requiredCell).toBeDefined();
  });

  it("fails to render required level when backend only supplies expected_level (seam contract mismatch)", () => {
    // This reproduces the exact contract seam bug:
    // Backend FitGap::Engine returned `expected_level`, but frontend looks for `c.required_level`.
    const backendRawPayload: any[] = [
      {
        skill_label: "Communication",
        expected_level: 3, // Backend only sent expected_level
        candidate_level: 2,
        result: "gap",
        delta: -1,
      },
    ];

    render(<ComparisonTable comparisons={backendRawPayload} />);

    // In the unpatched component, LEVEL_LABELS[undefined] renders blank, so "L3" is absent!
    // The test asserts that L3 is rendered under the Required column:
    const cells = screen.getAllByRole("cell");
    const requiredLevelDisplayed = cells.some((cell) => cell.textContent?.trim() === "L3");
    expect(requiredLevelDisplayed).toBe(true);
  });

  it("renders the override indicator (pencil) when a skill level has been overridden", () => {
    const comparisons: SkillComparison[] = [
      {
        skill_label: "System Design",
        required_level: 2,
        candidate_level: 3,
        result: "exceed",
        delta: 1,
        is_override: true,
      },
    ];

    render(<ComparisonTable comparisons={comparisons} />);

    // Should render the pencil symbol indicating human override
    expect(screen.getByText("✏")).toBeInTheDocument();
  });
});
