import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SkillPicker from "@/components/assessment/SkillPicker";
import { skillTaxonomiesApi } from "@/services/skillTaxonomies";

describe("SkillPicker Component", () => {
  it("preserves skill_id identifier when selecting a skill from the B7 taxonomy", async () => {
    const mockSkills = [
      {
        skill_id: "sk-eng-001",
        skill_label: "React / Frontend Development",
        category: "engineering",
        scope_include: "React ecosystem",
        scope_exclude: "Backend",
        l1_anchor: "L1",
        l2_anchor: "L2",
        l3_anchor: "L3",
        l4_anchor: "L4",
        l5_anchor: "L5",
      },
    ];

    vi.spyOn(skillTaxonomiesApi, "list").mockResolvedValue({
      data: { skill_taxonomies: mockSkills },
    } as any);

    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SkillPicker open={true} onOpenChange={onOpenChange} onSelect={onSelect} />
    );

    // Wait for the skill button to appear
    const skillBtn = await screen.findByText("React / Frontend Development");
    fireEvent.click(skillBtn);

    // The selected skill must retain its taxonomy skill_id (not undefined)
    expect(onSelect).toHaveBeenCalledTimes(1);
    const selectedPayload = onSelect.mock.calls[0][0];

    expect(selectedPayload.skill_id).toBe("sk-eng-001");
    expect(selectedPayload.skill_label).toBe("React / Frontend Development");
    expect(selectedPayload.is_custom).toBe(false);
  });
});
