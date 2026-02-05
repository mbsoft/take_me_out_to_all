import { describe, it, expect } from "vitest";
import {
  getTeamLogoPath,
  getTeamLogoDownloadUrl,
  TEAM_LOGO_ABBREVIATIONS,
  ABBR_TO_GITHUB_FILENAME,
} from "../team-logos";

describe("getTeamLogoPath", () => {
  it("returns correct path for valid team abbreviation", () => {
    expect(getTeamLogoPath("NYY")).toBe("/images/teams/NYY.svg");
    expect(getTeamLogoPath("LAD")).toBe("/images/teams/LAD.svg");
    expect(getTeamLogoPath("BOS")).toBe("/images/teams/BOS.svg");
  });

  it("handles lowercase input", () => {
    expect(getTeamLogoPath("nyy")).toBe("/images/teams/NYY.svg");
    expect(getTeamLogoPath("lad")).toBe("/images/teams/LAD.svg");
  });

  it("handles mixed case input", () => {
    expect(getTeamLogoPath("Nyy")).toBe("/images/teams/NYY.svg");
    expect(getTeamLogoPath("nYy")).toBe("/images/teams/NYY.svg");
  });

  it("returns undefined for empty string", () => {
    expect(getTeamLogoPath("")).toBeUndefined();
  });

  it("returns undefined for unknown abbreviation", () => {
    expect(getTeamLogoPath("XXX")).toBeUndefined();
    expect(getTeamLogoPath("INVALID")).toBeUndefined();
  });

  it("handles special abbreviations (CHW -> cws, ATH -> oak)", () => {
    expect(getTeamLogoPath("CHW")).toBe("/images/teams/CHW.svg");
    expect(getTeamLogoPath("ATH")).toBe("/images/teams/ATH.svg");
  });

  it("returns paths for all 30 teams", () => {
    const allAbbrs = Object.keys(ABBR_TO_GITHUB_FILENAME);
    allAbbrs.forEach((abbr) => {
      const path = getTeamLogoPath(abbr);
      expect(path).toBeDefined();
      expect(path).toMatch(/^\/images\/teams\/[A-Z]+\.svg$/);
    });
  });
});

describe("getTeamLogoDownloadUrl", () => {
  const GITHUB_BASE = "https://raw.githubusercontent.com/MLBAMGames/mlb_teams_logo_svg/main/light";

  it("returns correct GitHub URL for valid team", () => {
    expect(getTeamLogoDownloadUrl("NYY")).toBe(`${GITHUB_BASE}/nyy_l.svg`);
    expect(getTeamLogoDownloadUrl("LAD")).toBe(`${GITHUB_BASE}/lad_l.svg`);
  });

  it("handles lowercase input", () => {
    expect(getTeamLogoDownloadUrl("nyy")).toBe(`${GITHUB_BASE}/nyy_l.svg`);
  });

  it("maps CHW to cws filename", () => {
    expect(getTeamLogoDownloadUrl("CHW")).toBe(`${GITHUB_BASE}/cws_l.svg`);
  });

  it("maps ATH to oak filename (Athletics)", () => {
    expect(getTeamLogoDownloadUrl("ATH")).toBe(`${GITHUB_BASE}/oak_l.svg`);
  });

  it("returns undefined for unknown abbreviation", () => {
    expect(getTeamLogoDownloadUrl("XXX")).toBeUndefined();
  });

  it("returns URLs for all known teams", () => {
    TEAM_LOGO_ABBREVIATIONS.forEach((abbr) => {
      const url = getTeamLogoDownloadUrl(abbr);
      expect(url).toBeDefined();
      expect(url).toContain(GITHUB_BASE);
      expect(url).toMatch(/_l\.svg$/);
    });
  });
});

describe("TEAM_LOGO_ABBREVIATIONS", () => {
  it("contains 30 teams", () => {
    expect(TEAM_LOGO_ABBREVIATIONS).toHaveLength(30);
  });

  it("includes all expected division teams", () => {
    const alEast = ["NYY", "BOS", "TB", "TOR", "BAL"];
    const alCentral = ["CLE", "CHW", "DET", "KC", "MIN"];
    const alWest = ["HOU", "SEA", "TEX", "LAA", "ATH"];
    const nlEast = ["ATL", "NYM", "PHI", "MIA", "WSH"];
    const nlCentral = ["CHC", "MIL", "STL", "CIN", "PIT"];
    const nlWest = ["LAD", "SD", "SF", "ARI", "COL"];

    [...alEast, ...alCentral, ...alWest, ...nlEast, ...nlCentral, ...nlWest].forEach((abbr) => {
      expect(TEAM_LOGO_ABBREVIATIONS).toContain(abbr);
    });
  });

  it("matches keys in ABBR_TO_GITHUB_FILENAME", () => {
    expect(TEAM_LOGO_ABBREVIATIONS.sort()).toEqual(Object.keys(ABBR_TO_GITHUB_FILENAME).sort());
  });
});

describe("ABBR_TO_GITHUB_FILENAME mapping", () => {
  it("maps standard abbreviations to lowercase", () => {
    expect(ABBR_TO_GITHUB_FILENAME.NYY).toBe("nyy");
    expect(ABBR_TO_GITHUB_FILENAME.LAD).toBe("lad");
    expect(ABBR_TO_GITHUB_FILENAME.BOS).toBe("bos");
  });

  it("maps CHW to cws (Chicago White Sox)", () => {
    expect(ABBR_TO_GITHUB_FILENAME.CHW).toBe("cws");
  });

  it("maps ATH to oak (Athletics use Oakland logo)", () => {
    expect(ABBR_TO_GITHUB_FILENAME.ATH).toBe("oak");
  });

  it("has unique filenames for each team", () => {
    const filenames = Object.values(ABBR_TO_GITHUB_FILENAME);
    const uniqueFilenames = new Set(filenames);
    // Note: ATH maps to oak, which is intentional
    expect(uniqueFilenames.size).toBe(filenames.length);
  });
});
