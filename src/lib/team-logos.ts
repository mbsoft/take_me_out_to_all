/**
 * MLB team abbreviation to logo filename (GitHub MLBAMGames/mlb_teams_logo_svg uses
 * lowercase; CHW->cws, ATH->oak for Athletics).
 */
const ABBR_TO_GITHUB_FILENAME: Record<string, string> = {
  ARI: "ari",
  ATH: "oak", // Athletics (Sacramento) - use Oakland logo
  ATL: "atl",
  BAL: "bal",
  BOS: "bos",
  CHC: "chc",
  CHW: "cws",
  CIN: "cin",
  CLE: "cle",
  COL: "col",
  DET: "det",
  HOU: "hou",
  KC: "kc",
  LAA: "laa",
  LAD: "lad",
  MIA: "mia",
  MIL: "mil",
  MIN: "min",
  NYM: "nym",
  NYY: "nyy",
  PHI: "phi",
  PIT: "pit",
  SD: "sd",
  SEA: "sea",
  SF: "sf",
  STL: "stl",
  TB: "tb",
  TEX: "tex",
  TOR: "tor",
  WSH: "wsh",
};

const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/MLBAMGames/mlb_teams_logo_svg/main/light";

/** Public path for a team logo (e.g. /images/teams/ARI.svg). Returns undefined if no logo. */
export function getTeamLogoPath(abbr: string): string | undefined {
  if (!abbr) return undefined;
  const key = abbr.toUpperCase();
  const filename = ABBR_TO_GITHUB_FILENAME[key];
  if (!filename) return undefined;
  return `/images/teams/${key}.svg`;
}

/** All known team abbreviations that have logos. */
export const TEAM_LOGO_ABBREVIATIONS = Object.keys(ABBR_TO_GITHUB_FILENAME);

/** GitHub raw URL for a team (used by download script). */
export function getTeamLogoDownloadUrl(abbr: string): string | undefined {
  const key = abbr.toUpperCase();
  const filename = ABBR_TO_GITHUB_FILENAME[key];
  if (!filename) return undefined;
  return `${GITHUB_RAW_BASE}/${filename}_l.svg`;
}

export { ABBR_TO_GITHUB_FILENAME };
