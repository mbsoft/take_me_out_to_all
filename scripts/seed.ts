import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { teamsData } from "../src/lib/teams-data";

// Load environment variables from .env.local or .env
config({ path: join(__dirname, "../.env.local") });
config({ path: join(__dirname, "../.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Missing required environment variables!");
  console.error("Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTablesExist() {
  // Check if teams table exists by trying to query it
  const { error } = await supabase.from("teams").select("abbr").limit(1);
  return !error;
}

async function seed() {
  // Check if tables exist
  const tablesExist = await checkTablesExist();
  
  if (!tablesExist) {
    console.log("\n❌ Tables don't exist in Supabase!");
    console.log("\n📋 Please create the tables first:");
    console.log("1. Go to your Supabase dashboard: https://supabase.com/dashboard");
    console.log("2. Select your project");
    console.log("3. Navigate to 'SQL Editor' in the left sidebar");
    console.log("4. Click 'New query'");
    console.log("5. Copy and paste the SQL from src/lib/schema.sql");
    console.log("6. Click 'Run' to execute the SQL");
    console.log("7. Then run this seed script again: npm run seed\n");
    
    const schema = readFileSync(join(__dirname, "../src/lib/schema.sql"), "utf-8");
    console.log("📄 SQL to run:\n");
    console.log("─".repeat(60));
    console.log(schema);
    console.log("─".repeat(60));
    console.log("\n");
    return;
  }
  
  console.log("✅ Tables exist. Seeding data...");

  // Seed teams - using upsert (INSERT ... ON CONFLICT)
  const teamsToInsert = teamsData.map((t) => ({
    abbr: t.abbr,
    name: t.name,
    league: t.league,
    division: t.division,
    stadium_name: t.stadium_name,
    city: t.city,
    state: t.state,
    lat: t.lat,
    lon: t.lon,
  }));

  const { error: teamsError } = await supabase
    .from("teams")
    .upsert(teamsToInsert, { onConflict: "abbr" });
  
  if (teamsError) {
    console.error("Error seeding teams:", teamsError);
    return;
  }
  console.log(`Seeded ${teamsData.length} teams.`);

  // Import games
  const raw = readFileSync(join(__dirname, "../2026_mlb_schedule.json"), "utf-8");
  const games: Array<{
    GameID: number;
    Day: string;
    DateTime: string;
    DateTimeUTC: string;
    AwayTeam: string;
    HomeTeam: string;
    StadiumID: number;
    Status: string;
  }> = JSON.parse(raw);

  const scheduled = games.filter((g) => g.Status !== "Canceled");
  console.log(`Importing ${scheduled.length} games (filtered ${games.length - scheduled.length} canceled)...`);

  const BATCH = 50;
  for (let i = 0; i < scheduled.length; i += BATCH) {
    const batch = scheduled.slice(i, i + BATCH);
    const gamesToInsert = batch.map((g) => ({
      game_id: g.GameID,
      day: g.Day,
      date_time: g.DateTime,
      date_time_utc: g.DateTimeUTC,
      away_team: g.AwayTeam,
      home_team: g.HomeTeam,
      stadium_id: g.StadiumID,
      status: g.Status,
    }));

    const { error: gamesError } = await supabase
      .from("games")
      .upsert(gamesToInsert, { onConflict: "game_id" });
    
    if (gamesError) {
      console.error(`Error importing batch ${i}-${i + batch.length}:`, gamesError);
    }
  }
  console.log(`Imported ${scheduled.length} games.`);
  console.log("Seed complete!");
}

seed().catch(console.error);
