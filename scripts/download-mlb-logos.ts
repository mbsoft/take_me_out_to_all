/**
 * Downloads MLB team logos from GitHub (MLBAMGames/mlb_teams_logo_svg) into
 * public/images/teams/ so they can be served locally.
 *
 * Run: npx tsx scripts/download-mlb-logos.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { TEAM_LOGO_ABBREVIATIONS, getTeamLogoDownloadUrl } from "../src/lib/team-logos";

const OUT_DIR = join(__dirname, "..", "public", "images", "teams");

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  for (const abbr of TEAM_LOGO_ABBREVIATIONS) {
    const url = getTeamLogoDownloadUrl(abbr);
    if (!url) continue;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${abbr}: ${res.status} ${res.statusText}`);
        continue;
      }
      const svg = await res.text();
      const path = join(OUT_DIR, `${abbr}.svg`);
      writeFileSync(path, svg, "utf-8");
      console.log(`Saved ${abbr}.svg`);
    } catch (e) {
      console.warn(`Error fetching ${abbr}:`, e);
    }
  }

  console.log("Done.");
}

main();
