import { describe, it, expect } from "vitest";
import { parseLevel, formatLevelBadge } from "../utils/constants";

describe("constants utility: parseLevel & formatLevelBadge", () => {
  it("correctly parses numeric and string representations of levels", () => {
    expect(parseLevel(3)).toBe(3);
    expect(parseLevel("L4")).toBe(4);
    expect(parseLevel("level 5")).toBe(5);
    expect(parseLevel("invalid")).toBe(1);
  });

  it("formats valid levels with corresponding label, description, and badgeClass", () => {
    const badge = formatLevelBadge(3);
    expect(badge.levelNumber).toBe(3);
    expect(badge.label).toBe("L3");
    expect(badge.description).toBe("Proficient");
    expect(badge.badgeClass).toContain("teal");
  });

  it("handles string level inputs gracefully", () => {
    const badge = formatLevelBadge("L5");
    expect(badge.levelNumber).toBe(5);
    expect(badge.label).toBe("L5");
    expect(badge.description).toBe("Expert");
    expect(badge.badgeClass).toContain("yellow");
  });

  it("clamps out-of-range or malformed levels safely to boundaries", () => {
    const badgeLow = formatLevelBadge(0);
    expect(badgeLow.levelNumber).toBe(1);
    expect(badgeLow.label).toBe("L1");
    expect(badgeLow.description).toBe("Foundational");

    const badgeHigh = formatLevelBadge(99);
    expect(badgeHigh.levelNumber).toBe(5);
    expect(badgeHigh.label).toBe("L5");
    expect(badgeHigh.description).toBe("Expert");

    const badgeMalformed = formatLevelBadge("unknown");
    expect(badgeMalformed.levelNumber).toBe(1);
    expect(badgeMalformed.label).toBe("L1");
  });
});
