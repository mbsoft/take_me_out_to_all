import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    from: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "mock-itinerary-uuid",
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

describe("GET /api/itineraries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns user itineraries with game counts", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockItineraries = [
      {
        id: "itin-1",
        name: "Summer Trip",
        goal: "all",
        custom_teams: null,
        itinerary_games: [{ id: "g1" }, { id: "g2" }],
      },
      {
        id: "itin-2",
        name: "East Coast",
        goal: "custom",
        custom_teams: '["NYY","BOS"]',
        itinerary_games: [{ id: "g3" }],
      },
    ];

    const mockSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: mockItineraries, error: null }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      select: mockSelect,
    }) as ReturnType<typeof db.from>);

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].game_count).toBe(2);
    expect(json[0].itinerary_games).toBeUndefined();
    expect(json[1].custom_teams).toEqual(["NYY", "BOS"]);
  });

  it("returns 500 on database error", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockSelect = vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      select: mockSelect,
    }) as ReturnType<typeof db.from>);

    const res = await GET();

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to fetch itineraries");
  });
});

describe("POST /api/itineraries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: object): Request {
    return new Request("http://localhost:3000/api/itineraries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const req = createRequest({ name: "Trip", goal: "all" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 if custom goal has no teams", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const req = createRequest({ name: "Trip", goal: "custom", custom_teams: [] });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("custom goal");
  });

  it("creates itinerary successfully", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: { id: "mock-itinerary-uuid" }, error: null }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      insert: mockInsert,
    }) as ReturnType<typeof db.from>);

    const req = createRequest({
      name: "Summer Trip",
      goal: "all",
      travel_mode: "mixed",
      start_date: "2024-06-01",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("mock-itinerary-uuid");
  });

  it("creates custom goal itinerary with teams", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    let insertData: any = null;
    const mockInsert = vi.fn((data) => {
      insertData = data;
      return {
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: "mock-itinerary-uuid" }, error: null }),
        })),
      };
    });
    vi.mocked(db.from).mockImplementation(() => ({
      insert: mockInsert,
    }) as ReturnType<typeof db.from>);

    const req = createRequest({
      name: "East Coast",
      goal: "custom",
      custom_teams: ["NYY", "BOS", "PHI"],
    });
    await POST(req);

    expect(insertData.custom_teams).toBe('["NYY","BOS","PHI"]');
  });

  it("returns 500 on database error", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1" },
    } as any);

    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      })),
    }));
    vi.mocked(db.from).mockImplementation(() => ({
      insert: mockInsert,
    }) as ReturnType<typeof db.from>);

    const req = createRequest({ name: "Trip", goal: "all" });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
