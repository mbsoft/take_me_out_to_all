import { describe, it, expect } from "vitest";
import { optimizeRoute, Park, ScheduledGame, OptimizedRoute } from "../route-optimizer";

// Helper to create test parks
function createPark(abbr: string, lat: number, lon: number): Park {
  return { abbr, lat, lon, stadium_name: `${abbr} Stadium` };
}

// Helper to create test games
function createGame(
  gameId: number,
  homeTeam: string,
  dateTime: string,
): ScheduledGame {
  return {
    game_id: gameId,
    home_team: homeTeam,
    away_team: "VIS",
    date_time: dateTime,
    date_time_utc: dateTime,
    day: new Date(dateTime).toDateString(),
  };
}

// Test fixtures
const NYC = { lat: 40.7128, lon: -74.006 };
const LA = { lat: 34.0522, lon: -118.2437 };
const BOSTON = { lat: 42.3601, lon: -71.0589 };
const CHICAGO = { lat: 41.8781, lon: -87.6298 };

const yankeeStadium = createPark("NYY", 40.8296, -73.9262);
const fenway = createPark("BOS", 42.3467, -71.0972);
const wrigley = createPark("CHC", 41.9484, -87.6553);
const dodgerStadium = createPark("LAD", 34.0739, -118.2400);

describe("optimizeRoute", () => {
  describe("empty inputs", () => {
    it("returns empty route for no parks", () => {
      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", [], new Map());
      expect(result).toEqual({
        stops: [],
        totalDistanceMiles: 0,
        estimatedDays: 0,
        infeasibleParks: [],
        segmentModes: [],
      });
    });
  });

  describe("single park", () => {
    it("returns single stop for one park with available game", () => {
      const parks = [yankeeStadium];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops).toHaveLength(1);
      expect(result.stops[0].park.abbr).toBe("NYY");
      expect(result.stops[0].game.game_id).toBe(1);
      expect(result.infeasibleParks).toEqual([]);
    });

    it("marks park as infeasible when no games available", () => {
      const parks = [yankeeStadium];
      const games = new Map<string, ScheduledGame[]>([["NYY", []]]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops).toHaveLength(0);
      expect(result.infeasibleParks).toContain("NYY");
    });

    it("marks park infeasible when game is before earliest possible arrival", () => {
      const parks = [yankeeStadium];
      // Game is the same day, not enough travel time
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-01T13:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      // Should be infeasible because can't arrive in time
      expect(result.infeasibleParks).toContain("NYY");
    });
  });

  describe("multiple parks - scheduling", () => {
    it("schedules parks with games in chronological order", () => {
      const parks = [fenway, yankeeStadium];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-05T19:00:00")]],
        ["BOS", [createGame(2, "BOS", "2024-06-03T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      // Should visit BOS first (game on 6/3), then NYY (game on 6/5)
      expect(result.stops).toHaveLength(2);
      expect(result.stops[0].park.abbr).toBe("BOS");
      expect(result.stops[1].park.abbr).toBe("NYY");
    });

    it("skips to later game if first game is unreachable", () => {
      const parks = [yankeeStadium];
      const games = new Map([
        [
          "NYY",
          [
            createGame(1, "NYY", "2024-06-01T14:00:00"), // Too soon
            createGame(2, "NYY", "2024-06-02T19:00:00"), // Reachable
          ],
        ],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops).toHaveLength(1);
      expect(result.stops[0].game.game_id).toBe(2);
    });
  });

  describe("travel modes", () => {
    it("assigns car mode for short distances (<500 miles)", () => {
      const parks = [fenway]; // ~200 miles from NYC
      const games = new Map([
        ["BOS", [createGame(1, "BOS", "2024-06-03T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops[0].travelMode).toBe("car");
      expect(result.segmentModes[0]).toBe("car");
    });

    it("assigns air mode for long distances (>=500 miles)", () => {
      const parks = [dodgerStadium]; // ~2450 miles from NYC
      const games = new Map([
        ["LAD", [createGame(1, "LAD", "2024-06-05T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops[0].travelMode).toBe("air");
      expect(result.segmentModes[0]).toBe("air");
    });

    it("respects forced drive mode for all legs", () => {
      const parks = [dodgerStadium]; // Normally would be air
      const games = new Map([
        ["LAD", [createGame(1, "LAD", "2024-06-08T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games, undefined, "drive");

      expect(result.stops[0].travelMode).toBe("car");
      expect(result.segmentModes[0]).toBe("car");
    });

    it("respects forced fly mode for all legs", () => {
      const parks = [fenway]; // Normally would be car
      const games = new Map([
        ["BOS", [createGame(1, "BOS", "2024-06-04T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games, undefined, "fly");

      expect(result.stops[0].travelMode).toBe("air");
      expect(result.segmentModes[0]).toBe("air");
    });
  });

  describe("distance calculations", () => {
    it("calculates total distance across all stops", () => {
      const parks = [fenway, wrigley];
      const games = new Map([
        ["BOS", [createGame(1, "BOS", "2024-06-03T19:00:00")]],
        ["CHC", [createGame(2, "CHC", "2024-06-06T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.totalDistanceMiles).toBeGreaterThan(0);
      // Sum of individual distances should equal total
      const sumDistances = result.stops.reduce((sum, s) => sum + s.distanceFromPrevious, 0);
      expect(result.totalDistanceMiles).toBe(sumDistances);
    });

    it("includes distance to end location in total", () => {
      const parks = [yankeeStadium];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
      ]);

      const withEnd = optimizeRoute(NYC, BOSTON, "2024-06-01T12:00:00", parks, games);
      const withoutEnd = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(withEnd.totalDistanceMiles).toBeGreaterThan(withoutEnd.totalDistanceMiles);
    });
  });

  describe("estimated days", () => {
    it("calculates days from start date to last game", () => {
      const parks = [yankeeStadium, fenway];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
        ["BOS", [createGame(2, "BOS", "2024-06-05T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.estimatedDays).toBe(5); // June 1 12pm to June 5 7pm = ~4.3 days, ceil = 5
    });

    it("returns 0 days when no stops", () => {
      const parks = [yankeeStadium];
      const games = new Map<string, ScheduledGame[]>([["NYY", []]]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.estimatedDays).toBe(0);
    });
  });

  describe("gap hours", () => {
    it("calculates gap hours between consecutive games", () => {
      const parks = [yankeeStadium, fenway];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
        ["BOS", [createGame(2, "BOS", "2024-06-04T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      // Second stop should have gap from first game time
      if (result.stops.length >= 2) {
        expect(result.stops[1].gapHours).toBeGreaterThan(0);
        // Gap should be ~48 hours (June 2 7pm to June 4 7pm)
        expect(result.stops[1].gapHours).toBeCloseTo(48, -1);
      }
    });
  });

  describe("segment modes array", () => {
    it("builds segment modes for each leg", () => {
      const parks = [yankeeStadium, fenway];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
        ["BOS", [createGame(2, "BOS", "2024-06-04T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      // Should have mode for start->first and first->second
      expect(result.segmentModes).toHaveLength(2);
      expect(result.segmentModes.every((m) => m === "car" || m === "air")).toBe(true);
    });

    it("includes end location segment mode", () => {
      const parks = [yankeeStadium];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, LA, "2024-06-01T12:00:00", parks, games);

      // start->NYY, NYY->LA (end)
      expect(result.segmentModes).toHaveLength(2);
      expect(result.segmentModes[1]).toBe("air"); // NYY to LA is >500 miles
    });
  });

  describe("driving matrix integration", () => {
    it("uses driving matrix distances when provided for car legs", () => {
      const parks = [fenway]; // ~200 miles from NYC
      const games = new Map([
        ["BOS", [createGame(1, "BOS", "2024-06-03T19:00:00")]],
      ]);

      const drivingMatrix = {
        distances: [
          [0, 250], // NYC to BOS actual driving is ~250 miles
          [250, 0],
        ],
        durations: [
          [0, 4.5], // ~4.5 hours
          [4.5, 0],
        ],
      };

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games, drivingMatrix);

      // Should use the driving matrix distance of 250 miles instead of haversine
      expect(result.stops[0].distanceFromPrevious).toBeCloseTo(250, 0);
    });
  });

  describe("edge cases", () => {
    it("handles parks with no games in map", () => {
      const parks = [yankeeStadium];
      const games = new Map<string, ScheduledGame[]>(); // Empty map

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops).toHaveLength(0);
      expect(result.infeasibleParks).toContain("NYY");
    });

    it("handles same start and end location", () => {
      const parks = [yankeeStadium];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, NYC, "2024-06-01T12:00:00", parks, games);

      expect(result.stops).toHaveLength(1);
      // Total should include return leg
      expect(result.totalDistanceMiles).toBeGreaterThan(result.stops[0].distanceFromPrevious);
    });

    it("handles multiple games per day at same park", () => {
      const parks = [yankeeStadium];
      const games = new Map([
        [
          "NYY",
          [
            createGame(1, "NYY", "2024-06-02T13:00:00"), // Day game
            createGame(2, "NYY", "2024-06-02T19:00:00"), // Night game
          ],
        ],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops).toHaveLength(1);
      // Should pick the first feasible game
    });
  });

  describe("optimization behavior", () => {
    it("produces reasonable routes for nearby parks", () => {
      // Three parks in the northeast corridor
      const parks = [yankeeStadium, fenway, createPark("PHI", 39.9061, -75.1665)];
      const games = new Map([
        ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
        ["BOS", [createGame(2, "BOS", "2024-06-04T19:00:00")]],
        ["PHI", [createGame(3, "PHI", "2024-06-06T19:00:00")]],
      ]);

      const result = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

      expect(result.stops).toHaveLength(3);
      expect(result.infeasibleParks).toEqual([]);
      expect(result.totalDistanceMiles).toBeGreaterThan(0);
    });
  });
});

describe("route optimization determinism", () => {
  it("produces same results for identical inputs", () => {
    const parks = [yankeeStadium, fenway, wrigley];
    const games = new Map([
      ["NYY", [createGame(1, "NYY", "2024-06-02T19:00:00")]],
      ["BOS", [createGame(2, "BOS", "2024-06-05T19:00:00")]],
      ["CHC", [createGame(3, "CHC", "2024-06-08T19:00:00")]],
    ]);

    const result1 = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);
    const result2 = optimizeRoute(NYC, null, "2024-06-01T12:00:00", parks, games);

    expect(result1.stops.map((s) => s.park.abbr)).toEqual(result2.stops.map((s) => s.park.abbr));
    expect(result1.totalDistanceMiles).toBe(result2.totalDistanceMiles);
  });
});
