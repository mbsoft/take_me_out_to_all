"use client";

import { teamsData } from "@/lib/teams-data";
import { TeamLogo } from "@/components/team-logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

interface TeamPickerProps {
  selectedTeams: string[];
  onChange: (teams: string[]) => void;
  className?: string;
}

const DIVISIONS = [
  { label: "AL East", league: "AL", division: "East" },
  { label: "AL Central", league: "AL", division: "Central" },
  { label: "AL West", league: "AL", division: "West" },
  { label: "NL East", league: "NL", division: "East" },
  { label: "NL Central", league: "NL", division: "Central" },
  { label: "NL West", league: "NL", division: "West" },
];

export function TeamPicker({ selectedTeams, onChange, className }: TeamPickerProps) {
  const selected = new Set(selectedTeams);

  function toggle(abbr: string) {
    const next = new Set(selected);
    if (next.has(abbr)) {
      next.delete(abbr);
    } else {
      next.add(abbr);
    }
    onChange([...next]);
  }

  function selectAll() {
    onChange(teamsData.map((t) => t.abbr));
  }

  function clearAll() {
    onChange([]);
  }

  function selectLeague(league: string) {
    onChange(teamsData.filter((t) => t.league === league).map((t) => t.abbr));
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">
          {selected.size} of {teamsData.length} ballparks selected
        </span>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={selectAll}>
            All
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => selectLeague("AL")}>
            AL
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => selectLeague("NL")}>
            NL
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DIVISIONS.map((div) => {
          const divTeams = teamsData.filter(
            (t) => t.league === div.league && t.division === div.division,
          );
          return (
            <div key={div.label}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                {div.label}
              </h4>
              <div className="space-y-1">
                {divTeams.map((team) => {
                  const isSelected = selected.has(team.abbr);
                  return (
                    <button
                      key={team.abbr}
                      type="button"
                      onClick={() => toggle(team.abbr)}
                      className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-muted/30 border border-transparent hover:bg-muted/60"
                      }`}
                    >
                      <TeamLogo abbr={team.abbr} size={20} />
                      <span className="flex-1 truncate">{team.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
