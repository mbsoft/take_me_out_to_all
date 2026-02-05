import { describe, it, expect } from "vitest";
import { parseCustomTeams, goalLabel, filterTeamsByGoal } from "../goal-utils";

describe("parseCustomTeams", () => {
  it("returns empty array for null", () => {
    expect(parseCustomTeams(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(parseCustomTeams(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCustomTeams("")).toEqual([]);
  });

  it("returns array as-is if already an array", () => {
    const teams = ["NYY", "BOS", "LAD"];
    expect(parseCustomTeams(teams)).toEqual(teams);
  });

  it("parses JSON string array", () => {
    expect(parseCustomTeams('["NYY","BOS","LAD"]')).toEqual(["NYY", "BOS", "LAD"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseCustomTeams("not valid json")).toEqual([]);
  });

  it("returns empty array if JSON parses to non-array", () => {
    expect(parseCustomTeams('{"team":"NYY"}')).toEqual([]);
    expect(parseCustomTeams('"NYY"')).toEqual([]);
    expect(parseCustomTeams("123")).toEqual([]);
  });

  it("handles empty JSON array", () => {
    expect(parseCustomTeams("[]")).toEqual([]);
  });
});

describe("goalLabel", () => {
  it('returns "All 30 Parks" for "all" goal', () => {
    expect(goalLabel("all")).toBe("All 30 Parks");
  });

  it('returns "AL Parks (15)" for "al" goal', () => {
    expect(goalLabel("al")).toBe("AL Parks (15)");
  });

  it('returns "NL Parks (15)" for "nl" goal', () => {
    expect(goalLabel("nl")).toBe("NL Parks (15)");
  });

  it("returns custom label with team count for custom goal", () => {
    expect(goalLabel("custom", ["NYY", "BOS", "LAD"])).toBe("Custom (3 parks)");
  });

  it("uses singular 'park' for single team", () => {
    expect(goalLabel("custom", ["NYY"])).toBe("Custom (1 park)");
  });

  it("handles empty custom teams array", () => {
    expect(goalLabel("custom", [])).toBe("Custom (0 parks)");
  });

  it("handles null custom teams", () => {
    expect(goalLabel("custom", null)).toBe("Custom (0 parks)");
  });

  it("handles undefined custom teams", () => {
    expect(goalLabel("custom")).toBe("Custom (0 parks)");
  });

  it("returns unknown goal as-is", () => {
    expect(goalLabel("unknown_goal")).toBe("unknown_goal");
    expect(goalLabel("division_west")).toBe("division_west");
  });
});

describe("filterTeamsByGoal", () => {
  const mockTeams = [
    { abbr: "NYY", league: "AL" },
    { abbr: "BOS", league: "AL" },
    { abbr: "LAD", league: "NL" },
    { abbr: "CHC", league: "NL" },
    { abbr: "HOU", league: "AL" },
    { abbr: "ATL", league: "NL" },
  ];

  it('returns all teams for "all" goal', () => {
    const result = filterTeamsByGoal(mockTeams, "all");
    expect(result).toEqual(mockTeams);
  });

  it('returns only AL teams for "al" goal', () => {
    const result = filterTeamsByGoal(mockTeams, "al");
    expect(result).toHaveLength(3);
    expect(result.every((t) => t.league === "AL")).toBe(true);
    expect(result.map((t) => t.abbr)).toEqual(["NYY", "BOS", "HOU"]);
  });

  it('returns only NL teams for "nl" goal', () => {
    const result = filterTeamsByGoal(mockTeams, "nl");
    expect(result).toHaveLength(3);
    expect(result.every((t) => t.league === "NL")).toBe(true);
    expect(result.map((t) => t.abbr)).toEqual(["LAD", "CHC", "ATL"]);
  });

  it('returns matching teams for "custom" goal', () => {
    const result = filterTeamsByGoal(mockTeams, "custom", ["NYY", "LAD"]);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.abbr)).toEqual(["NYY", "LAD"]);
  });

  it("returns empty array for custom goal with no matches", () => {
    const result = filterTeamsByGoal(mockTeams, "custom", ["SF", "SD"]);
    expect(result).toEqual([]);
  });

  it("returns empty array for custom goal with null customTeams", () => {
    const result = filterTeamsByGoal(mockTeams, "custom", null);
    expect(result).toEqual([]);
  });

  it("returns empty array for custom goal with undefined customTeams", () => {
    const result = filterTeamsByGoal(mockTeams, "custom");
    expect(result).toEqual([]);
  });

  it("returns all teams for unknown goal type", () => {
    const result = filterTeamsByGoal(mockTeams, "unknown_goal");
    expect(result).toEqual(mockTeams);
  });

  it("handles empty teams array", () => {
    expect(filterTeamsByGoal([], "all")).toEqual([]);
    expect(filterTeamsByGoal([], "al")).toEqual([]);
    expect(filterTeamsByGoal([], "nl")).toEqual([]);
    expect(filterTeamsByGoal([], "custom", ["NYY"])).toEqual([]);
  });

  it("preserves additional team properties", () => {
    const teamsWithExtras = [
      { abbr: "NYY", league: "AL", name: "Yankees", city: "New York" },
      { abbr: "LAD", league: "NL", name: "Dodgers", city: "Los Angeles" },
    ];
    const result = filterTeamsByGoal(teamsWithExtras, "al");
    expect(result[0]).toEqual({ abbr: "NYY", league: "AL", name: "Yankees", city: "New York" });
  });

  it("handles teams without league property for al/nl goals", () => {
    const teamsNoLeague = [
      { abbr: "NYY" },
      { abbr: "LAD", league: "NL" },
    ];
    expect(filterTeamsByGoal(teamsNoLeague, "al")).toEqual([]);
    expect(filterTeamsByGoal(teamsNoLeague, "nl")).toEqual([{ abbr: "LAD", league: "NL" }]);
  });
});
