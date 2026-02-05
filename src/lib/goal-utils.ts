/** Parse custom_teams from the JSON TEXT column (same pattern as segment_modes). */
export function parseCustomTeams(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Get human-readable label for a goal + optional custom_teams. */
export function goalLabel(goal: string, customTeams?: string[] | null): string {
  switch (goal) {
    case "all":
      return "All 30 Parks";
    case "al":
      return "AL Parks (15)";
    case "nl":
      return "NL Parks (15)";
    case "custom": {
      const count = customTeams?.length ?? 0;
      return `Custom (${count} park${count !== 1 ? "s" : ""})`;
    }
    default:
      return goal;
  }
}

/** Filter a teams array by goal type. */
export function filterTeamsByGoal<T extends { abbr: string; league?: string }>(
  teams: T[],
  goal: string,
  customTeams?: string[] | null,
): T[] {
  switch (goal) {
    case "al":
      return teams.filter((t) => t.league === "AL");
    case "nl":
      return teams.filter((t) => t.league === "NL");
    case "custom": {
      const set = new Set(customTeams ?? []);
      return teams.filter((t) => set.has(t.abbr));
    }
    default:
      return teams;
  }
}
