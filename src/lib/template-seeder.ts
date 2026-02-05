import { v4 as uuid } from "uuid";
import { db } from "./db";

export async function seedTemplatesForUser(userId: string): Promise<void> {
  // Fetch all active templates
  const { data: templates, error: tErr } = await db
    .from("itinerary_templates")
    .select("*")
    .eq("is_active", true);

  if (tErr || !templates || templates.length === 0) return;

  for (const template of templates) {
    const itineraryId = uuid();

    // Create itinerary owned by the new user
    const { error: insertErr } = await db.from("itineraries").insert({
      id: itineraryId,
      user_id: userId,
      name: `Example: ${template.name}`,
      goal: template.goal,
      travel_mode: template.travel_mode,
      start_date: template.start_date || null,
      start_location: template.start_location || null,
      start_lat: template.start_lat || null,
      start_lon: template.start_lon || null,
      end_location: template.end_location || null,
      end_lat: template.end_lat || null,
      end_lon: template.end_lon || null,
      custom_teams: template.custom_teams || null,
      segment_modes: template.segment_modes || null,
    });

    if (insertErr) {
      console.error(`[template-seeder] Failed to create itinerary from template ${template.id}:`, insertErr);
      continue;
    }

    // Fetch template games
    const { data: templateGames } = await db
      .from("itinerary_template_games")
      .select("*")
      .eq("template_id", template.id)
      .order("sort_order", { ascending: true });

    if (templateGames && templateGames.length > 0) {
      // Check which game_ids still exist
      const gameIds = templateGames
        .map((tg: any) => tg.game_id)
        .filter((id: number | null) => id != null);

      const validGameIds = new Set<number>();
      if (gameIds.length > 0) {
        const { data: validGames } = await db
          .from("games")
          .select("game_id")
          .in("game_id", gameIds);
        if (validGames) {
          for (const g of validGames) validGameIds.add(g.game_id as number);
        }
      }

      const gameInserts: {
        id: string;
        itinerary_id: string;
        game_id: number;
        sort_order: number;
      }[] = [];

      for (const tg of templateGames) {
        let resolvedGameId: number | null = null;

        if (tg.game_id && validGameIds.has(tg.game_id)) {
          resolvedGameId = tg.game_id;
        } else {
          // Fallback: find a game for the same home_team
          const { data: fallbackGames } = await db
            .from("games")
            .select("game_id")
            .eq("home_team", tg.home_team)
            .neq("status", "Canceled")
            .gte("date_time", new Date().toISOString())
            .order("date_time", { ascending: true })
            .limit(1);

          if (fallbackGames && fallbackGames.length > 0) {
            resolvedGameId = fallbackGames[0].game_id as number;
          }
        }

        if (resolvedGameId) {
          gameInserts.push({
            id: uuid(),
            itinerary_id: itineraryId,
            game_id: resolvedGameId,
            sort_order: tg.sort_order,
          });
        }
      }

      if (gameInserts.length > 0) {
        const { error: gamesErr } = await db
          .from("itinerary_games")
          .insert(gameInserts);
        if (gamesErr) {
          console.error(`[template-seeder] Failed to insert games for template ${template.id}:`, gamesErr);
        }
      }
    }

    // Fetch and copy template stopovers
    const { data: templateStopovers } = await db
      .from("itinerary_template_stopovers")
      .select("*")
      .eq("template_id", template.id);

    if (templateStopovers && templateStopovers.length > 0) {
      const stopoverInserts = templateStopovers.map((ts: any) => ({
        id: uuid(),
        itinerary_id: itineraryId,
        after_index: ts.after_index,
        label: ts.label,
        lat: ts.lat,
        lon: ts.lon,
        sort_order: ts.sort_order,
      }));

      await db.from("itinerary_stopovers").insert(stopoverInserts);
    }
  }
}
