import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamPicker } from "../team-picker";

// Mock teams data
vi.mock("@/lib/teams-data", () => ({
  teamsData: [
    { abbr: "NYY", name: "Yankees", league: "AL", division: "East" },
    { abbr: "BOS", name: "Red Sox", league: "AL", division: "East" },
    { abbr: "CHC", name: "Cubs", league: "NL", division: "Central" },
    { abbr: "LAD", name: "Dodgers", league: "NL", division: "West" },
  ],
}));

// Mock TeamLogo component
vi.mock("@/components/team-logo", () => ({
  TeamLogo: ({ abbr }: { abbr: string }) => <span data-testid={`logo-${abbr}`}>{abbr}</span>,
}));

describe("TeamPicker", () => {
  it("renders team count correctly", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={["NYY", "BOS"]} onChange={onChange} />);

    expect(screen.getByText("2 of 4 ballparks selected")).toBeInTheDocument();
  });

  it("renders all division headers", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={[]} onChange={onChange} />);

    expect(screen.getByText("AL East")).toBeInTheDocument();
    expect(screen.getByText("NL Central")).toBeInTheDocument();
    expect(screen.getByText("NL West")).toBeInTheDocument();
  });

  it("renders team names and logos", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={[]} onChange={onChange} />);

    expect(screen.getByText("Yankees")).toBeInTheDocument();
    expect(screen.getByText("Red Sox")).toBeInTheDocument();
    expect(screen.getByTestId("logo-NYY")).toBeInTheDocument();
  });

  it("toggles team selection when clicked - deselect", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={["NYY"]} onChange={onChange} />);

    // Click Yankees to deselect
    fireEvent.click(screen.getByText("Yankees"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("toggles team selection when clicked - select", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={[]} onChange={onChange} />);

    // Click Red Sox to select
    fireEvent.click(screen.getByText("Red Sox"));
    expect(onChange).toHaveBeenCalledWith(["BOS"]);
  });

  it("selects all teams when All button is clicked", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(onChange).toHaveBeenCalledWith(["NYY", "BOS", "CHC", "LAD"]);
  });

  it("selects only AL teams when AL button is clicked", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "AL" }));

    expect(onChange).toHaveBeenCalledWith(["NYY", "BOS"]);
  });

  it("selects only NL teams when NL button is clicked", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "NL" }));

    expect(onChange).toHaveBeenCalledWith(["CHC", "LAD"]);
  });

  it("clears all selections when Clear button is clicked", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={["NYY", "BOS", "CHC"]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows check icon for selected teams", () => {
    const onChange = vi.fn();
    const { container } = render(<TeamPicker selectedTeams={["NYY"]} onChange={onChange} />);

    // Yankees should have a check icon (selected)
    const yankeeButton = screen.getByText("Yankees").closest("button");
    expect(yankeeButton?.querySelector("svg")).toBeInTheDocument();

    // Red Sox should not have a check icon (not selected)
    const redSoxButton = screen.getByText("Red Sox").closest("button");
    expect(redSoxButton?.querySelector("svg")).toBeNull();
  });

  it("applies different styles for selected vs unselected teams", () => {
    const onChange = vi.fn();
    render(<TeamPicker selectedTeams={["NYY"]} onChange={onChange} />);

    const yankeeButton = screen.getByText("Yankees").closest("button");
    const redSoxButton = screen.getByText("Red Sox").closest("button");

    // Selected team should have primary color class
    expect(yankeeButton?.className).toContain("bg-primary");
    // Unselected team should have muted background
    expect(redSoxButton?.className).toContain("bg-muted");
  });
});
